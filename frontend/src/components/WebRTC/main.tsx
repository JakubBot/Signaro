import Camera from "@/components/WebRTC/Camera";
import useWebRtc from "@/hooks/useWebRtc";
import { useRef, useState } from "react";

const WebRtc = () => {
  const {
    localWebcamRef,
    remoteWebcamRef,
    makeOffer,
    isConnected,
    error,
    disconnect,
  } = useWebRtc();

  return (
    <>
      <Camera
        localWebcamRef={localWebcamRef}
        remoteWebcamRef={remoteWebcamRef}
        makeOffer={makeOffer}
        socketReady={isConnected}
        disconnect={disconnect}
      />
    </>
  );
};

export default WebRtc;
