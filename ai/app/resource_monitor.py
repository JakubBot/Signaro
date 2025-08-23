import threading
import psutil
from constant.main import MAX_INFERENCE_WORKERS

class ResourceMonitor:
    def __init__(self):
        self.instance_count = 0
        self.max_instances = MAX_INFERENCE_WORKERS  # Allow 1 extra
        self.lock = threading.Lock()

    def can_create_instance(self):
        with self.lock:
            memory_usage = psutil.virtual_memory().percent
            if memory_usage > 85:  # Don't create if memory > 85%
                print(
                    f"⚠️ High memory usage ({memory_usage:.1f}%), skipping MediaPipe creation"
                )
                return False

            if self.instance_count >= self.max_instances:
                print(
                    f"⚠️ Max MediaPipe instances reached ({self.instance_count}/{self.max_instances})"
                )
                return False

            return True

    def instance_created(self):
        with self.lock:
            self.instance_count += 1
            print(f"📊 MediaPipe instances: {self.instance_count}/{self.max_instances}")

    def instance_destroyed(self):
        with self.lock:
            self.instance_count = max(0, self.instance_count - 1)
