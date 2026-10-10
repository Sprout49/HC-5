"""
HC-05 SOS Bot, Geofenced Evacuation & Mesh Relay API.
Handles WhatsApp/Telegram SOS webhooks, Reverse-911 broadcasts, and P2P mesh sync.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time

from simulation.engine import SimulationEngine
from backend.app.realtime.websocket_manager import ws_manager

router = APIRouter(prefix="", tags=["sos_and_broadcast"])

# In-memory store for active evacuation broadcasts and mesh logs
active_evacuations: List[Dict[str, Any]] = []
incoming_sos_messages: List[Dict[str, Any]] = []

class SOSWebhookRequest(BaseModel):
    source: str = Field("whatsapp", description="whatsapp, telegram, or citizen_portal")
    sender_name: Optional[str] = Field(None, description="Sender display name")
    caller_name: Optional[str] = Field(None, description="Alternative sender display name")
    phone: str = Field("+91 98000 00000", description="Contact phone number")
    message: str = Field(..., description="Distress message details")
    lon: float = Field(73.8567, description="Longitude")
    lat: float = Field(18.5204, description="Latitude")
    trapped_count: int = Field(1, description="Number of persons trapped")
    severity: str = Field("CRITICAL", description="Severity level: LOW, MEDIUM, HIGH, CRITICAL")
    media_url: Optional[str] = Field(None, description="Photo or video URL from chat")

class EvacuationBroadcastRequest(BaseModel):
    zone_name: str = Field("Mula-Mutha Flood Corridor", description="Target zone or sector name")
    threat_level: str = Field("CODE RED", description="CODE RED, AMBER, or ALL CLEAR")
    evacuation_order: str = Field(..., description="Actionable order message")
    estimated_population: int = Field(15000, description="Estimated citizens in geofence")
    channels: List[str] = Field(default_factory=lambda: ["CAP_BROADCAST", "SMS_BLAST", "LOUDSPEAKER_DRONES"])

class MeshPacketSyncRequest(BaseModel):
    node_id: str = Field(..., description="Mesh Relay Node ID (e.g. AMB-01-HC05)")
    packets: List[Dict[str, Any]] = Field(default_factory=list, description="Buffered offline incident/telemetry packets")

@router.post("/sos/webhook")
async def ingest_sos_webhook(req: SOSWebhookRequest):
    """
    Simulates incoming WhatsApp / Telegram SOS bot message webhook.
    Directly creates an emergency incident and broadcasts to all dashboards.
    """
    engine = SimulationEngine.get_instance()
    
    # Create incident in engine
    inc = engine.create_incident(
        lon=req.lon,
        lat=req.lat,
        severity=req.severity,
        patient_count=req.trapped_count
    )

    # Enrich incident with SOS webhook metadata
    channel_badge = "📱 WhatsApp SOS" if req.source == "whatsapp" else ("✈️ Telegram SOS" if req.source == "telegram" else "🌐 Citizen Portal")
    inc["source"] = req.source
    effective_name = req.caller_name or req.sender_name or "Anonymous Citizen"
    inc["source"] = req.source
    inc["sender_name"] = effective_name
    inc["caller_name"] = effective_name
    inc["phone"] = req.phone
    inc["caller_notes"] = req.message
    inc["media_url"] = req.media_url
    inc["reported_via"] = channel_badge
    inc["timestamp"] = time.time()

    # Store in recent SOS messages list
    sos_record = {
        "id": f"SOS-{len(incoming_sos_messages)+1:03d}",
        "incident_id": inc.get("incident_id"),
        "source": req.source,
        "sender_name": effective_name, "caller_name": effective_name,
        "phone": req.phone,
        "message": req.message,
        "location": [req.lon, req.lat],
        "trapped_count": req.trapped_count,
        "severity": req.severity,
        "media_url": req.media_url,
        "timestamp": time.time()
    }
    incoming_sos_messages.insert(0, sos_record)
    if len(incoming_sos_messages) > 50:
        incoming_sos_messages.pop()

    # Log critical event
    engine.log_event(
        f"🚨 INCOMING {channel_badge.upper()} [{effective_name}]: \"{req.message}\" ({req.trapped_count} trapped, [{req.lat:.4f}, {req.lon:.4f}]). Incident {inc.get('incident_id')} created.",
        "critical" if req.severity in ["HIGH", "CRITICAL"] else "alert"
    )

    # Keep engine synchronized
    engine.recent_sos_messages = incoming_sos_messages
    engine.active_evacuations = active_evacuations
    state = engine.get_full_state()
    # Add sos_messages to state for live sync
    state["recent_sos_messages"] = incoming_sos_messages
    state["active_evacuations"] = active_evacuations
    await ws_manager.broadcast(state)

    return {
        "status": "success",
        "incident_id": inc.get("incident_id"),
        "sos_record": sos_record,
        "state": state
    }

@router.get("/sos/messages")
async def list_sos_messages():
    """Retrieve recent WhatsApp, Telegram, and Citizen SOS messages."""
    return {"messages": incoming_sos_messages}

@router.post("/evacuation/broadcast")
async def trigger_evacuation_broadcast(req: EvacuationBroadcastRequest):
    """
    Triggers Geo-Fenced Reverse-911 Evacuation Broadcast across the city grid.
    """
    engine = SimulationEngine.get_instance()
    
    broadcast_id = f"EVAC-{int(time.time())}"
    broadcast_data = {
        "id": broadcast_id,
        "zone_name": req.zone_name,
        "threat_level": req.threat_level,
        "evacuation_order": req.evacuation_order,
        "estimated_population": req.estimated_population,
        "channels": req.channels,
        "created_at": time.time(),
        "is_active": True
    }
    
    # Store in active evacuations list
    active_evacuations.insert(0, broadcast_data)

    # Log high-priority EAS event in engine
    engine.log_event(
        f"📢 REVERSE-911 EVACUATION BROADCAST [{req.threat_level}]: {req.zone_name.upper()} — \"{req.evacuation_order}\" (Est. {req.estimated_population:,} citizens notified via {', '.join(req.channels)}).",
        "critical"
    )

    state = engine.get_full_state()
    state["active_evacuations"] = active_evacuations
    state["recent_sos_messages"] = incoming_sos_messages
    await ws_manager.broadcast(state)

    return {
        "status": "broadcast_sent",
        "broadcast": broadcast_data,
        "state": state
    }

@router.post("/evacuation/clear")
async def clear_evacuation_broadcast(broadcast_id: Optional[str] = None):
    """Cancels or resolves an active evacuation broadcast."""
    global active_evacuations
    engine = SimulationEngine.get_instance()
    if broadcast_id:
        active_evacuations = [b for b in active_evacuations if b["id"] != broadcast_id]
    else:
        active_evacuations = []
    
    engine.log_event("🟢 REVERSE-911: Evacuation broadcast warning stood down by Incident Commander.", "info")
    state = engine.get_full_state()
    state["active_evacuations"] = active_evacuations
    state["recent_sos_messages"] = incoming_sos_messages
    await ws_manager.broadcast(state)
    return {"status": "cleared", "active_count": len(active_evacuations)}

@router.get("/evacuation/active")
async def get_active_evacuations():
    return {"evacuations": active_evacuations}

@router.post("/mesh/sync")
async def sync_mesh_packets(req: MeshPacketSyncRequest):
    """
    Ingests packets synced via Bluetooth / P2P mesh relay when an offline node re-establishes connectivity.
    """
    engine = SimulationEngine.get_instance()
    processed_count = 0
    for pkt in req.packets:
        if pkt.get("type") == "INCIDENT":
            pkt_lon = float(pkt.get("lon", 73.8567))
            pkt_lat = float(pkt.get("lat", 18.5204))
            pkt_phone = str(pkt.get("phone", ""))
            
            # Deduplication: Check if an incident already exists at these coordinates (< 35m) or same phone
            already_exists = False
            for existing in engine.incidents:
                e_coords = existing.get("coordinates", [0, 0])
                dist = abs(e_coords[0] - pkt_lon) + abs(e_coords[1] - pkt_lat)
                if (pkt_phone and existing.get("phone") == pkt_phone) or dist < 0.0005:
                    already_exists = True
                    break
            
            if not already_exists:
                patient_cnt = int(pkt.get("trapped_count") or pkt.get("patient_count") or 1)
                inc = engine.create_incident(
                    lon=pkt_lon,
                    lat=pkt_lat,
                    severity=pkt.get("severity", "CRITICAL" if patient_cnt > 2 else "HIGH"),
                    patient_count=patient_cnt
                )
                inc["source"] = pkt.get("source", "citizen_pwa_way2")
                inc["sender_name"] = pkt.get("caller_name", "Offline Citizen")
                inc["phone"] = pkt_phone
                inc["caller_notes"] = pkt.get("message", "Ingested from offline mesh buffer")
                inc["reported_via"] = "📶 Mesh P2P Relay"
                processed_count += 1
            else:
                # Count as processed/re-synced without duplicating
                processed_count += 1
            
    engine.log_event(
        f"📶 MESH RELAY SYNC: Ingested {processed_count} offline packet(s) from peer node {req.node_id}.",
        "info"
    )
    state = engine.get_full_state()
    state["active_evacuations"] = active_evacuations
    state["recent_sos_messages"] = incoming_sos_messages
    await ws_manager.broadcast(state)
    return {"status": "synced", "packets_processed": processed_count}
