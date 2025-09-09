import { JSX, RefObject } from "react";
import { clsx } from "clsx";
import { css } from "@emotion/react";
import { colorPalette } from "@/components/ui/colorPalette";
import { Button } from "@/components/ui/shadcn/button";
import { typography } from "@/components/ui/typography";
import ContentWrapper from "@/components/ui/ContentWrapper";
import { cameraSize } from "@/constants/webrtc";

interface CameraProps {
  localWebcamRef: RefObject<HTMLVideoElement | null>;
  remoteWebcamRef: RefObject<HTMLVideoElement | null>;
  error?: string | null;
  title?: string;
}

const Camera = ({
  localWebcamRef,
  remoteWebcamRef,
  title,
}: CameraProps): JSX.Element => {
  return (
    <div>
      <ContentWrapper gap="5px" direction="column">
        <h4 css={typography.textL}>{title || "Local webcam"}</h4>
        <video
          ref={localWebcamRef}
          id="localWebcam"
          autoPlay
          playsInline
          css={css`
            border-radius: var(--radius);
            width: ${cameraSize.width}px;
            height: ${cameraSize.height}px;
            background-color: black;
          `}
        ></video>
      </ContentWrapper>

      {/* <div
        css={css`
          position: absolute;
          bottom: 10px;
          right: 10px;
        `}
      >
        ONLY IN DEV
        <h2>Remote webcam</h2>
        <video
          ref={remoteWebcamRef}
          id="remoteWebcam"
          autoPlay
          playsInline
          css={css`
            width: 400px;
            height: auto;
            background-color: black;
          `}
        ></video>
      </div> */}
    </div>
  );
};

export default Camera;
