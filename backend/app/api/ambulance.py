"""
Ambulance driver workflow endpoints for HC-05.
Covers: Call acceptance, Patient pickup, Hospital route selection.
"""

from fastapi import APIRouter, HTTPException
from simulation.engine import SimulationEngine
from backend.app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="/ambulance", tags=["ambulance"])

@router.post("/{ambulance_id}/accept")
async def accept_call(ambulance_id: str):
    engine = SimulationEngine.get_instance()
    success = engine.ambulance_accept_call(ambulance_id)
    if not success:
        raise HTTPException(status_code=400, detail="Unable to accept call for ambulance")
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return {"success": True, "message": f"{ambulance_id} en route to patient", "state": state}

@router.post("/{ambulance_id}/pickup")
async def pickup_patient(ambulance_id: str):
    engine = SimulationEngine.get_instance()
    hosp_rec = engine.ambulance_patient_picked_up(ambulance_id)
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return {
        "success": True,
        "hospital_recommendation": hosp_rec,
        "state": state
    }

@router.post("/{ambulance_id}/start_hospital_route")
async def start_hospital_route(ambulance_id: str):
    engine = SimulationEngine.get_instance()
    success = engine.ambulance_start_hospital_route(ambulance_id)
    if not success:
        raise HTTPException(status_code=400, detail="No hospital route prepared")
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return {"success": True, "message": f"{ambulance_id} en route to hospital", "state": state}
