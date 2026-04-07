from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from engine import PostureEngine

router = APIRouter()
engine = PostureEngine()

@router.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await engine.start(websocket)
