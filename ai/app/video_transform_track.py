import cv2
import mediapipe as mp
from aiortc import MediaStreamTrack
from av import VideoFrame
import asyncio
from concurrent.futures import ThreadPoolExecutor
import threading
import queue
from constant.main import (
    MAX_INFERENCE_WORKERS,
    PROCESS_EVERY_N_FRAMES,
    MAX_PARALLEL_TASKS,
)
import gc
# Pool configuration

inference_semaphore = asyncio.Semaphore(MAX_PARALLEL_TASKS)

mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils
mp_face_mesh = mp.solutions.face_mesh

# GLOBAL SHARED RESOURCES (thread-safe)
_global_executor = None

# Pre-allocated MediaPipe Pool
_mediapipe_pool = None
_pool_lock = threading.Lock()
_pool_initialized = False


def get_global_executor():
    global _global_executor
    if _global_executor is None:
        _global_executor = ThreadPoolExecutor(
            max_workers=MAX_INFERENCE_WORKERS, thread_name_prefix="MediaPipe"
        )
    return _global_executor


def initialize_mediapipe_pool():
    """Initialize the pre-allocated MediaPipe pool"""
    global _mediapipe_pool, _pool_initialized

    if _pool_initialized:
        return

    with _pool_lock:
        if _pool_initialized:  # Double-check locking
            return

        _mediapipe_pool = queue.Queue(maxsize=MAX_INFERENCE_WORKERS)

        # Pre-allocate MediaPipe instances
        for i in range(MAX_INFERENCE_WORKERS):
            try:
                holistic = mp_holistic.Holistic(
                    min_detection_confidence=0.5, min_tracking_confidence=0.5
                )
                _mediapipe_pool.put(holistic)
                print(f"✅ Created MediaPipe instance {i+1}/{MAX_INFERENCE_WORKERS}")
            except Exception as e:
                print(f"❌ Failed to create MediaPipe instance {i+1}: {e}")
                break

        _pool_initialized = True
        print(f"🎉 MediaPipe pool initialized with {_mediapipe_pool.qsize()} instances")


def get_mediapipe_instance():
    """Get a MediaPipe instance from the pool (blocking)"""
    if not _pool_initialized:
        initialize_mediapipe_pool()

    try:
        # Get instance from pool (blocks if empty)
        return _mediapipe_pool.get(timeout=5.0)
    except queue.Empty:
        print("⚠️ MediaPipe pool exhausted, creating temporary instance")
        try:
            temp_instance = mp_holistic.Holistic(
                min_detection_confidence=0.5, min_tracking_confidence=0.5
            )
            return temp_instance
        except Exception as e:
            print(f"❌ Failed to create temporary MediaPipe: {e}")
            return None


def return_mediapipe_instance(instance):
    """Return a MediaPipe instance to the pool"""
    if instance is None:
        return

    try:
        # Only return to pool if there's space (don't block)
        _mediapipe_pool.put_nowait(instance)
    except queue.Full:
        # Pool is full, this might be a temporary instance
        try:
            instance.close()
        except Exception as e:
            print(f"⚠️ Error closing MediaPipe instance: {e}")


def get_pool_status():
    """Get current pool status for monitoring"""
    if not _pool_initialized or _mediapipe_pool is None:
        return {"available": 0, "total": MAX_INFERENCE_WORKERS, "initialized": False}

    return {
        "available": _mediapipe_pool.qsize(),
        "total": MAX_INFERENCE_WORKERS,
        "initialized": True,
        "in_use": MAX_INFERENCE_WORKERS - _mediapipe_pool.qsize(),
    }


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
        ) and not self._stopped and len(self._tasks) < MAX_INFERENCE_WORKERS 

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
        """Thread-safe prediction using pool-based MediaPipe instances"""
        holistic = None
        try:
            # Get instance from pool
            holistic = get_mediapipe_instance()
            if holistic is None:
                return img  # Return original frame if no instance available

            output_img, results = mediapipe_detection(img, holistic)
            draw_styled_landmarks(output_img, results)
            return output_img

        except Exception as e:
            print(f"MediaPipe prediction error: {e}")
            return img
        finally:
            # Always return instance to pool
            if holistic is not None:
                return_mediapipe_instance(holistic)

    async def _stopVideoTransformTrack(self):
        self._stopped = True
        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        self._tasks.clear()
        self._latest_result = None


def cleanup_global_resources():
    """Cleanup pre-allocated MediaPipe pool and executor"""
    global _global_executor, _mediapipe_pool, _pool_initialized

    print("🧹 Starting cleanup of global resources...")

    # Cleanup executor
    if _global_executor:
        try:
            _global_executor.shutdown(wait=True)
            print("✅ ThreadPoolExecutor cleaned up")
        except Exception as e:
            print(f"⚠️ ThreadPoolExecutor cleanup error: {e}")
        finally:
            _global_executor = None

    # Cleanup MediaPipe pool
    cleanup_count = 0
    if _mediapipe_pool is not None:
        with _pool_lock:
            while not _mediapipe_pool.empty():
                try:
                    instance = _mediapipe_pool.get_nowait()
                    instance.close()
                    cleanup_count += 1
                except (queue.Empty, Exception) as e:
                    if not isinstance(e, queue.Empty):
                        print(f"⚠️ Pool instance cleanup error: {e}")
                    break

            _mediapipe_pool = None
            _pool_initialized = False

    print(f"✅ Cleaned up {cleanup_count} MediaPipe instances")
    print("🎉 Global cleanup completed")


# Auto-initialize pool on module import
print("🔄 Auto-initializing MediaPipe pool...")
initialize_mediapipe_pool()
print(f"📊 Current instance count: {_mediapipe_pool.qsize() if _mediapipe_pool else 0}")
print(
    f"📏 Len pcs: {_mediapipe_pool.qsize() if _mediapipe_pool else 0}"
)  # User's requested monitoring
