"use client";
import Image from "next/image";
import styles from "./page.module.css";
import { useEffect, useRef, useState } from "react";
import { log } from "console";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
    // add turn
  ],
  iceCandidatePoolSize: 20,
  // iceCandidatePoolSize: 2,
};

type SignalMsg =
  | { type: "offer"; sdp: any; from?: string; to?: string }
  | { type: "answer"; sdp: any; from?: string; to?: string }
  | { type: "ice"; candidate: any; from?: string; to?: string }
  | { type: "ready"; from?: string };

export default function Home() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localWebcamRef = useRef<HTMLVideoElement | null>(null);
  const remoteWebcamRef = useRef<HTMLVideoElement | null>(null);

  // https://chatgpt.com/c/689dcbe6-468c-832e-aa06-2d382cac3cb6

  useEffect(() => {
    let localStream: MediaStream | null = null;

    const pendingCandidates = []; // queue for pending ICE candidates
    const outQueue: any[] = []; // queue for outgoing ICE candidates

    const startRecording = async () => {
      const remoteStream = new MediaStream();

      // 1) Create PC and register handlers BEFORE any offer
      const pc = new RTCPeerConnection(servers) as RTCPeerConnection;
      pcRef.current = pc;

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
            wsRef.current.send(JSON.stringify({ type: "ice", candidate: ci }));
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

      // 2) getUserMedia and add tracks BEFORE createOffer
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });

        if (localWebcamRef.current)
          localWebcamRef.current.srcObject = localStream;
      } catch (err) {
        console.error("getUserMedia failed", err);
        return;
      }

      if (remoteWebcamRef.current)
        remoteWebcamRef.current.srcObject = remoteStream;

      // 3) create/open websocket and set onmessage BEFORE sending offer
      wsRef.current = new WebSocket("ws://localhost:8080/stream?client=js"); // signal for spring boot

      wsRef.current.onopen = () => {
        console.log("WebSocket connection established");

        while (outQueue.length > 0) {
          const candidate = outQueue.shift();
          if (candidate) {
            wsRef.current.send(JSON.stringify({ type: "ice", candidate }));
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

  return (
    <div className={styles.page}>
      <h2>Local webcam</h2>
      <video
        ref={localWebcamRef}
        id="localWebcam"
        autoPlay
        playsInline
        style={{
          width: "320px",
          height: "240px",
        }}
      ></video>

      <button onClick={makeOffer}>Zrob polaczenie</button>

      <h2>Remote webcam</h2>
      <video
        ref={remoteWebcamRef}
        id="remoteWebcam"
        autoPlay
        playsInline
        style={{
          width: "320px",
          height: "240px",
        }}
      ></video>
    </div>
  );
}
