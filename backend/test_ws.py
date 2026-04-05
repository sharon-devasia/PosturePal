import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/ws/live"
    async with websockets.connect(uri) as ws:
        print("Connected to PosturePal backend")
        while True:
            msg  = await ws.recv()
            data = json.loads(msg)
            print(
                f"Status: {data['status']} | "
                f"Blink: {data['blink_rate']} | "
                f"Confidence: {data['confidence']} | "
                f"Side Angle: {data['side_angle']}"
            )

asyncio.run(test())
