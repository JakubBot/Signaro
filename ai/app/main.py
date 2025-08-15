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

import websockets
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaRelay
from av import VideoFrame


app = FastAPI()

# ---------- CONFIG ----------
SIGNALING_URI = 'ws://backend:8080/stream?client=python'  # <-- change if different
WAIT_FOR_TRACK_SECONDS = 5  # wait for incoming track before creating answer (seconds)
RECONNECT_DELAY_SECONDS = 3

MAX_INFERENCE_WORKERS = 4
GENERATED_VIDEO_FPS = 15
GENERATED_VIDEO_WIDTH = 640
GENERATED_VIDEO_HEIGHT = 360
# ----------------------------

# Global state
pcs: Dict[str, RTCPeerConnection] = {}                # clientId -> PeerConnection
pending_ice: Dict[str, List[dict]] = {}               # clientId -> list of pending ICE candidates
# Maps clientId -> asyncio.Future used to wait for first remote track
track_waiters: Dict[str, asyncio.Future] = {}


relay = MediaRelay()


executor = ThreadPoolExecutor(max_workers=MAX_INFERENCE_WORKERS)

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
    async def on_icecandidate(event): # it is accessible
        # send local ICE candidate back to Spring with "to": client_id
        if event.candidate is None:
            return
        out = {"type": "ice", "to": client_id, "candidate": event.candidate.toJSON()}
        try:
            await ws.send(json.dumps(out))
        except Exception as e:
            print(f"[{client_id}] failed to send local ICE: {e}")

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
        print(f"[{client_id}] timeout waiting for remote track, will answer without echo")

    if track:
        try:
            relayed = relay.subscribe(track)
            pc.addTrack(relayed)
            print(f"[{client_id}] added relayed local track (echo)")
        except Exception as e:
            print(f"[{client_id}] error adding relayed track: {e}")
            # traceback.print_exc()

    # Flush any pending ICE candidates
    pending = pending_ice.pop(client_id, [])
    for cand in pending:
        try:
            await pc.addIceCandidate(cand)
        except Exception as e:
            print(f"[{client_id}] addIceCandidate (pending) failed: {e}")

    # create and send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    out = {"type": "answer", "to": client_id, "sdp": {"type": pc.localDescription.type, "sdp": pc.localDescription.sdp}}
    await ws.send(json.dumps(out))
    print(f"[{client_id}] answer sent")

async def handle_ice(msg):
    """
    Handle incoming ICE candidate forwarded by Spring.
    Expect msg: { "type": "ice", "candidate": {...}, "from": "<clientId>" }
    """
    client_id = msg.get("from")
    candidate = msg.get("candidate")
    if not client_id or not candidate:
        return

    pc = pcs.get(client_id)
    if pc and pc.remoteDescription and pc.remoteDescription.type:
        try:
            await pc.addIceCandidate(candidate)
        except Exception as e:
            print(f"[{client_id}] addIceCandidate failed: {e}")
    else:
        # buffer until remoteDescription is set
        pending_ice.setdefault(client_id, []).append(candidate)

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