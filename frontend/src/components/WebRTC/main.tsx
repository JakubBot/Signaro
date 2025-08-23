import Camera from "@/components/WebRTC/Camera";
import useWebRtc from "@/hooks/useWebRtc";
import { useRef, useState } from "react";

const WebRtc = () => {
  const {
    localWebcamRef,
    remoteWebcamRef,
    makeOffer,
    error,
    disconnect,
    readyWebRtcConnect,
  } = useWebRtc();

  return (
    <>
      <Camera
        localWebcamRef={localWebcamRef}
        remoteWebcamRef={remoteWebcamRef}
        makeOffer={makeOffer}
        disconnect={disconnect}
        readyWebRtcConnect={readyWebRtcConnect}
      />
    </>
  );
};

export default WebRtc;
