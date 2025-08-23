import psutil
import cv2
import mediapipe as mp
import asyncio

def check_gpu_availability():
    """Check GPU using only existing libraries"""
    print("\n🔍 GPU CHECK:")
    
    # ✅ TensorFlow GPU Check
    try:
        import tensorflow as tf
        
        # Check if TensorFlow can see GPU
        gpus = tf.config.list_physical_devices('GPU')
        print(f"  📊 TensorFlow GPUs: {len(gpus)}")
        
        if gpus:
            for i, gpu in enumerate(gpus):
                print(f"    GPU {i}: {gpu}")
                
            # ✅ Enable memory growth to prevent GPU memory issues
            try:
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                print("  ✅ TensorFlow GPU memory growth enabled")
            except RuntimeError as e:
                print(f"  ⚠️ Memory growth setup: {e}")
                
            # ✅ Test GPU computation
            try:
                with tf.device('/GPU:0'):
                    test_tensor = tf.random.normal([1000, 1000])
                    result = tf.matmul(test_tensor, test_tensor)
                print("  ✅ GPU computation test passed")
            except Exception as e:
                print(f"  ❌ GPU computation test failed: {e}")
        else:
            print("  ⚠️ No TensorFlow GPUs found")
            
    except ImportError:
        print("  ⚠️ TensorFlow not available")
    except Exception as e:
        print(f"  ❌ TensorFlow GPU error: {e}")
    
    # OpenCV build info
    try:
        build_info = cv2.getBuildInformation()
        has_cuda = 'CUDA' in build_info
        print(f"  👁️ OpenCV CUDA: {has_cuda}")
        print(f"  👁️ OpenCV version: {cv2.__version__}")
    except Exception as e:
        print(f"  ❌ OpenCV check failed: {e}")
    
    # MediaPipe version
    try:
        print(f"  🎭 MediaPipe version: {mp.__version__}")
    except Exception as e:
        print(f"  ❌ MediaPipe check failed: {e}")
    
    # System info
    try:
        print(f"  💻 CPU cores: {psutil.cpu_count()}")
        print(f"  🧠 Total RAM: {psutil.virtual_memory().total / 1024**3:.1f} GB")
    except Exception as e:
        print(f"  ❌ System check failed: {e}")


def simple_gpu_test():
    """Test if MediaPipe can initialize properly"""
    print("🧪 MEDIAPIPE GPU TEST:")
    try:
        # Try to create MediaPipe model
        holistic = mp.solutions.holistic.Holistic(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        print("  ✅ MediaPipe Holistic created successfully")
        
        # Try to close it
        holistic.close()
        print("  ✅ MediaPipe Holistic closed successfully")
        
        return True
    except Exception as e:
        print(f"  ❌ MediaPipe test failed: {e}")
        return False
      
      
      
      
async def monitoring_task():
    """Call check_process_resources() every 5 seconds"""
    print("🔄 Starting resource monitoring (every 5 seconds)...")
    
    while True:
        try:
            # ✅ WYWOŁAJ DOKŁADNIE TWOJĄ FUNKCJĘ
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, check_process_resources)
            
        except Exception as e:
            print(f"❌ Monitoring error: {e}")
        
        # ✅ CZEKAJ 5 SEKUND
        await asyncio.sleep(5)

def check_process_resources():
    """Check current process using only psutil"""
    try:
        process = psutil.Process()
        
        print("📊 PROCESS RESOURCES:")
        print(f"  🧠 Memory: {process.memory_info().rss / 1024**2:.1f} MB")
        print(f"  🔥 CPU percent: {process.cpu_percent()}%") 
        print(f"  🧵 Threads: {process.num_threads()}")
        
        # System-wide stats
        print(f"  🌡️ System CPU: {psutil.cpu_percent()}%")
        print(f"  💾 System RAM: {psutil.virtual_memory().percent}%")
        
    except Exception as e:
        print(f"  ❌ Resource check failed: {e}")