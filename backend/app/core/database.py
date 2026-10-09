import os
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load local environment variables from .env
load_dotenv()

logger = logging.getLogger("hc05.database")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xhlqfasyetxgehlajmbb.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_secret_LBKi4NzirFdfEIC5LtgoYQ_-BXf9CmX")

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase credentials missing. Database sync disabled.")
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"Connected to Supabase project at {SUPABASE_URL}")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


def sync_ambulances_to_db(ambulances: List[Dict[str, Any]]) -> bool:
    """Upsert all fleet ambulances into Supabase ambulances table."""
    client = get_supabase_client()
    if not client:
        return False

    try:
        records = []
        for a in ambulances:
            records.append({
                "ambulance_id": a.get("ambulance_id"),
                "callsign": a.get("callsign", a.get("ambulance_id")),
                "type": a.get("type", "ALS"),
                "status": a.get("status", "AVAILABLE"),
                "assigned_zone": a.get("assigned_zone", "Z1"),
                "base_location": a.get("base_location", [73.8567, 18.5204]),
                "current_location": a.get("current_location", a.get("base_location", [73.8567, 18.5204])),
                "speed_kmh": float(a.get("speed_kmh", 45.0)),
                "patients_onboard": int(a.get("patients_onboard", 0)),
                "patient_capacity": int(a.get("patient_capacity", 2)),
                "password": a.get("password", "demo123"),
            })

        if records:
            res = client.table("ambulances").upsert(records, on_conflict="ambulance_id").execute()
            logger.info(f"Synced {len(records)} ambulances to Supabase")
            return True
    except Exception as e:
        logger.error(f"Error syncing ambulances to Supabase: {e}")
    return False


def load_ambulances_from_db() -> Optional[List[Dict[str, Any]]]:
    """Retrieve all fleet ambulances from Supabase."""
    client = get_supabase_client()
    if not client:
        return None

    try:
        res = client.table("ambulances").select("*").execute()
        if res and res.data:
            logger.info(f"Loaded {len(res.data)} ambulances from Supabase")
            return res.data
    except Exception as e:
        logger.error(f"Error loading ambulances from Supabase: {e}")
    return None


def delete_ambulance_from_db(ambulance_id: str) -> bool:
    """Delete an ambulance from Supabase."""
    client = get_supabase_client()
    if not client:
        return False
    try:
        client.table("ambulances").delete().eq("ambulance_id", ambulance_id).execute()
        logger.info(f"Deleted ambulance {ambulance_id} from Supabase")
        return True
    except Exception as e:
        logger.error(f"Error deleting ambulance {ambulance_id} from Supabase: {e}")
    return False


def log_incident_to_db(inc: Dict[str, Any]) -> bool:
    """Record an incident into Supabase incidents table."""
    client = get_supabase_client()
    if not client:
        return False

    try:
        record = {
            "incident_id": inc.get("incident_id"),
            "coordinates": inc.get("coordinates"),
            "zone_id": inc.get("zone_id", "Z1"),
            "severity": inc.get("severity", "MODERATE"),
            "patient_count": int(inc.get("patient_count", 1)),
            "status": inc.get("status", "PENDING_DISPATCH"),
            "assigned_ambulance_id": inc.get("assigned_ambulance_id"),
            "unreachable_reason": inc.get("unreachable_reason"),
        }
        client.table("incidents").upsert(record, on_conflict="incident_id").execute()
        return True
    except Exception as e:
        logger.error(f"Error saving incident to Supabase: {e}")
    return False


def log_event_to_db(event_time: str, message: str, event_type: str = "info") -> bool:
    """Insert a decision event into Supabase simulation_events table."""
    client = get_supabase_client()
    if not client:
        return False

    try:
        client.table("simulation_events").insert({
            "event_time": event_time,
            "message": message,
            "type": event_type,
        }).execute()
        return True
    except Exception as e:
        logger.debug(f"Error logging event to Supabase: {e}")
    return False
