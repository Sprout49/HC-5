"""
Simulation control endpoints for HC-05.
Controls timer, scenario, fleet positioning, and demo loading.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from simulation.engine import SimulationEngine
from backend.app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="/simulation", tags=["simulation"])

class SpeedRequest(BaseModel):
    speed: float

class ScenarioRequest(BaseModel):
    scenario: str

@router.get("/state")
def get_state():
    engine = SimulationEngine.get_instance()
    return engine.get_full_state()

@router.post("/start")
async def start_sim():
    engine = SimulationEngine.get_instance()
    engine.is_running = True
    engine.log_event("Simulation STARTED.", "info")
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return state

@router.post("/pause")
async def pause_sim():
    engine = SimulationEngine.get_instance()
    engine.is_running = False
    engine.log_event("Simulation PAUSED.", "info")
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return state

@router.post("/step")
async def step_sim():
    engine = SimulationEngine.get_instance()
    engine.step(10.0)
    engine.log_event("Manual step forward +10 minutes.", "info")
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return state

@router.post("/reset")
async def reset_sim():
    engine = SimulationEngine.get_instance()
    engine.load_initial_state()
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return state

@router.post("/speed")
async def set_speed(req: SpeedRequest):
    engine = SimulationEngine.get_instance()
    engine.sim_speed = req.speed
    engine.log_event(f"Simulation speed set to {req.speed}x.", "info")
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return state

@router.post("/scenario")
async def set_scenario(req: ScenarioRequest):
    engine = SimulationEngine.get_instance()
    engine.scenario_name = req.scenario
    engine.log_event(f"Hazard scenario changed to {req.scenario}.", "alert")
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return state

@router.post("/load_demo")
async def load_demo():
    engine = SimulationEngine.get_instance()
    engine.load_demo_scenario()
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return state

@router.post("/position_fleet")
async def position_fleet():
    engine = SimulationEngine.get_instance()
    engine.position_fleet()
    state = engine.get_full_state()
    await ws_manager.broadcast(state)
    return state
