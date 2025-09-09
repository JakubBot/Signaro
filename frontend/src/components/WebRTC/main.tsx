import Camera from "@/components/WebRTC/Camera";
import useWebRtc from "@/hooks/useWebRtc";
import { useEffect, useRef, useState } from "react";
import TranslateInput from "@/components/ui/TranslateInput";
import ContentWrapper from "@/components/ui/ContentWrapper";
import { Button } from "@/components/ui/shadcn/button";
import { set } from "zod";

const WebRtc = () => {
  const [inputText, setInputText] = useState<string>("");
  const {
    localWebcamRef,
    remoteWebcamRef,
    makeOffer,
    error,
    disconnect,
    readyWebRtcConnect,
  } = useWebRtc();


  return (
    <ContentWrapper
      margin="0 auto"
      maxWidth="1400px"
      width="100%"
      direction="column"
      padding="40px"
      align="center"
    >
      <ContentWrapper gap="10px" direction="column">
        <ContentWrapper gap="10px" direction="row">
          <Camera
            title="Webcam"
            localWebcamRef={localWebcamRef}
            remoteWebcamRef={remoteWebcamRef}
          />
          <TranslateInput
            title="English"
            value={inputText}
            onChange={setInputText}
          />
        </ContentWrapper>
        <ContentWrapper gap="5px" align="center" direction="row">
          <Button onClick={makeOffer} disabled={!readyWebRtcConnect}>
            Start translating
          </Button>
          <Button onClick={disconnect} disabled={readyWebRtcConnect}>
            Stop translating
          </Button>
        </ContentWrapper>
      </ContentWrapper>
    </ContentWrapper>
  );
};

export default WebRtc;
