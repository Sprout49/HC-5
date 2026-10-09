"""
Authentication endpoints for HC-05.
Demonstration accounts for Admin and Ambulances.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

DEMO_AMBULANCES = {
    "AMB-01": "demo123",
    "AMB-02": "demo123",
    "AMB-03": "demo123",
    "AMB-04": "demo123"
}

@router.post("/admin/login")
def admin_login(req: LoginRequest):
    if req.username == "admin" and req.password == "admin123":
        return {
            "success": True,
            "role": "admin",
            "token": "demo-admin-token-xyz",
            "message": "Welcome Administrator"
        }
    raise HTTPException(status_code=401, detail="Invalid administrator credentials")

@router.post("/ambulance/login")
def ambulance_login(req: LoginRequest):
    aid = req.username.upper().strip()
    if aid in DEMO_AMBULANCES and DEMO_AMBULANCES[aid] == req.password:
        return {
            "success": True,
            "role": "ambulance",
            "ambulance_id": aid,
            "token": f"demo-amb-token-{aid}",
            "message": f"Welcome {aid} Operator"
        }
    raise HTTPException(status_code=401, detail="Invalid ambulance ID or password")
