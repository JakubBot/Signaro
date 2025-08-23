import { JSX, RefObject } from "react";
import { clsx } from "clsx";
import { css } from "@emotion/react";
import { colorPalette } from "@/components/ui/colorPalette";
import { Button } from "@/components/ui/button";
// import { signIcon } from "@/constants/icons";
interface CameraProps {
  localWebcamRef: RefObject<HTMLVideoElement | null>;
  remoteWebcamRef: RefObject<HTMLVideoElement | null>;
  makeOffer: () => Promise<void>;
  disconnect: () => Promise<void>;
  error?: string | null;
  readyWebRtcConnect?: boolean;
}

const Camera = ({
  localWebcamRef,
  remoteWebcamRef,
  makeOffer,
  disconnect,
  readyWebRtcConnect,
}: CameraProps): JSX.Element => {
  return (
    <>
      <div
        className={clsx(css`
          background: ${colorPalette.lightGray};
        `)}
      >
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

        <Button onClick={makeOffer} disabled={!readyWebRtcConnect}>Zrob polaczenie</Button>
        <Button onClick={disconnect} disabled={readyWebRtcConnect}>Rozlacz</Button>

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
    </>
  );
};

export default Camera;
