from fastapi import FastAPI

app = FastAPI()

@app.get("/api/ai-test")
def read_root():
    return {"message": "Siema!"}
