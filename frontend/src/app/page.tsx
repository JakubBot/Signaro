"use client";
import Image from "next/image";
import styles from "./page.module.css";
import { useEffect, useRef } from "react";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
    // add turn
  ],
  iceCandidatePoolSize: 2,
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
    const pendingCandidates = [];
    const startRecording = async () => {
      const remoteStream = new MediaStream();

      const pc = new RTCPeerConnection(servers) as RTCPeerConnection;
      pcRef.current = pc;


      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err) {
        console.error("getUserMedia failed", err);
        return;
      }

      localStream.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, localStream);
      });

      pcRef.current.ontrack = (event) => {
        console.log('new track', event.track);
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
      };

      if (localWebcamRef.current)
        localWebcamRef.current.srcObject = localStream;

      if (remoteWebcamRef.current)
        remoteWebcamRef.current.srcObject = remoteStream;

      // connection state logging
      pcRef.current.onconnectionstatechange = () => {
        console.log("pc state:", pcRef.current.connectionState);
      };

      pcRef.current.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          console.log("event:", event);

          wsRef.current.send(
            JSON.stringify({ type: "ice", candidate: event.candidate })
          );
        }
      };

      wsRef.current = new WebSocket("ws://backend:8080/stream?client=js"); // signal for spring boot
      // wsRef.current = new WebSocket("ws://backend:8080/stream?client=js"); // signal for spring boot

      wsRef.current.onopen = () => {
        console.log("WebSocket connection established");
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
              await pcRef.current.addIceCandidate();
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

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    wsRef.current?.send(JSON.stringify({ type: "offer", sdp: offer }));
    console.log("offer sent");
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
