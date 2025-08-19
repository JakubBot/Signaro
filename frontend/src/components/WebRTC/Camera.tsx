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
  isConnected: boolean;
  error: string | null;
  cameraReady?: boolean;
}

const Camera = ({
  localWebcamRef,
  remoteWebcamRef,
  makeOffer,
  socketReady,
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

        <Button onClick={makeOffer} disabled={!socketReady}>
          Zrob polaczenie
        </Button>

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
