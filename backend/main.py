from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from engine import PostureEngine


# ==========================
# SINGLE ENGINE INSTANCE
# Shared across all connections
# Camera opens once only
# ==========================
engine = PostureEngine()


# ==========================
# LIFESPAN
# Startup and shutdown events
# ==========================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("PosturePal backend starting...")
    print("Ready for monitoring...")
    yield
    # Shutdown
    engine.stop()
    print("PosturePal backend stopped")


# ==========================
# FASTAPI APP
# ==========================
app = FastAPI(lifespan=lifespan)


# ==========================
# CORS
# Allows React on port 5173
# to talk to FastAPI on 8000
# ==========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8081"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True
)


# ==========================
# HEALTH CHECK
# Test if backend is running
# Open browser: localhost:8000/health
# ==========================
@app.get("/health")
def health():
    return {
        "status" : "running",
        "app"    : "PosturePal"
    }


# ==========================
# WEBSOCKET ENDPOINT
# React connects here
# ws://localhost:8000/ws/live
# ==========================
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Frontend connected")

    try:
        await engine.start(websocket)

    except WebSocketDisconnect:
        print("Frontend disconnected")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        engine.running = False
        print("Detection loop stopped")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)