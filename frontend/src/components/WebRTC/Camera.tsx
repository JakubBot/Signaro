

const Camera = ({
  localWebcamRef,
  remoteWebcamRef,
  makeOffer,
  socketReady,
}) => {
  return (
    <>
      <div>
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

        <button onClick={makeOffer} disabled={!socketReady}>
          Zrob polaczenie
        </button>

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
