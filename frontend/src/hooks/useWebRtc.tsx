import servers from "@/constants/webrtc";
import { RefObject, useEffect, useRef, useState } from "react";

interface UseWebRtcReturn {
  localWebcamRef: RefObject<HTMLVideoElement | null>;
  remoteWebcamRef: RefObject<HTMLVideoElement | null>;
  makeOffer: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
  readyWebRtcConnect: boolean;
}

const UseWebRtc = (): UseWebRtcReturn => {
  const localWebcamRef = useRef<HTMLVideoElement | null>(null);
  const remoteWebcamRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [readyWebRtcConnect, setReadyWebRtcConnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        setError(null);

        const localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });

        localStreamRef.current = localStream;

        if (localWebcamRef.current) {
          localWebcamRef.current.srcObject = localStream;
        }
        setReadyWebRtcConnect(true);
      } catch (err: unknown) {
        setError((err as Error).message || "Camera access failed");
      }
    };

    setupCamera();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const makeOffer = async () => {
    if (!localStreamRef.current) {
      setError("Camera not available");
      return;
    }

    try {
      setError(null);

      const remoteStream = new MediaStream();
      const pc = new RTCPeerConnection(servers);
      pcRef.current = pc;

      const outQueue: (RTCIceCandidateInit | null)[] = [];
      const pendingCandidates: (RTCIceCandidateInit | null)[] = [];

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
      };

      if (remoteWebcamRef.current) {
        remoteWebcamRef.current.srcObject = remoteStream;
      }

      pc.onconnectionstatechange = () => {
        console.log("pc state:", pc.connectionState);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.toJSON();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ice", candidate }));
          } else {
            outQueue.push(candidate);
          }
        } else {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: "ice", candidate: null })
            );
          } else {
            outQueue.push(null);
          }
        }
      };

      const ws = new WebSocket("ws://localhost:8080/stream?client=js");
      wsRef.current = ws;

      ws.onopen = async () => {
        setReadyWebRtcConnect(false);

        while (outQueue.length > 0) {
          const candidate = outQueue.shift();
          ws.send(JSON.stringify({ type: "ice", candidate }));
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "offer", sdp: pc.localDescription }));
        console.log("offer sent");
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (!pcRef.current) return;

        if (msg.type === "answer") {
          const desc = new RTCSessionDescription(msg.sdp);
          await pcRef.current.setRemoteDescription(desc);

          while (pendingCandidates.length > 0) {
            const candidate = pendingCandidates.shift();
            try {
              await pcRef.current.addIceCandidate(candidate);
            } catch (e) {
              console.warn("addIceCandidate failed:", e);
            }
          }
        } else if (msg.type === "ice") {
          const candidate = msg.candidate;

          if (!pcRef.current.remoteDescription?.type) {
            pendingCandidates.push(candidate);
          } else {
            try {
              await pcRef.current.addIceCandidate(candidate);
            } catch (e) {
              console.warn("addIceCandidate error:", e);
            }
          }
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection failed");
        setReadyWebRtcConnect(true);
      };

      ws.onclose = () => {
        setReadyWebRtcConnect(true);
      };
    } catch (e: unknown) {
      console.error("Failed to create offer:", e);
      setError((e as Error).message || "Connection failed");
    }
  };

  const disconnect = async () => {
      try {
      // ✅ 1. Send close message and wait for delivery
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "close",
            from: "a89das687cz", // ✅ TODO: Make this dynamic
          })
        );

        // ✅ 2. Wait a bit for message delivery
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      if (remoteWebcamRef.current) {
        remoteWebcamRef.current.srcObject = null;
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // ✅ 7. Update state
      setReadyWebRtcConnect(true);
      setError(null);

      console.log("✅ Disconnect complete");
    } catch (err: unknown) {
      console.error("❌ Disconnect error:", err);
      setError(`Disconnect failed: ${(err as Error).message}`);
    }
  };

  return {
    localWebcamRef,
    remoteWebcamRef,
    makeOffer,
    disconnect,
    readyWebRtcConnect,
    error,
  };
};

export default UseWebRtc;
