// ...existing code...

export default function Home() {
  // ...existing refs...
  const [cameraPermission, setCameraPermission] = useState<string>("prompt"); // "granted" | "denied" | "prompt"
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Sprawdź obecny stan permission
    navigator.permissions.query({ name: 'camera' as PermissionName }).then(permission => {
      setCameraPermission(permission.state);
      permission.onchange = () => setCameraPermission(permission.state);
    });
  }, []);

  useEffect(() => {
    let localStream: MediaStream | null = null;
    const pendingCandidates = [];
    const outQueue: any[] = [];

    const startRecording = async () => {
      const remoteStream = new MediaStream();
      const pc = new RTCPeerConnection(servers) as RTCPeerConnection;
      pcRef.current = pc;

      // ✅ OPÓŹNIJ ICE gathering do momentu gdy camera jest gotowa
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const ci = event.candidate.toJSON();
          console.log("🧊 ICE candidate generated:", ci.type, ci.protocol, ci.address);

          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ice", candidate: ci }));
          } else {
            outQueue.push(ci);
          }
        } else {
          console.log("🏁 ICE gathering complete");
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ice", candidate: null }));
          } else {
            outQueue.push(null);
          }
        }
      };

      pc.ontrack = (event) => {
        console.log("📺 New track received:", event.track.kind);
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
      };

      pc.onconnectionstatechange = () => {
        console.log("🔗 PC connection state:", pc.connectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.log("🧊 ICE gathering state:", pc.iceGatheringState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("🔌 ICE connection state:", pc.iceConnectionState);
      };

      // ✅ POCZEKAJ DŁUŻEJ NA CAMERA PERMISSION
      try {
        console.log("📷 Requesting camera access...");
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        console.log("✅ Camera access granted, adding tracks...");
        
        // ✅ POCZEKAJ CHWILĘ ABY CAMERA SIĘ W PEŁNI ZAINICJALIZOWAŁA
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay

        localStream.getTracks().forEach((track) => {
          console.log("➕ Adding track:", track.kind, track.label);
          pc.addTrack(track, localStream);
        });

        if (localWebcamRef.current) {
          localWebcamRef.current.srcObject = localStream;
          // Poczekaj aż video się załaduje
          await new Promise(resolve => {
            localWebcamRef.current!.onloadedmetadata = resolve;
          });
        }

        console.log("✅ Local video ready");
        
      } catch (err) {
        console.error("❌ getUserMedia failed:", err);
        return;
      }

      if (remoteWebcamRef.current) {
        remoteWebcamRef.current.srcObject = remoteStream;
      }

      // ✅ UTWÓRZ WEBSOCKET DOPIERO PO CAMERA SETUP
      console.log("🔌 Connecting to WebSocket...");
      wsRef.current = new WebSocket("ws://localhost:8080/stream?client=js");

      wsRef.current.onopen = () => {
        console.log("✅ WebSocket connected, flushing queued ICE candidates");
        while (outQueue.length > 0) {
          const candidate = outQueue.shift();
          wsRef.current.send(JSON.stringify({ type: "ice", candidate }));
        }
      };

      wsRef.current.onmessage = async (event) => {
        const msg: SignalMsg = JSON.parse(event.data);
        console.log("📨 Received message:", msg.type);

        if (!pcRef.current) return;

        if (msg.type === "answer") {
          console.log("📝 Setting remote description (answer)");
          const desc = new RTCSessionDescription(msg.sdp);
          await pcRef.current.setRemoteDescription(desc);

          console.log(`🧊 Processing ${pendingCandidates.length} pending ICE candidates`);
          while (pendingCandidates.length > 0) {
            const candidate = pendingCandidates.shift();
            try {
              await pcRef.current.addIceCandidate(candidate);
              console.log("✅ Added pending ICE candidate");
            } catch (e) {
              console.warn("❌ Failed to add pending ICE candidate:", e);
            }
          }
        } else if (msg.type === "ice") {
          const candidate = msg.candidate;
          const rtcCandidate = new RTCIceCandidate(candidate);

          console.log("🧊 Received ICE candidate:", candidate.type, candidate.protocol);
          
          if (!pcRef.current.remoteDescription || !pcRef.current.remoteDescription.type) {
            console.log("📦 Buffering ICE candidate (no remote description)");
            pendingCandidates.push(rtcCandidate);
          } else {
            try {
              await pcRef.current.addIceCandidate(rtcCandidate);
              console.log("✅ Added ICE candidate immediately");
            } catch (e) {
              console.warn("❌ Failed to add ICE candidate:", e);
            }
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
      };

      wsRef.current.onclose = (event) => {
        console.log("🔌 WebSocket closed:", event.code, event.reason);
      };
    };

    startRecording();

    return () => {
      pcRef.current?.close();
      wsRef.current?.close();
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ✅ ULEPSZ makeOffer - poczekaj na camera readiness
  const makeOffer = async () => {
    if (!pcRef.current) {
      console.error("❌ No peer connection");
      return;
    }

    if (cameraPermission !== "granted") {
      console.error("❌ Camera permission not granted");
      alert("Please allow camera access first");
      return;
    }

    setIsConnecting(true);

    try {
      console.log("🚀 Creating offer...");
      
      // ✅ SPRAWDŹ CZY LOCAL TRACKS SĄ GOTOWE
      const senders = pcRef.current.getSenders();
      const activeTracks = senders.filter(sender => sender.track && sender.track.readyState === 'live');
      
      if (activeTracks.length === 0) {
        console.warn("⚠️ No active tracks, waiting...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📹 Active tracks: ${activeTracks.length}`);

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      // ✅ POCZEKAJ CHWILĘ NA ICE GATHERING
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log("📤 Sending offer...");
      wsRef.current?.send(
        JSON.stringify({ type: "offer", sdp: pcRef.current.localDescription })
      );
      
      console.log("✅ Offer sent, ICE candidates will follow...");
      
    } catch (e) {
      console.error("❌ Failed to create/send offer:", e);
    } finally {
      setIsConnecting(false);
    }
  };

  // ...existing getStats...

  return (
    <div className={styles.page}>
      {/* ✅ DODAJ STATUS DISPLAY */}
      <div style={{ marginBottom: "20px", padding: "10px", background: "#f0f0f0" }}>
        <h3>🔗 Connection Status</h3>
        <p>Camera Permission: <strong>{cameraPermission}</strong></p>
        <p>PC State: <strong>{pcRef.current?.connectionState || "new"}</strong></p>
        <p>ICE State: <strong>{pcRef.current?.iceConnectionState || "new"}</strong></p>
        <p>ICE Gathering: <strong>{pcRef.current?.iceGatheringState || "new"}</strong></p>
      </div>

      <h2>Local webcam</h2>
      <video
        ref={localWebcamRef}
        id="localWebcam"
        autoPlay
        playsInline
        style={{ width: "320px", height: "240px" }}
      />

      <button 
        onClick={makeOffer} 
        disabled={isConnecting || cameraPermission !== "granted"}
      >
        {isConnecting 
          ? "🔄 Connecting..." 
          : cameraPermission !== "granted" 
            ? "📷 Allow camera first" 
            : "🚀 Zrób połączenie"
        }
      </button>
      
      <button onClick={getStats}>📊 Stats connection</button>

      <h2>Remote webcam</h2>
      <video
        ref={remoteWebcamRef}
        id="remoteWebcam"
        autoPlay
        playsInline
        style={{ width: "320px", height: "240px" }}
      />
    </div>
  );
}