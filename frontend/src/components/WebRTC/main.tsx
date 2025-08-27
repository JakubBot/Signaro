import Camera from "@/components/WebRTC/Camera";
import useWebRtc from "@/hooks/useWebRtc";
import { useRef, useState } from "react";
import MainContainer from "@/components/ui/MainContainer";
import TranslateSection from "@/components/ui/TranslateSection";

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
    <MainContainer>
      <TranslateSection>
        <Camera
          localWebcamRef={localWebcamRef}
          remoteWebcamRef={remoteWebcamRef}
          makeOffer={makeOffer}
          disconnect={disconnect}
          readyWebRtcConnect={readyWebRtcConnect}
        />
      </TranslateSection>
    </MainContainer>
  );
};

export default WebRtc;
