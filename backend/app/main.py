from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os

from .realtime.manager import ConnectionManager
from .deps import init_db


app = FastAPI(title="Card Games Realtime API")

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()

@app.on_event("startup")
async def on_startup() -> None:
    init_db()


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    game = websocket.query_params.get("game")
    table = websocket.query_params.get("table", "new")
    nick = websocket.query_params.get("nick", "guest")
    await manager.connect(websocket, game=game, table=table, nick=nick)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.handle_message(websocket, data)
    except WebSocketDisconnect:
        await manager.disconnect(websocket)


