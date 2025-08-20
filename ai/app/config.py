SIGNALING_URI = "ws://backend:8080/stream?client=python"  # <-- change if different
WAIT_FOR_TRACK_SECONDS = 5  # wait for incoming track before creating answer (seconds)
RECONNECT_DELAY_SECONDS = 3

MAX_INFERENCE_WORKERS = 2 # for now make sure it works for 2 users * 2 
