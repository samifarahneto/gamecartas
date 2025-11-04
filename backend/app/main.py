from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import uuid

from .realtime.manager import ConnectionManager
from .deps import init_db


app = FastAPI(title="Card Games Realtime API")

origins = os.getenv("CORS_ORIGINS", "*").split(",")
# Se "*" estiver na lista, permite todas as origens mas sem credentials
# (pois allow_credentials=True não é compatível com allow_origins=["*"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=False if "*" in origins else True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

manager = ConnectionManager()

@app.on_event("startup")
async def on_startup() -> None:
    init_db()


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.get("/api/tables")
async def list_tables() -> JSONResponse:
    """Lista todas as salas/tabelas disponíveis"""
    tables_info = manager.get_tables_info()
    response = JSONResponse(tables_info)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.get("/api/tables/{table_id}")
async def get_table_info(table_id: str) -> JSONResponse:
    """Obtém informações detalhadas de uma sala específica"""
    try:
        table_info = manager.get_table_info(table_id)
        if not table_info:
            response = JSONResponse({"error": "Sala não encontrada"}, status_code=404)
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
        response = JSONResponse(table_info)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception as e:
        import traceback
        print(f"[ERROR] Erro ao obter informações da mesa {table_id}: {e}")
        traceback.print_exc()
        response = JSONResponse({"error": f"Erro interno do servidor: {str(e)}"}, status_code=500)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response


class CreateTableRequest(BaseModel):
    game: str = "holdem"
    name: str = None
    table_id: str = None


@app.post("/api/tables")
async def create_table(request: CreateTableRequest) -> JSONResponse:
    """Cria uma nova mesa"""
    # Gera ID único se não fornecido
    table_id = request.table_id or f"{request.game}-{str(uuid.uuid4())[:8]}"
    
    # Verifica se a mesa já existe
    if table_id in manager.created_tables:
        response = JSONResponse({"error": "Mesa já existe"}, status_code=400)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    
    # Cria a mesa
    table_info = manager.create_table(table_id, request.game, request.name)
    if "error" in table_info:
        response = JSONResponse(table_info, status_code=400)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    
    response = JSONResponse(table_info, status_code=201)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.options("/api/tables")
@app.options("/api/tables/{table_id}")
async def options_handler():
    """Handler para requisições OPTIONS (preflight)"""
    from fastapi.responses import Response
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


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


