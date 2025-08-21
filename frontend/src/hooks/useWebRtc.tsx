import servers from "@/constants/webrtc";
import { RefObject, useEffect, useRef, useState } from "react";

interface UseWebRtcReturn {
  localWebcamRef: RefObject<HTMLVideoElement | null>;
  remoteWebcamRef: RefObject<HTMLVideoElement | null>;
  makeOffer: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: boolean;
  error: string | null;
}

const UseWebRtc = (): UseWebRtcReturn => {
  const localWebcamRef = useRef<HTMLVideoElement | null>(null);
  const remoteWebcamRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let localStream: MediaStream | null = null;

    const pendingCandidates = []; // queue for pending ICE candidates
    const outQueue: any[] = []; // queue for outgoing ICE candidates

    const startRecording = async () => {
      // 1) getUserMedia / Important it has to be first
      try {
        setError(null);

        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
          },
          audio: false,
        });

        const remoteStream = new MediaStream();

        // 2) Create PC and register handlers BEFORE any offer
        const pc = new RTCPeerConnection(servers) as RTCPeerConnection;
        pcRef.current = pc;

        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });

        pc.ontrack = (event) => {
          console.log("new track", event.track);
          event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
          });
        };

        // connection state logging
        pc.onconnectionstatechange = () => {
          console.log("pc state:", pc.connectionState);
        };

        pc.onicecandidate = (event) => {
          // event.candidate === null => gathering finished

          if (event.candidate) {
            const ci = event.candidate.toJSON();

            if (wsRef.current?.readyState === WebSocket.OPEN) {
              console.log("Sending ICE candidate:", ci);
              wsRef.current.send(
                JSON.stringify({ type: "ice", candidate: ci })
              );
            } else {
              outQueue.push(ci);
            }
          } else {
            // opcjonalnie poinformuj serwer że ICE gathering się zakończyło
            // (przydaje się gdy serwer czeka na koniec)
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({ type: "ice", candidate: null })
              );
            } else {
              outQueue.push(null);
            }
          }
        };

        if (localWebcamRef.current) {
          localWebcamRef.current.srcObject = localStream;
        }
        if (remoteWebcamRef.current) {
          remoteWebcamRef.current.srcObject = remoteStream;
        }

        // 3) create/open websocket and set onmessage BEFORE sending offer
        wsRef.current = new WebSocket("ws://localhost:8080/stream?client=js"); // signal for spring boot

        wsRef.current.onopen = () => {
          setIsConnected(true);
          while (outQueue.length > 0) {
            const candidate = outQueue.shift();
            if (candidate) {
              wsRef.current?.send(JSON.stringify({ type: "ice", candidate }));
            }
          }
        };

        wsRef.current.onmessage = async (event) => {
          const msg: SignalMsg = JSON.parse(event.data);

          console.log("msg", msg);

          if (!pcRef.current) return;

          if (msg.type === "answer") {
            console.log("Received answer");
            const desc = new RTCSessionDescription(msg.sdp);
            await pcRef.current.setRemoteDescription(desc);

            while (pendingCandidates.length > 0) {
              const candidate = pendingCandidates.shift();

              try {
                await pcRef.current.addIceCandidate(candidate);
              } catch (e) {
                console.warn("addIceCandidate (flushed) failed:", e);
              }
              // await pcRef.current.addIceCandidate(candidate);
            }
          } else if (msg.type === "ice") {
            const candidate = msg.candidate;
            console.log("Received ICE candidate", msg.candidate);
            // pendingCandidates
            if (
              !pcRef.current.remoteDescription ||
              !pcRef.current.remoteDescription.type
            ) {
              pendingCandidates.push(candidate);
            } else {
              try {
                await pcRef.current.addIceCandidate(candidate);
              } catch (e) {
                console.warn("addIceCandidate error:", e);
              }
            }
          } else if (msg.type === "offer") {
            // jeśli chcesz, klient może też odpowiadać na offer (role zmienne)
            console.log("Received offer (not expected in this flow)");
          }
        };

        wsRef.current.onerror = () => {
          setError("WebSocket connection failed");
          setIsConnected(false);
        };
      } catch (err) {
        setError(err.message || "Setup failed");
      }
    };

    startRecording();

    return () => {
      pcRef.current?.close();
      wsRef.current?.close();
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const makeOffer = async () => {
    if (!pcRef.current) return;

    try {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      // wysyłamy ofertę natychmiast
      wsRef.current?.send(
        JSON.stringify({ type: "offer", sdp: pcRef.current.localDescription })
      );
      console.log("offer sent (trickle ICE mode)");
    } catch (e) {
      console.error("Failed to create/send offer:", e);
    }

    // // poczekaj na zakończenie zbierania ICE lub timeout
    // await new Promise<void>((resolve) => {
    //   console.log(
    //     "pcRef.current!.iceGatheringState",
    //     pcRef.current!.iceGatheringState
    //   );
    //   if (pcRef.current!.iceGatheringState === "complete") {
    //     resolve();
    //     return;
    //   }

    //   const timeout = setTimeout(() => {
    //     console.warn("iceGathering timeout, sending offer anyway");
    //     pcRef.current?.removeEventListener("icegatheringstatechange", onChange);
    //     resolve();
    //   }, 2000); // 2s fallback

    //   function onChange() {
    //     console.log(
    //       "pcRef.current!.iceGatheringState",
    //       pcRef.current!.iceGatheringState
    //     );
    //     if (pcRef.current!.iceGatheringState === "complete") {
    //       clearTimeout(timeout);
    //       pcRef.current?.removeEventListener(
    //         "icegatheringstatechange",
    //         onChange
    //       );
    //       resolve();
    //     }
    //   }

    //   pcRef.current!.addEventListener("icegatheringstatechange", onChange);
    // });
  };

  const disconnect = async () => {
    await wsRef.current?.send(
      JSON.stringify({ type: "close", from: "a89das687cz" })
    );
  };

  return {
    localWebcamRef,
    remoteWebcamRef,
    makeOffer,
    disconnect,
    isConnected,
    error,
  };
};

export default UseWebRtc;
