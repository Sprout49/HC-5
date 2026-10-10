"""
HC-05 — Climate-Aware Emergency Response Network
Main FastAPI Application & WebSocket Server.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.auth import router as auth_router
from backend.app.api.simulation import router as sim_router
from backend.app.api.incidents import router as incident_router
from backend.app.api.ambulance import router as amb_router
from backend.app.api.resources import router as res_router
from backend.app.api.gis import router as gis_router
from backend.app.api.sos_broadcast import router as sos_router
from backend.app.realtime.websocket_manager import ws_manager
from simulation.engine import SimulationEngine

engine = SimulationEngine.get_instance()

async def simulation_ticker_task():
    """Background ticker running every second to advance active simulation."""
    while True:
        try:
            await asyncio.sleep(1.0)
            if engine.is_running:
                engine.tick(real_dt_seconds=1.0)
                state = engine.get_full_state()
                await ws_manager.broadcast(state)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in simulation ticker: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch simulation ticker
    ticker = asyncio.create_task(simulation_ticker_task())
    yield
    # Shutdown
    ticker.cancel()

app = FastAPI(
    title="HC-05 Emergency Response Network API",
    description="IFRC Climate-Aware Emergency Simulation Backend",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(sim_router, prefix="/api")
app.include_router(incident_router, prefix="/api")
app.include_router(amb_router, prefix="/api")
app.include_router(res_router, prefix="/api")
app.include_router(gis_router, prefix="/api")
app.include_router(sos_router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "HC-05 Emergency Simulation",
        "scenario": engine.scenario_name,
        "is_running": engine.is_running
    }

@app.websocket("/ws/simulation")
async def websocket_simulation_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    # Immediately send the full state upon connection
    await websocket.send_json(engine.get_full_state())
    try:
        while True:
            # Keep connection alive & handle incoming commands if sent over ws
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
