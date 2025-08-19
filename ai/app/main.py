"""
FastAPI + aiortc signaling server + HTTP endpoint to generate video from text.
- WebSocket /ws: clients register (send {"type":"register","clientId":"..."}) then exchange offer/answer/ice via JSON.
- POST /generateFromText: server generates a synthetic video track with given text and adds it to client's peer connection,
  then initiates renegotiation (server creates offer -> client must reply with answer).
"""

import asyncio
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

import cv2
import websockets
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from aiortc import (
    RTCPeerConnection,
    RTCSessionDescription,
    MediaStreamTrack,
    RTCIceCandidate,
)
from aiortc.contrib.media import MediaRelay
from av import VideoFrame

import tensorflow as tf
app = FastAPI()


# ---------- CONFIG ----------
# SIGNALING_URI = "ws://localhost:8080/stream?client=python"  # <-- change if different
SIGNALING_URI = "ws://backend:8080/stream?client=python"  # <-- change if different
WAIT_FOR_TRACK_SECONDS = 5  # wait for incoming track before creating answer (seconds)
RECONNECT_DELAY_SECONDS = 3

MAX_INFERENCE_WORKERS = 4
GENERATED_VIDEO_FPS = 15
GENERATED_VIDEO_WIDTH = 640
GENERATED_VIDEO_HEIGHT = 360
# ----------------------------

# Global state
pcs: Dict[str, RTCPeerConnection] = {}  # clientId -> PeerConnection
pending_ice: Dict[str, List[dict]] = {}  # clientId -> list of pending ICE candidates
# Maps clientId -> asyncio.Future used to wait for first remote track
track_waiters: Dict[str, asyncio.Future] = {}


relay = MediaRelay()


executor = ThreadPoolExecutor(max_workers=MAX_INFERENCE_WORKERS)


@tf.function
def predict_fn(X):
    return model(X, training=False)

model = tf.keras.models.load_model("app/keras_model.keras")

class VideoTransformTrack(MediaStreamTrack):
    kind = "video"

    def __init__(self, track):
        super().__init__()
        self.track = track
        self.counter = 0
        
    async def recv(self):
        frame = await self.track.recv()
    
        img = frame.to_ndarray(format="bgr24")

        img_gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY)
        img_norm = img_gray / 255.0
        XTest = cv2.resize(img_norm, (28, 28)).reshape(-1, 28, 28, 1)

        XTest_tensor = tf.convert_to_tensor(XTest, dtype=tf.float32)
        predictions = predict_fn(XTest_tensor)
        predicted_class = tf.argmax(predictions, axis=1).numpy()
        letters = list("ABCDEFGHIKLMNOPQRSTUVWXY")
        letter = letters[predicted_class[0]]

        XTest_display = (XTest[0, :, :, 0] * 255).astype(np.uint8)  # float -> uint8
        XTest_display = cv2.resize(XTest_display, (img.shape[1], img.shape[0]))  # opcjonalnie skalowanie
        XTest_display = cv2.cvtColor(XTest_display, cv2.COLOR_GRAY2BGR)  # na 3 kanały BGR

        cv2.putText(XTest_display, f"Class: {letter}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        new_frame = VideoFrame.from_ndarray(XTest_display, format="bgr24")
        new_frame.pts = frame.pts
        new_frame.time_base = frame.time_base

        return new_frame


def parse_ice_candidate_string(candidate_string: str) -> dict:
    """
    Parse ICE candidate string to extract components.
    Example: "candidate:842163049 1 udp 1677729535 192.168.1.2 54400 typ srflx..."
    """
    try:
        parts = candidate_string.split()
        if len(parts) < 8:
            raise ValueError(f"Invalid candidate string: {candidate_string}")

        # Parse basic components
        foundation = parts[0].split(":")[1]  # "candidate:842163049" -> "842163049"
        component = int(parts[1])
        protocol = parts[2]
        priority = int(parts[3])
        ip = parts[4]
        port = int(parts[5])
        candidate_type = parts[7]  # after "typ"

        return {
            "foundation": foundation,
            "component": component,
            "protocol": protocol,
            "priority": priority,
            "ip": ip,
            "port": port,
            "type": candidate_type,
        }
    except Exception as e:
        print(f"❌ Error parsing candidate string: {e}")
        return {
            "foundation": "0",
            "component": 1,
            "protocol": "udp",
            "priority": 1,
            "ip": "0.0.0.0",
            "port": 9,
            "type": "host",
        }


# ✅ HELPER FUNCTIONS
async def send_ice_candidate(ws, client_id: str, candidate_dict):
    """Send ICE candidate to Spring WebSocket."""
    try:
        out = {"type": "ice", "to": client_id, "candidate": candidate_dict}
        await ws.send(json.dumps(out))
        print(f"[{client_id}] 📤 ICE candidate sent: {candidate_dict}")
    except Exception as e:
        print(f"[{client_id}] ❌ Failed to send ICE candidate: {e}")


async def handle_offer(ws, msg):
    """
    Handle incoming 'offer' message forwarded by Spring.
    Expect msg to include 'from' (clientId) and 'sdp' (object or string).
    """
    client_id = msg.get("from")
    if not client_id:
        print("offer without 'from' -> ignoring")
        return

    # Clean up existing pc for client if present
    if client_id in pcs:
        try:
            await pcs[client_id].close()
        except Exception:
            pass
        pcs.pop(client_id, None)
        track_waiters.pop(client_id, None)

    pc = RTCPeerConnection()
    pcs[client_id] = pc

    # Future to wait for first remote track (so we can add relay-subscription as local track)
    loop = asyncio.get_running_loop()
    waiter: asyncio.Future = loop.create_future()
    track_waiters[client_id] = waiter

    @pc.on("icecandidate")
    def on_icecandidate(candidate):  # ✅ sync function
        """Handle local ICE candidates generated by aiortc."""
        print(f"[{client_id}] 🧊 Local ICE candidate generated: {candidate}")

        if candidate is None:
            # End of candidates
            print(f"[{client_id}] 🏁 ICE gathering complete")
            asyncio.create_task(send_ice_candidate(ws, client_id, None))
        else:
            # Send candidate to Spring
            candidate_dict = {
                "candidate": str(candidate),
                "sdpMid": candidate.sdpMid,
                "sdpMLineIndex": candidate.sdpMLineIndex,
            }
            asyncio.create_task(send_ice_candidate(ws, client_id, candidate_dict))

    @pc.on("track")
    def on_track(track: MediaStreamTrack):
        # fulfill waiter with the first remote track
        print(f"[{client_id}] remote track received: kind={track.kind}")
        w = track_waiters.get(client_id)
        if w and not w.done():
            w.set_result(track)
        # optional: spawn background task to read frames
        # asyncio.create_task(read_frames(client_id, track))


    # parse sdp
    sdp_obj = msg.get("sdp")
    if isinstance(sdp_obj, dict):
        sdp_type = sdp_obj.get("type", "offer")
        sdp_text = sdp_obj.get("sdp")
    else:
        sdp_type = msg.get("type", "offer")
        sdp_text = sdp_obj

    offer = RTCSessionDescription(sdp=sdp_text, type=sdp_type)
    await pc.setRemoteDescription(offer)

    # Wait for incoming track a short time so we can echo it back
    track = None
    try:
        track = await asyncio.wait_for(waiter, timeout=WAIT_FOR_TRACK_SECONDS)
    except asyncio.TimeoutError:
        # no remote track arrived in time -> proceed without echo
        print(
            f"[{client_id}] timeout waiting for remote track, will answer without echo"
        )

    if track:
        try:
            # here can make manipulation on the track
            processed_track = VideoTransformTrack(track)
            pc.addTrack(processed_track)
            # relayed = relay.subscribe(track)
            # pc.addTrack(relayed)
            print(f"[{client_id}] added relayed local track (echo)")
        except Exception as e:
            print(f"[{client_id}] error adding relayed track: {e}")
            # traceback.print_exc()

    # Flush any pending ICE candidates
    pending = pending_ice.pop(client_id, [])
    for cand_dict in pending:
        try:
            await add_ice_candidate_safe(pc, client_id, cand_dict)
        except Exception as e:
            print(f"[{client_id}] addIceCandidate (pending) failed: {e}")

    # create and send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    out = {
        "type": "answer",
        "to": client_id,
        "sdp": {"type": pc.localDescription.type, "sdp": pc.localDescription.sdp},
    }
    await ws.send(json.dumps(out))
    print(f"[{client_id}] answer sent")



async def handle_ice(msg):
    """Handle incoming ICE candidate from JS client."""
    client_id = msg.get("from")
    cand_dict = msg.get("candidate")

    if not client_id:
        print("❌ ICE message without 'from', ignoring")
        return

    if not cand_dict:
        print(f"[{client_id}] 🏁 Received end-of-candidates signal")
        return

    # print(f"[{client_id}] 🧊 Received ICE candidate: {cand_dict}")

    pc = pcs.get(client_id)
    if not pc:
        print(f"[{client_id}] ❌ No peer connection found, buffering candidate")
        pending_ice.setdefault(client_id, []).append(cand_dict)
        return

    if pc.remoteDescription and pc.remoteDescription.type:
        await add_ice_candidate_safe(pc, client_id, cand_dict)
    else:
        print(f"[{client_id}] 📦 Buffering ICE candidate (no remote description)")
        pending_ice.setdefault(client_id, []).append(cand_dict)


async def add_ice_candidate_safe(
    pc: RTCPeerConnection, client_id: str, cand_dict: dict
):
    """Safely add ICE candidate with proper error handling."""
    try:
        candidate_string = cand_dict.get("candidate")
        sdp_mid = cand_dict.get("sdpMid")
        sdp_mline_index = cand_dict.get("sdpMLineIndex")

        if not candidate_string:
            print(f"[{client_id}] ⚠️ Empty candidate string, skipping")
            return

        # Parse candidate string
        parsed = parse_ice_candidate_string(candidate_string)

        ice_candidate = RTCIceCandidate(
            component=parsed["component"],
            foundation=parsed["foundation"],
            ip=parsed["ip"],
            port=parsed["port"],
            priority=parsed["priority"],
            protocol=parsed["protocol"],
            type=parsed["type"],
            sdpMid=sdp_mid,
            sdpMLineIndex=sdp_mline_index,
        )

        await pc.addIceCandidate(ice_candidate)
        # print(
        #     f"[{client_id}] ✅ ICE candidate added: {parsed['type']} {parsed['protocol']}"
        # )

    except Exception as e:
        print(f"[{client_id}] ❌ addIceCandidate failed: {e}")


async def handle_close(msg):
    """
    Handle close request from Spring.
    Expect msg: { "type": "close", "from": "<clientId>" }
    """
    client_id = msg.get("from")
    if not client_id:
        return

    pc = pcs.pop(client_id, None)
    if pc:
        try:
            await pc.close()
        except Exception as e:
            print(f"[{client_id}] error closing pc: {e}")
    pending_ice.pop(client_id, None)
    track_waiters.pop(client_id, None)
    print(f"[{client_id}] cleaned up")


async def signaling_client_loop():
    """
    Connect to Spring WebSocket and respond to messages forwarded from JS clients.
    Reconnects on error with a delay.
    """
    while True:
        try:
            async with websockets.connect(SIGNALING_URI) as ws:
                print("Connected to signaling:", SIGNALING_URI)
                async for message in ws:
                    try:
                        msg = json.loads(message)
                    except Exception:
                        print("Received non-JSON message:", message)
                        continue

                    mtype = msg.get("type")

                    if mtype == "offer":
                        await handle_offer(ws, msg)
                    elif mtype == "ice":
                        await handle_ice(msg)
                    elif mtype == "close":
                        await handle_close(msg)
                    else:
                        print("Unknown message type:", mtype, "payload:", msg)
        except Exception as e:
            print("Signaling connection error:", e)
            print("Reconnecting in", RECONNECT_DELAY_SECONDS, "s...")
            await asyncio.sleep(RECONNECT_DELAY_SECONDS)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(signaling_client_loop())


@app.get("/")
async def check_status():
    return "Working"


@app.post("/generateFromText")
async def generate_from_text(payload: dict):
    return "To do"
