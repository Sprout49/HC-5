"""
Resource deployment & Medical camp endpoints for HC-05.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from simulation.engine import SimulationEngine
from backend.app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="/resources", tags=["resources"])

class DeployCampRequest(BaseModel):
    zone_id: str

@router.post("/deploy_camp")
async def deploy_camp(req: DeployCampRequest):
    engine = SimulationEngine.get_instance()
    camp = engine.deploy_medical_camp(req.zone_id)
    if not camp:
        raise HTTPException(status_code=400, detail="Invalid zone or camp deployment failed")
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return {"success": True, "camp": camp, "state": state}
