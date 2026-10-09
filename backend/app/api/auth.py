"""
Authentication endpoints for HC-05.
Covers separate authentication for Central Administrators and Ambulance First Responders.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from simulation.engine import SimulationEngine

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/admin/login")
def admin_login(req: LoginRequest):
    if req.username.strip().lower() == "admin" and req.password == "admin123":
        return {
            "success": True,
            "role": "admin",
            "token": "hc05-admin-session-token",
            "user": {
                "name": "Central Command Lead",
                "role": "admin",
                "username": "admin"
            },
            "message": "Welcome Administrator"
        }
    raise HTTPException(status_code=401, detail="Invalid administrator username or password")

@router.post("/ambulance/login")
def ambulance_login(req: LoginRequest):
    aid = req.username.strip().upper()
    engine = SimulationEngine.get_instance()
    creds = engine.get_ambulance_credentials()
    
    if aid in creds and creds[aid] == req.password:
        amb = next((a for a in engine.ambulances if a["ambulance_id"] == aid), None)
        return {
            "success": True,
            "role": "ambulance",
            "ambulance_id": aid,
            "callsign": amb.get("callsign", aid) if amb else aid,
            "token": f"hc05-amb-token-{aid}",
            "ambulance": amb,
            "message": f"Welcome {aid} First Responder"
        }
    raise HTTPException(status_code=401, detail="Invalid ambulance Unit ID or password")

@router.get("/ambulances")
def list_available_ambulances():
    engine = SimulationEngine.get_instance()
    creds = engine.get_ambulance_credentials()
    return [
        {
            "ambulance_id": a["ambulance_id"],
            "callsign": a.get("callsign", a["ambulance_id"]),
            "type": a.get("type", "ALS"),
            "status": a.get("status", "AVAILABLE"),
            "assigned_zone": a.get("assigned_zone", "Z1"),
            "password": creds.get(a["ambulance_id"], a.get("password", "demo123"))
        }
        for a in engine.ambulances
    ]
