import tensorflow as tf
import cv2
from aiortc import (
    MediaStreamTrack,
)
from av import VideoFrame
from config import MAX_INFERENCE_WORKERS
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import asyncio
import traceback

PROCESS_EVERY_N_FRAMES = 2  # process second frame

inference_semaphore = asyncio.Semaphore(MAX_INFERENCE_WORKERS * 2)
letters = list(
    "ABCDEFGHIKLMNOPQRSTUVWXY  "
)  # J and Z are missing, spaces are needed so the code doesnt throw error


def load_model_and_warmup(model_path: str):
    """Wczyta model Keras i wykona jednorazowy warm-up."""
    model_instance = tf.keras.models.load_model(model_path, compile=False)

    @tf.function
    def predict_function(tensor):
        return model_instance(tensor, training=False)

    # warm-up
    dummy_input = np.zeros((1, 28, 28, 1), dtype=np.float32)
    _ = predict_function(tf.convert_to_tensor(dummy_input))
    return model_instance, predict_function


model, predict_fn = load_model_and_warmup("app/keras_model/model.keras")


class VideoTransformTrack(MediaStreamTrack):
    kind = "video"

    def __init__(self, track):
        super().__init__()
        self._track = track
        self._counter = 0
        self._latest_result = None
        self._tasks = set()
        self._executor = ThreadPoolExecutor(max_workers=MAX_INFERENCE_WORKERS)
        self._stopped = False

    async def recv(self):
        if self._stopped:
            print(f"🛑 Track stopped, returning None")
            raise Exception("Track has been stopped")

        try:
            frame = await self._track.recv()
            img = frame.to_ndarray(format="bgr24")
            self._counter += 1

            should_schedule = (
                (self._counter % PROCESS_EVERY_N_FRAMES == 0)
                or (self._latest_result is None)
            ) and not self._stopped and (len(self._tasks) < MAX_INFERENCE_WORKERS)
            # schedule if its: not stopped, executor has free slots, its PROCESS_EVERY_N_FRAMES frame or there is no latest result
            if should_schedule:
                XTest = self._preprocess_frame(img)

                task = asyncio.create_task(
                    self._schedule_prediction(XTest, img.shape[1], img.shape[0])
                )
                self._tasks.add(task)

                def _done_cb(t: asyncio.Task):
                    try:
                        if t.cancelled():
                            print("Prediction task cancelled")
                        else:
                            exc = t.exception()
                            if exc:
                                print("Prediction task raised:", exc)
                    finally:
                        self._tasks.discard(t)

                task.add_done_callback(_done_cb)

            output = self._build_output(img)
            new_frame = VideoFrame.from_ndarray(output, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        except Exception as e:
            if self._stopped:
                print(f"🛑 Track stopped during processing: {e}")
                return None

            print(f"ERROR in recv() frame {self._counter}: {e}")
            print(f"Exception type: {type(e)}")
            traceback.print_exc()
            raise  # Re-raise to see full error

    def _preprocess_frame(self, img: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY)
        norm = (gray / 255.0).astype(np.float32)
        resized = cv2.resize(norm, (28, 28), interpolation=cv2.INTER_AREA)
        return resized.reshape(1, 28, 28, 1)

    def _build_output(self, img: np.ndarray) -> np.ndarray:
        if self._latest_result is None:
            return img

        # out = img.copy() # Here we can just return original image
        out = self._latest_result["display"].copy()
        letter = self._latest_result.get("letter")
        if letter:
            cv2.putText(
                out,
                f"Class: {letter}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 0, 255),
                2,
            )
        return out

    async def _schedule_prediction(self, XTest: np.ndarray, imgWidth, imgHeight):
        async with inference_semaphore:
            loop = asyncio.get_running_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor, self._sync_predict, XTest, imgWidth, imgHeight
                ),
                timeout=1.0,
            )  # waiting for maximum 1s
            if result is not None:
                self._latest_result = result
            return result

    def _sync_predict(self, XTest, imgWidth, imgHeight):
        try:
            tensor = tf.convert_to_tensor(XTest, dtype=tf.float32)
            predictions = predict_fn(tensor)
            predicted_class = tf.argmax(predictions, axis=1).numpy()

            letter = letters[predicted_class[0]]
            XTest_display = (XTest[0, :, :, 0] * 255).astype(np.uint8)  # float -> uint8
            XTest_display = cv2.resize(
                XTest_display, (imgWidth, imgHeight)
            )  # opcjonalnie skalowanie
            XTest_display = cv2.cvtColor(
                XTest_display, cv2.COLOR_GRAY2BGR
            )  # na 3 kanały BGR
            return {"letter": letter, "display": XTest_display}
        except Exception as e:
            print("Prediction error:", e)
            return None

    async def stop(self):
        self._stopped = True

        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()

        try:
            await asyncio.wait(tasks, timeout=3)
        except Exception:
            pass

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._executor.shutdown, True)

        self._tasks.clear()
        self._latest_result = None
