"""
Incident management endpoints for HC-05.
Allows Admin to report emergency cases by clicking on the map.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from simulation.engine import SimulationEngine
from backend.app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="/incidents", tags=["incidents"])

class CreateIncidentRequest(BaseModel):
    lon: float
    lat: float
    severity: str = "HIGH"
    patient_count: int = 1

@router.post("")
async def create_incident(req: CreateIncidentRequest):
    engine = SimulationEngine.get_instance()
    inc = engine.create_incident(req.lon, req.lat, req.severity, req.patient_count)
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return {"incident": inc, "state": state}
