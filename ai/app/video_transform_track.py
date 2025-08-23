import cv2
import mediapipe as mp
from aiortc import MediaStreamTrack
from av import VideoFrame
import asyncio
from concurrent.futures import ThreadPoolExecutor
from resource_monitor import ResourceMonitor
import threading
from constant.main import MAX_INFERENCE_WORKERS, PROCESS_EVERY_N_FRAMES, MAX_PARALLEL_TASKS

inference_semaphore = asyncio.Semaphore(MAX_PARALLEL_TASKS)

mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils
mp_face_mesh = mp.solutions.face_mesh

# ✅ RUN BASIC CHECKS ON MODULE LOAD
# print("🚀 Loading VideoTransformTrack...")
# check_gpu_availability()
# gpu_works = simple_gpu_test()

# GLOBAL SHARED RESOURCES (thread-safe)
_global_executor = None
_thread_local = threading.local()
_resource_monitor = ResourceMonitor()


def get_global_executor():
    global _global_executor
    if _global_executor is None:
        _global_executor = ThreadPoolExecutor(
            max_workers=MAX_INFERENCE_WORKERS, thread_name_prefix="MediaPipe"
        )
    return _global_executor



def get_thread_holistic():
    """Get MediaPipe instance for current thread with resource monitoring"""
    if not hasattr(_thread_local, "holistic"):

        # ✅ CHECK RESOURCE AVAILABILITY
        if not _resource_monitor.can_create_instance():
            print("⚠️ Resource limit reached, falling back to shared processing")
            return None

        try:
            _thread_local.holistic = mp_holistic.Holistic(
                min_detection_confidence=0.5, min_tracking_confidence=0.5
            )
            _resource_monitor.instance_created()

        except Exception as e:
            print(f"❌ Failed to create MediaPipe: {e}")
            return None
        
    return _thread_local.holistic

def mediapipe_detection(image, model):
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_rgb.flags.writeable = False
    results = model.process(image_rgb)
    image_rgb.flags.writeable = True
    return cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR), results


def draw_styled_landmarks(image, results):
    if results.face_landmarks:
        mp_drawing.draw_landmarks(
            image,
            results.face_landmarks,
            mp_face_mesh.FACEMESH_TESSELATION,
            mp_drawing.DrawingSpec(color=(80, 110, 10), thickness=1, circle_radius=1),
            mp_drawing.DrawingSpec(color=(80, 256, 121), thickness=1, circle_radius=1),
        )
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(
            image,
            results.pose_landmarks,
            mp_holistic.POSE_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(80, 22, 10), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(80, 44, 121), thickness=2, circle_radius=2),
        )
    if results.left_hand_landmarks:
        mp_drawing.draw_landmarks(
            image,
            results.left_hand_landmarks,
            mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(121, 22, 76), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(121, 44, 250), thickness=2, circle_radius=2),
        )
    if results.right_hand_landmarks:
        mp_drawing.draw_landmarks(
            image,
            results.right_hand_landmarks,
            mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(245, 117, 66), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(245, 66, 230), thickness=2, circle_radius=2),
        )


def cleanup_global_resources():
    global _global_executor

    if _global_executor:
        _global_executor.shutdown(wait=True)
        _global_executor = None

    try:
        if hasattr(_thread_local, "holistic"):
            _thread_local.holistic.close()
            delattr(_thread_local, "holistic")
            _resource_monitor.instance_destroyed()
    except Exception as e:
        print(f"Global cleanup error: {e}")


class VideoTransformTrack(MediaStreamTrack):
    kind = "video"

    def __init__(self, track):
        super().__init__()
        self._track = track
        self._counter = 0
        self._latest_result = None
        self._tasks = set()
        self._stopped = False

    async def recv(self):
        frame = await self._track.recv()
        img = frame.to_ndarray(format="bgr24")
        self._counter += 1

        should_schedule = (
            self._counter % PROCESS_EVERY_N_FRAMES == 0 or self._latest_result is None
        ) and not self._stopped

        if should_schedule:
            task = asyncio.create_task(self._schedule_prediction(img.copy()))
            self._tasks.add(task)

            def _done_cb(t: asyncio.Task):
                self._tasks.discard(t)

            task.add_done_callback(_done_cb)

        output = self._latest_result if self._latest_result is not None else img
        new_frame = VideoFrame.from_ndarray(output, format="bgr24")
        new_frame.pts = frame.pts
        new_frame.time_base = frame.time_base
        return new_frame

    async def _schedule_prediction(self, img):
        async with inference_semaphore:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                get_global_executor(), self._sync_predict, img
            )
            if result is not None:
                self._latest_result = result

    def _sync_predict(self, img):
        try:
            # thread safety
            holistic = get_thread_holistic()
            if holistic is None:  # Resource limit reached
                return img  # Return original frame

            output_img, results = mediapipe_detection(img, holistic)
            draw_styled_landmarks(output_img, results)
            return output_img
        except Exception as e:
            print("MediaPipe prediction error:", e)
            return img

    async def _stopVideoTransformTrack(self):
        self._stopped = True
        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        # loop = asyncio.get_running_loop()
        # await loop.run_in_executor(None, self._executor.shutdown, True)
        self._tasks.clear()
        self._latest_result = None
