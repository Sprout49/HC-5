import os
import re
"""
Core Shared Simulation World Engine for HC-05.
Manages the single source of truth for disaster progression,
roads, zones, hospitals, ambulances, incidents, routing, and events.
"""

import copy
import json
import math
import time
from typing import List, Dict, Any, Optional

from gis.roads import RoadNetworkGraph
from gis.flood import UrbanFloodEngine
from ml.inference import ModelRegistry
from optimization.dispatch import select_best_ambulance
from optimization.hospital_assignment import select_best_hospital
from optimization.vehicle_positioning import optimize_ambulance_staging
from optimization.resource_allocation import evaluate_medical_camp_needs

class SimulationEngine:
    _instance = None

    def __init__(self):
        self.routing_graph = RoadNetworkGraph()
        self.model_registry = ModelRegistry.get_instance()
        self.flood_engine = UrbanFloodEngine.get_instance()
        
        self.sim_time_minutes = 0.0  # Starts at Day 1, 14:00 (minute 0)
        self.is_running = False
        self.sim_speed = 1.0  # 1x, 2x, 4x, 8x
        self.scenario_name = "MODERATE FLOOD"  # NORMAL, MODERATE FLOOD, SEVERE FLOOD

        self.water_rise_m = 0.0
        self.flood_poly, self.depth_grid, self.flood_polygon_geojson = self.flood_engine.compute_flood_surface(self.water_rise_m)
        self.zones: List[Dict[str, Any]] = []
        self.roads: List[Dict[str, Any]] = []
        self.hospitals: List[Dict[str, Any]] = []
        self.ambulances: List[Dict[str, Any]] = []
        self.incidents: List[Dict[str, Any]] = []
        self.medical_camps: List[Dict[str, Any]] = []
        self.recommendations: List[Dict[str, Any]] = []
        self.events: List[Dict[str, Any]] = []
        self.recent_sos_messages: List[Dict[str, Any]] = []
        self.active_evacuations: List[Dict[str, Any]] = []

        self.last_real_time = time.time()
        self.load_initial_state()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SimulationEngine()
        return cls._instance

    def load_initial_state(self):
        """Loads and initializes static datasets and vehicles."""
        with open("data/processed/zones.geojson", "r") as f:
            zones_data = json.load(f)
            self.zones = [feat["properties"] for feat in zones_data["features"]]
            # attach geometry
            for i, feat in enumerate(zones_data["features"]):
                self.zones[i]["coordinates"] = feat["geometry"]["coordinates"]

        with open("data/processed/roads.geojson", "r") as f:
            roads_data = json.load(f)
            self.roads = [feat["properties"] for feat in roads_data["features"]]
            for i, feat in enumerate(roads_data["features"]):
                self.roads[i]["coordinates"] = feat["geometry"]["coordinates"]

        with open("data/processed/hospitals.geojson", "r") as f:
            hosp_data = json.load(f)
            self.hospitals = [feat["properties"] for feat in hosp_data["features"]]
            for i, feat in enumerate(hosp_data["features"]):
                self.hospitals[i]["coordinates"] = feat["geometry"]["coordinates"]

        # Initial Ambulances fleet with realistic Pune staging coordinates
        # Persistent Fleet Registry (Preserves Admin additions across simulation resets via Supabase & Local)
        fleet_registry_path = "data/processed/fleet_registry.json"
        persistent_fleet = None
        try:
            from backend.app.core.database import load_ambulances_from_db
            persistent_fleet = load_ambulances_from_db()
        except Exception:
            persistent_fleet = None

        if not persistent_fleet and os.path.exists(fleet_registry_path):
            try:
                with open(fleet_registry_path, "r", encoding="utf-8") as f:
                    persistent_fleet = json.load(f)
            except Exception as e:
                print(f"Error loading fleet registry: {e}")

        if not persistent_fleet:
            persistent_fleet = [
                {
                    "ambulance_id": "AMB-01",
                    "callsign": "Ambulance 01",
                    "type": "ALS",
                    "assigned_zone": "Z1",
                    "base_location": [73.8512, 18.5312],
                    "speed_kmh": 45.0,
                    "patient_capacity": 2,
                    "password": "demo123"
                },
                {
                    "ambulance_id": "AMB-02",
                    "callsign": "Ambulance 02",
                    "type": "BLS",
                    "assigned_zone": "Z4",
                    "base_location": [73.8390, 18.5170],
                    "speed_kmh": 45.0,
                    "patient_capacity": 2,
                    "password": "demo123"
                },
                {
                    "ambulance_id": "AMB-03",
                    "callsign": "Ambulance 03",
                    "type": "ALS",
                    "assigned_zone": "Z5",
                    "base_location": [73.8570, 18.5010],
                    "speed_kmh": 45.0,
                    "patient_capacity": 2,
                    "password": "demo123"
                },
                {
                    "ambulance_id": "AMB-04",
                    "callsign": "Ambulance 04",
                    "type": "ALS",
                    "assigned_zone": "Z3",
                    "base_location": [73.8744, 18.5284],
                    "speed_kmh": 45.0,
                    "patient_capacity": 2,
                    "password": "demo123"
                }
            ]

        self.ambulances = []
        for item in persistent_fleet:
            b_loc = item.get("base_location") or item.get("current_location", [73.8512, 18.5312])
            self.ambulances.append({
                "ambulance_id": item["ambulance_id"],
                "callsign": item.get("callsign", item["ambulance_id"]),
                "type": item.get("type", "ALS"),
                "status": "AVAILABLE",
                "assigned_zone": item.get("assigned_zone", "Z1"),
                "base_location": list(b_loc),
                "current_location": list(b_loc),
                "target_location": None,
                "current_incident_id": None,
                "active_route": None,
                "previous_route": None,
                "route_progress": 0.0,
                "speed_multiplier": 1.0,
                "speed_kmh": float(item.get("speed_kmh", 45.0)),
                "eta_minutes": 0.0,
                "patients_onboard": 0,
                "patient_capacity": int(item.get("patient_capacity", 2)),
                "password": item.get("password", "demo123")
            })

        self.ambulance_credentials = {
            a["ambulance_id"]: a.get("password", "demo123")
            for a in self.ambulances
        }
        self.save_fleet_registry()

        self.incidents = []
        self.recent_sos_messages = []
        self.active_evacuations = []
        self.medical_camps = []
        self.recommendations = []
        self.events = [
            {
                "id": "EVT-001",
                "time": "14:00",
                "message": "Simulation initialized. Pune emergency response grid online.",
                "type": "info"
            }
        ]
        self.sim_time_minutes = 0.0
        self.water_rise_m = 0.2
        self.update_simulation_state(dt_minutes=0.0)

    def log_event(self, message: str, evt_type: str = "info"):
        total_mins = int(self.sim_time_minutes)
        h = 14 + (total_mins // 60)
        m = total_mins % 60
        timestr = f"{h:02d}:{m:02d}"
        evt = {
            "id": f"EVT-{len(self.events)+1:03d}",
            "time": timestr,
            "message": message,
            "type": evt_type
        }
        self.events.insert(0, evt)
        if len(self.events) > 50:
            self.events.pop()

    def calculate_water_level(self, t_mins: float) -> float:
        """Deterministic hydraulic flood curve for Pune Mula-Mutha river system."""
        if self.scenario_name == "NORMAL":
            return 0.2
        elif self.scenario_name == "MODERATE FLOOD":
            # T=0: 0.2m, T=10: 0.8m, T=20: 1.6m, T=30: 2.3m, T=40: 2.8m, T=50: 3.2m
            return round(0.2 + (t_mins / 50.0) * 3.0, 2)
        else:  # SEVERE FLOOD
            return round(0.4 + (t_mins / 40.0) * 4.2, 2)

    def tick(self, real_dt_seconds: float):
        """Advances simulation by dt proportional to sim_speed."""
        if not self.is_running:
            return

        dt_sim_minutes = (real_dt_seconds / 60.0) * (self.sim_speed * 10.0)
        self.sim_time_minutes += dt_sim_minutes
        self.update_simulation_state(dt_sim_minutes)

    def step(self, step_minutes: float = 10.0):
        """Manual step forward by fixed simulation minutes."""
        self.sim_time_minutes += step_minutes
        self.update_simulation_state(step_minutes)

    def update_simulation_state(self, dt_minutes: float):
        # 1. Update Water Level
        new_water = self.calculate_water_level(self.sim_time_minutes)
        water_delta = new_water - self.water_rise_m
        self.water_rise_m = new_water

        # 2. Compute Connected Spatial Flood Surface (MultiPolygon)
        self.flood_poly, _, self.flood_polygon_geojson = self.flood_engine.compute_flood_surface(self.water_rise_m)

        # 3. Update Road Statuses & Network Graph using spatial intersection with flood surface
        reroute_triggered = False
        blocked_roads = set()

        for road in self.roads:
            prev_status = road.get("status", "OPEN")
            status, depth, flooded_pct, reason = self.flood_engine.evaluate_road(
                road, road["coordinates"], self.flood_poly, self.water_rise_m
            )
            
            road["status"] = status
            road["flood_depth"] = depth
            road["reason"] = reason
            road["flooded_portion_pct"] = flooded_pct

            # Update routing graph edge weights
            self.routing_graph.update_road_status(road["road_id"], status, depth, reason, flooded_pct)

            if status == "BLOCKED":
                blocked_roads.add(road["road_id"])

            if prev_status != status:
                if status == "BLOCKED":
                    self.log_event(f"Road {road['name']} ({road['road_id']}) BLOCKED: Flood depth {depth:.2f}m exceeded safety threshold.", "warning")
                elif status in ["RESTRICTED", "HIGH_RISK"]:
                    self.log_event(f"Road {road['name']} ({road['road_id']}) {status}: Water depth {depth:.2f}m.", "info")

        # High-ground flood-safe staging bases for proactive vehicle self-preservation
        # High-ground flood-safe staging bases across all sectors in Pune
        SAFE_STAGING_BASES = [
            # Zone 1 (Shivajinagar / Model Colony / North Sector)
            {"name": "Shivajinagar North Base", "coords": [73.8512, 18.5312], "zone": "Z1"},
            {"name": "Model Colony Safe Stand", "coords": [73.8370, 18.5370], "zone": "Z1"},
            {"name": "FC Road Safe Haven", "coords": [73.8420, 18.5260], "zone": "Z1"},
            # Zone 2 (Kasba / Shaniwar Wada Sector)
            {"name": "Kasba Peth High Ground", "coords": [73.8580, 18.5180], "zone": "Z2"},
            {"name": "Budhwar Peth Safe Hub", "coords": [73.8560, 18.5140], "zone": "Z2"},
            # Zone 3 (Sassoon / Station / Central Sector)
            {"name": "Sassoon Trauma Core Base", "coords": [73.8744, 18.5284], "zone": "Z3"},
            {"name": "Pune Station North Stand", "coords": [73.8750, 18.5330], "zone": "Z3"},
            {"name": "Maldhakka Safe Stand", "coords": [73.8690, 18.5260], "zone": "Z3"},
            # Zone 4 (Deccan Gymkhana / Karve Road / West Sector)
            {"name": "BMCC Deccan High Ground", "coords": [73.8340, 18.5210], "zone": "Z4"},
            {"name": "Law College Road Stand", "coords": [73.8280, 18.5150], "zone": "Z4"},
            {"name": "Prabhat Road Sector Stand", "coords": [73.8310, 18.5090], "zone": "Z4"},
            # Zone 5 (Swargate / Parvati / South Sector)
            {"name": "Parvati Foothill Safe Stand", "coords": [73.8480, 18.4980], "zone": "Z5"},
            {"name": "Swargate Flyover High Ground", "coords": [73.8610, 18.5030], "zone": "Z5"},
            {"name": "Satara Road Safe Stand", "coords": [73.8570, 18.4890], "zone": "Z5"},
            # Zone 6 (Camp / MG Road / East Sector)
            {"name": "Camp MG Road Base", "coords": [73.8760, 18.5150], "zone": "Z6"},
            {"name": "East Street Elevated Hub", "coords": [73.8810, 18.5190], "zone": "Z6"},
            # Zone 7 (Yerawada / Bund Garden North Sector)
            {"name": "Yerawada Jail Road Stand", "coords": [73.8810, 18.5490], "zone": "Z7"},
            {"name": "Airport Road High Ground", "coords": [73.8920, 18.5560], "zone": "Z7"},
            # Zone 8 (Kothrud / Paud Road Sector)
            {"name": "Kothrud Stand Base", "coords": [73.8120, 18.5070], "zone": "Z8"},
            {"name": "Paud Road Safe Sector", "coords": [73.8050, 18.5040], "zone": "Z8"},
            {"name": "Mayur Colony High Ground", "coords": [73.8160, 18.5010], "zone": "Z8"},
        ]

        # 3A. Check for Ambulances Trapped in Floodwaters (Scenario 2B)
        for amb in self.ambulances:
            if amb.get("status") == "TRAPPED_IN_FLOOD":
                continue

            curr_pos = amb["current_location"]
            is_amb_flooded, amb_depth, _ = self.flood_engine.is_location_flooded(
                curr_pos[0], curr_pos[1], self.flood_poly, self.water_rise_m
            )
            _, _, amb_road_id, _ = self.routing_graph.snap_to_road(curr_pos[0], curr_pos[1])
            amb_road = self.routing_graph.roads_by_id.get(amb_road_id)
            road_depth = amb_road.get("flood_depth", 0.0) if amb_road else 0.0
            eff_depth = max(amb_depth, road_depth)

            # Trapped threshold: deep water or flooded road with no exit path
            if is_amb_flooded or eff_depth >= 0.40 or (amb_road and amb_road.get("status") == "BLOCKED" and eff_depth >= 0.30):
                can_escape = False
                for base in SAFE_STAGING_BASES:
                    test_escape = self.routing_graph.calculate_route(curr_pos, base["coords"])
                    if test_escape:
                        can_escape = True
                        break

                if not can_escape:
                    amb["status"] = "TRAPPED_IN_FLOOD"
                    amb["is_trapped"] = True
                    amb["speed_kmh"] = 0.0
                    amb["eta_minutes"] = 0.0
                    amb["active_route"] = None
                    pts = amb.get("patients_onboard", 0)
                    pts_txt = f" with {pts} patient(s) onboard" if pts > 0 else ""
                    self.log_event(
                        f"🆘 CRITICAL MAYDAY: Ambulance {amb['ambulance_id']} is TRAPPED IN FLOODWATERS{pts_txt} at [{curr_pos[1]:.4f}, {curr_pos[0]:.4f}] (water depth {eff_depth:.2f}m)! Vehicle immobilised. Immediate rescue required!",
                        "critical"
                    )
                    if amb.get("current_incident_id"):
                        tgt_inc = next((i for i in self.incidents if i["incident_id"] == amb["current_incident_id"]), None)
                        if tgt_inc and tgt_inc.get("status") != "RESOLVED":
                            tgt_inc["status"] = "AMBULANCE_TRAPPED"
                            tgt_inc["unreachable_reason"] = f"Assigned ambulance {amb['ambulance_id']} became trapped in rising floodwaters."

        # 3B. Dynamic Rerouting, Incident Cutoff Checks, Hospital Divert & Proactive Evacuation
        for amb in self.ambulances:
            if amb.get("status") == "TRAPPED_IN_FLOOD":
                continue

            # --- CASE 1: EN_ROUTE_TO_PATIENT ---
            if amb["status"] == "EN_ROUTE_TO_PATIENT":
                inc_id = amb.get("current_incident_id")
                tgt_inc = next((i for i in self.incidents if i["incident_id"] == inc_id), None)
                inc_coords = tgt_inc.get("routing_location", tgt_inc["coordinates"]) if tgt_inc else amb.get("target_location")

                if inc_coords:
                    # Scenario 1 check: Is incident scene already submerged in flood?
                    inc_flooded, inc_depth, _ = self.flood_engine.is_location_flooded(
                        inc_coords[0], inc_coords[1], self.flood_poly, self.water_rise_m
                    )
                    if inc_flooded or inc_depth >= 0.35:
                        if tgt_inc:
                            tgt_inc["status"] = "UNREACHABLE_FLOODED"
                            tgt_inc["is_unreachable"] = True
                            tgt_inc["assigned_ambulance_id"] = None
                            tgt_inc["unreachable_reason"] = f"Incident location submerged under {inc_depth:.2f}m floodwaters."
                        amb["status"] = "AVAILABLE"
                        amb["target_location"] = None
                        amb["current_incident_id"] = None
                        amb["active_route"] = None
                        amb["previous_route"] = None
                        amb["route_progress"] = 0.0
                        amb["eta_minutes"] = 0.0
                        self.log_event(
                            f"⛔ MISSION ABORTED: Incident {inc_id} submerged in floodwaters ({inc_depth:.2f}m). {amb['ambulance_id']} stopped ground approach. Escalated to Admin for boat rescue.",
                            "critical"
                        )
                        continue

                    # Scenario 2A check: Flood submergence prediction before ambulance arrival
                    will_submerge, pred_depth, dist_to_flood_m = self.flood_engine.predict_submergence(
                        inc_coords[0], inc_coords[1], self.water_rise_m, self.sim_time_minutes, amb.get("eta_minutes", 3.0), self.scenario_name
                    )
                    if will_submerge and amb.get("eta_minutes", 0) > 1.2:
                        if tgt_inc:
                            tgt_inc["status"] = "PREDICTED_FLOOD_SUBMERGENCE"
                            tgt_inc["is_unreachable"] = True
                            tgt_inc["assigned_ambulance_id"] = None
                            tgt_inc["unreachable_reason"] = f"Predicted flood inundation ({pred_depth:.2f}m) before ambulance arrival."
                        amb["status"] = "AVAILABLE"
                        amb["target_location"] = None
                        amb["current_incident_id"] = None
                        amb["active_route"] = None
                        amb["previous_route"] = None
                        amb["route_progress"] = 0.0
                        amb["eta_minutes"] = 0.0
                        self.log_event(
                            f"⚠️ FLOOD PREDICTION ALERT: Incident {inc_id} is in rapid inundation path ({dist_to_flood_m:.0f}m from flood edge, {pred_depth:.2f}m depth predicted). Predicted to submerge before arrival! {amb['ambulance_id']} aborted ground approach. Reported to Admin for boat evacuation.",
                            "critical"
                        )
                        continue

                # Route blocked check (Scenario 1 recalculate or abort)
                if amb.get("active_route"):
                    route_road_ids = amb["active_route"].get("road_ids", [])
                    intersects_blocked = any(rid in blocked_roads for rid in route_road_ids)
                    if intersects_blocked and amb.get("target_location"):
                        new_route = self.routing_graph.calculate_route(amb["current_location"], amb["target_location"])
                        if new_route:
                            amb["previous_route"] = copy.deepcopy(amb["active_route"])
                            amb["active_route"] = new_route
                            amb["route_progress"] = 0.0
                            amb["eta_minutes"] = new_route["duration_min"]
                            self.log_event(
                                f"⚡ LIVE REROUTE: {amb['ambulance_id']} redirected via safe route ({new_route['distance_km']} km, ETA {new_route['duration_min']}m).",
                                "alert"
                            )
                        else:
                            # Scenario 1 core: NO ROUTE LEFT! Stop working for incident and report to admin
                            if tgt_inc:
                                tgt_inc["status"] = "UNREACHABLE_FLOODED"
                                tgt_inc["is_unreachable"] = True
                                tgt_inc["assigned_ambulance_id"] = None
                                tgt_inc["unreachable_reason"] = "All access corridors to incident are inundated by floodwaters."
                            amb["status"] = "AVAILABLE"
                            amb["target_location"] = None
                            amb["current_incident_id"] = None
                            amb["active_route"] = None
                            amb["previous_route"] = None
                            amb["route_progress"] = 0.0
                            amb["eta_minutes"] = 0.0
                            self.log_event(
                                f"⛔ MISSION ABORTED: {amb['ambulance_id']} has NO viable route left to reach {inc_id} due to flood cutoff! Ground response halted. Reported to Admin for boat/air rescue.",
                                "critical"
                            )
                            continue

            # --- CASE 2: EN_ROUTE_TO_HOSPITAL (Scenario 5) ---
            elif amb["status"] == "EN_ROUTE_TO_HOSPITAL":
                target_hosp_id = amb.get("target_hospital_id")
                target_hosp = next((h for h in self.hospitals if h["hospital_id"] == target_hosp_id), None)
                hosp_coords = target_hosp.get("coordinates", [73.8744, 18.5284]) if target_hosp else [73.8744, 18.5284]

                hosp_flooded, hosp_depth, hosp_dist = self.flood_engine.is_location_flooded(
                    hosp_coords[0], hosp_coords[1], self.flood_poly, self.water_rise_m
                )
                route_road_ids = amb.get("active_route", {}).get("road_ids", [])
                intersects_blocked = any(rid in blocked_roads for rid in route_road_ids)

                is_hosp_compromised = hosp_flooded or hosp_depth >= 0.30 or hosp_dist <= 50.0

                if is_hosp_compromised or intersects_blocked:
                    # Check if SAME hospital is still reachable via safe road detour ONLY IF hospital itself is not compromised
                    same_hosp_route = None
                    if not is_hosp_compromised:
                        same_hosp_route = self.routing_graph.calculate_route(
                            amb["current_location"], target_hosp.get("routing_location", hosp_coords)
                        )
                    if same_hosp_route:
                        amb["previous_route"] = copy.deepcopy(amb["active_route"])
                        amb["active_route"] = same_hosp_route
                        amb["route_progress"] = 0.0
                        amb["eta_minutes"] = same_hosp_route["duration_min"]
                        self.log_event(
                            f"⚡ LIVE REROUTE: {amb['ambulance_id']} detour around flood to {target_hosp['name']}.",
                            "alert"
                        )
                    else:
                        # Target hospital is surrounded by flood or cut off! (Scenario 5)
                        old_hosp_name = target_hosp["name"] if target_hosp else "Target Hospital"
                        candidate_hospitals = []
                        for h in self.hospitals:
                            if h["hospital_id"] == target_hosp_id:
                                continue
                            c_flooded, c_depth, _ = self.flood_engine.is_location_flooded(
                                h["coordinates"][0], h["coordinates"][1], self.flood_poly, self.water_rise_m
                            )
                            if not c_flooded and c_depth < 0.25:
                                candidate_hospitals.append(h)
                        if not candidate_hospitals:
                            candidate_hospitals = [
                                h for h in self.hospitals if h["hospital_id"] != target_hosp_id
                            ]
                        inc_dummy = {"severity": "CRITICAL" if amb.get("patients_onboard", 1) > 1 else "HIGH", "patient_count": amb.get("patients_onboard", 1)}
                        best_alt_hosp, alt_route, explanation = select_best_hospital(
                            inc_dummy, candidate_hospitals, amb["current_location"], self.routing_graph
                        )
                        if best_alt_hosp and alt_route:
                            amb["target_hospital_id"] = best_alt_hosp["hospital_id"]
                            amb["target_hospital_name"] = best_alt_hosp["name"]
                            amb["previous_route"] = copy.deepcopy(amb.get("active_route"))
                            amb["active_route"] = alt_route
                            amb["target_location"] = best_alt_hosp.get("routing_location", best_alt_hosp["coordinates"])
                            amb["route_progress"] = 0.0
                            amb["eta_minutes"] = alt_route["duration_min"]
                            amb["diverted_hospital"] = True
                            self.log_event(
                                f"🚨 DYNAMIC HOSPITAL DIVERT: {old_hosp_name} is surrounded by floodwaters and inaccessible! {amb['ambulance_id']} dynamically diverted from current position to {best_alt_hosp['name']} (ETA {alt_route['duration_min']:.1f}m, {alt_route['distance_km']} km safe corridor). Beds verified.",
                                "alert"
                            )
                        else:
                            amb["status"] = "BLOCKED_NO_HOSPITAL"
                            self.log_event(
                                f"CRITICAL MEDICAL GAP: {amb['ambulance_id']} with patient onboard cannot reach ANY regional hospital due to flood inundation! Escalated to Admin for field camp triage or heli-evac.",
                                "critical"
                            )

            # --- CASE 3: IDLE / POST-MISSION AMBULANCE PROACTIVE RELOCATION (Scenario 4) ---
            elif amb.get("status") in ["AVAILABLE", "IDLE", "COMPLETED", "AT_HOSPITAL"] and not amb.get("current_incident_id"):
                curr_pos = amb["current_location"]
                _, depth, dist_to_flood_m = self.flood_engine.is_location_flooded(
                    curr_pos[0], curr_pos[1], self.flood_poly, self.water_rise_m
                )
                # Generous safety trigger: if flood is encroaching within 600m or water starts lapping (depth > 0.01m)
                if dist_to_flood_m < 600.0 or depth > 0.01:
                    # Sort safe bases strictly by distance to current ambulance location to pick the CLOSEST local safe haven
                    sorted_bases = sorted(
                        SAFE_STAGING_BASES,
                        key=lambda b: (b["coords"][0] - curr_pos[0])**2 + (b["coords"][1] - curr_pos[1])**2
                    )
                    best_base = None
                    best_route = None
                    for base in sorted_bases:
                        b_flooded, _, b_dist = self.flood_engine.is_location_flooded(
                            base["coords"][0], base["coords"][1], self.flood_poly, self.water_rise_m
                        )
                        if not b_flooded and b_dist > 250.0:
                            r = self.routing_graph.calculate_route(curr_pos, base["coords"])
                            if r:
                                best_route = r
                                best_base = base
                                break  # Closest reachable unflooded safe ground found!
                    if best_base and best_route:
                        amb["status"] = "RELOCATING_TO_SAFETY"
                        amb["target_location"] = best_base["coords"]
                        amb["safe_staging_name"] = best_base["name"]
                        amb["assigned_zone"] = best_base["zone"]
                        amb["active_route"] = best_route
                        amb["previous_route"] = None
                        amb["route_progress"] = 0.0
                        amb["eta_minutes"] = best_route["duration_min"]
                        amb["is_trapped"] = False
                        amb_id_str = amb["ambulance_id"]
                        b_name_str = best_base["name"]
                        dist_km_str = f"{best_route['distance_km']:.1f}"
                        eta_str = f"{best_route['duration_min']:.1f}"
                        self.log_event(
                            f"??? PROACTIVE LOCAL RELOCATION: Encroaching floodwaters ({dist_to_flood_m:.0f}m away) detected near idle {amb_id_str}. Relocating to nearby safe staging ground at {b_name_str} ({dist_km_str} km away, ETA {eta_str}m).",
                            "alert"
                        )

        # 4. Advance Ambulances Along Routes
        for amb in self.ambulances:
            if amb.get("status") == "TRAPPED_IN_FLOOD":
                continue

            if amb["status"] in ["EN_ROUTE_TO_PATIENT", "EN_ROUTE_TO_HOSPITAL", "RELOCATING_TO_SAFETY"] and amb.get("active_route"):
                route_coords = amb["active_route"]["route_coordinates"]
                total_duration = max(0.5, amb["active_route"]["duration_min"])
                
                # Progress fraction increment
                if dt_minutes > 0:
                    prog_increment = dt_minutes / total_duration
                    amb["route_progress"] = min(1.0, amb["route_progress"] + prog_increment)
                
                # Interpolate position along coordinate polyline
                idx_float = amb["route_progress"] * (len(route_coords) - 1)
                idx_low = int(idx_float)
                idx_high = min(len(route_coords) - 1, idx_low + 1)
                frac = idx_float - idx_low

                p1 = route_coords[idx_low]
                p2 = route_coords[idx_high]
                amb["current_location"] = [
                    round(p1[0] + (p2[0] - p1[0]) * frac, 6),
                    round(p1[1] + (p2[1] - p1[1]) * frac, 6)
                ]
                remaining_time = max(0.0, total_duration * (1.0 - amb["route_progress"]))
                amb["eta_minutes"] = round(remaining_time, 1)

                # Check arrival
                if amb["route_progress"] >= 1.0:
                    if amb["status"] == "RELOCATING_TO_SAFETY":
                        safe_name = amb.pop("safe_staging_name", "Safe Staging Base")
                        amb["status"] = "AVAILABLE"
                        amb["active_route"] = None
                        amb["target_location"] = None
                        self.log_event(f"✅ {amb['ambulance_id']} safely reached high-ground staging at {safe_name}. Ready for emergency calls.", "info")
                    elif amb["status"] == "EN_ROUTE_TO_PATIENT":
                        amb["status"] = "AT_PATIENT"
                        amb["route_progress"] = 1.0
                        self.log_event(f"📍 {amb['ambulance_id']} arrived at patient scene. Onsite triage in progress; awaiting patient pickup confirmation.", "info")
                    elif amb["status"] == "EN_ROUTE_TO_HOSPITAL":
                        amb["status"] = "AT_HOSPITAL"
                        amb["route_progress"] = 1.0
                        self.handle_hospital_arrival(amb)

        # 5. Update Zones with ML Predictions
        open_roads_count = sum(1 for r in self.roads if r.get("status") == "OPEN")
        road_access_pct = open_roads_count / max(1, len(self.roads))

        for z in self.zones:
            # Predict demand using Model 1
            pred_demand = self.model_registry.predict_zone_demand(z, self.water_rise_m, self.sim_time_minutes)
            z["predicted_demand"] = pred_demand

            # Predict risk using Model 2
            risk_score, risk_cat = self.model_registry.predict_zone_risk(z, self.water_rise_m, pred_demand, road_access_pct)
            z["risk_score"] = risk_score
            z["risk_level"] = risk_cat

        # 6. Evaluate Resource & Medical Camp Recommendations
        camp_rec = evaluate_medical_camp_needs(self.zones, self.roads, self.medical_camps, self.water_rise_m)
        self.recommendations = [camp_rec] if camp_rec else []

    def handle_hospital_arrival(self, amb: Dict[str, Any]):
        """Patient arrived at hospital: updates hospital beds & completes mission."""
        hosp_id = amb.get("target_hospital_id")
        inc_id = amb.get("current_incident_id")

        # Find hospital and deduct bed & ICU
        for h in self.hospitals:
            if h["hospital_id"] == hosp_id:
                h["available_beds"] = max(0, h["available_beds"] - 1)
                # Check incident severity
                for inc in self.incidents:
                    if inc["incident_id"] == inc_id and inc.get("severity") == "CRITICAL":
                        h["available_icu"] = max(0, h["available_icu"] - 1)
                
                h["capacity_utilization"] = round((1.0 - h["available_beds"] / h["total_beds"]) * 100, 1)
                self.log_event(f"Patient admitted to {h['name']}. Available beds: {h['available_beds']}, ICU: {h['available_icu']}.", "info")
                break

        # Mark incident resolved
        for inc in self.incidents:
            if inc["incident_id"] == inc_id:
                inc["status"] = "RESOLVED"
                break

        amb["status"] = "AVAILABLE"  # Ready for next mission & flood evacuation!
        amb["is_trapped"] = False
        amb["patients_onboard"] = 0
        amb["active_route"] = None
        amb["previous_route"] = None
        amb["current_incident_id"] = None
        amb["target_hospital_id"] = None
        self.log_event(f"Mission complete for {amb['ambulance_id']}. Vehicle returning to available status.", "info")

    @staticmethod
    def point_in_polygon(lon: float, lat: float, poly: List[List[float]]) -> bool:
        """Ray-casting algorithm for exact geometric point-in-polygon containment test."""
        n = len(poly)
        inside = False
        p1x, p1y = poly[0]
        for i in range(n + 1):
            p2x, p2y = poly[i % n]
            if lat > min(p1y, p2y):
                if lat <= max(p1y, p2y):
                    if lon <= max(p1x, p2x):
                        if p1y != p2y:
                            xints = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or lon <= xints:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    def create_incident(self, lon: float, lat: float, severity: str = "HIGH", patient_count: int = 1) -> Dict[str, Any]:
        """Admin creates emergency incident by clicking on the map."""
        inc_id = f"INC-{len(self.incidents)+101:03d}"
        
        # Determine zone using exact ray-casting point-in-polygon test
        target_zone_id = None
        for z in self.zones:
            coords = z["coordinates"][0]
            if self.point_in_polygon(lon, lat, coords):
                target_zone_id = z["zone_id"]
                break

        if not target_zone_id:
            # Fallback to closest zone centroid
            best_dist = float('inf')
            for z in self.zones:
                c = z["coordinates"][0][0]
                d = (c[0] - lon)**2 + (c[1] - lat)**2
                if d < best_dist:
                    best_dist = d
                    target_zone_id = z["zone_id"]

        # Snap routing location to nearest physical road segment while preserving original display location
        snapped_pt, nearest_node, road_id, snap_dist = self.routing_graph.snap_to_road(lon, lat)

        # Scenario 1 & 2 Check: Is the reported location already submerged in floodwaters?
        is_submerged, depth, dist_to_flood_m = self.flood_engine.is_location_flooded(
            lon, lat, self.flood_poly, self.water_rise_m
        )
        if is_submerged or depth >= 0.35:
            incident = {
                "incident_id": inc_id,
                "coordinates": [round(lon, 5), round(lat, 5)],
                "display_location": [round(lon, 5), round(lat, 5)],
                "routing_location": snapped_pt,
                "snap_distance_m": round(snap_dist, 1),
                "snapped_road_id": road_id,
                "zone_id": target_zone_id,
                "severity": severity,
                "patient_count": patient_count,
                "status": "UNREACHABLE_FLOODED",
                "is_unreachable": True,
                "unreachable_reason": f"Incident site is submerged in floodwaters ({depth:.2f}m depth). Road access severed.",
                "created_time": self.sim_time_minutes,
                "assigned_ambulance_id": None,
                "target_hospital_id": None
            }
            self.incidents.append(incident)
            self.log_event(
                f"🚨 CRITICAL RESCUE DISPATCH: Emergency {inc_id} reported in Zone {target_zone_id} is SUBMERGED in floodwaters ({depth:.2f}m depth)! Ground ambulances cannot reach this submerged area. Escalating to Admin for NDRF / SDRF boat rescue. Ground response aborted.",
                "critical"
            )
            return incident

        incident = {
            "incident_id": inc_id,
            "coordinates": [round(lon, 5), round(lat, 5)],
            "display_location": [round(lon, 5), round(lat, 5)],
            "routing_location": snapped_pt,
            "snap_distance_m": round(snap_dist, 1),
            "snapped_road_id": road_id,
            "zone_id": target_zone_id,
            "severity": severity,
            "patient_count": patient_count,
            "status": "PENDING_DISPATCH",
            "created_time": self.sim_time_minutes,
            "assigned_ambulance_id": None,
            "target_hospital_id": None
        }
        self.incidents.append(incident)
        self.log_event(f"New Emergency {inc_id} reported in Zone {target_zone_id} ({severity}, {patient_count} patient{'s' if patient_count>1 else ''}). Snapped to {road_id or 'road'} ({snap_dist:.1f}m).", "alert")

        # Trigger automatic dispatch optimization
        self.auto_dispatch_incident(incident)
        return incident

    def auto_dispatch_incident(self, incident: Dict[str, Any]):
        """Dispatches best ambulance using multi-criteria optimization."""
        if incident.get("status") in ["UNREACHABLE_FLOODED", "RESOLVED"]:
            return

        inc_coords = incident.get("routing_location", incident["coordinates"])
        is_submerged, depth, _ = self.flood_engine.is_location_flooded(
            inc_coords[0], inc_coords[1], self.flood_poly, self.water_rise_m
        )
        if is_submerged or depth >= 0.35:
            incident["status"] = "UNREACHABLE_FLOODED"
            incident["is_unreachable"] = True
            incident["assigned_ambulance_id"] = None
            incident["unreachable_reason"] = f"Incident location submerged under {depth:.2f}m floodwaters."
            self.log_event(f"🚨 CRITICAL RESCUE ALERT: Emergency {incident['incident_id']} is submerged in floodwaters! Ground dispatch aborted. Escalated to Admin.", "critical")
            return

        best_amb, route, explanation = select_best_ambulance(incident, self.ambulances, self.routing_graph)
        if best_amb and route:
            best_amb["status"] = "CALL_RECEIVED"
            best_amb["current_incident_id"] = incident["incident_id"]
            best_amb["target_location"] = incident.get("routing_location", incident["coordinates"])
            best_amb["active_route"] = route
            best_amb["previous_route"] = None
            best_amb["route_progress"] = 0.0
            best_amb["eta_minutes"] = route["duration_min"]

            incident["status"] = "DISPATCHED"
            incident["assigned_ambulance_id"] = best_amb["ambulance_id"]

            self.log_event(f"Dispatch Engine assigned {best_amb['ambulance_id']} to {incident['incident_id']}. {explanation}", "info")
        else:
            # Scenario 1 core: no route left, report to admin and stop trying to dispatch ground ambulance
            incident["status"] = "UNREACHABLE_FLOODED"
            incident["is_unreachable"] = True
            incident["assigned_ambulance_id"] = None
            incident["unreachable_reason"] = f"All approach routes cut off by floodwaters: {explanation}"
            self.log_event(f"🚨 DISPATCH ALERT: No accessible road route left for {incident['incident_id']}! Ground dispatch aborted. Reported to Admin for SDRF boat extraction.", "critical")

    def ambulance_accept_call(self, ambulance_id: str) -> bool:
        """Ambulance operator accepts call in Ambulance Dashboard."""
        for amb in self.ambulances:
            if amb["ambulance_id"] == ambulance_id and amb["status"] in ["CALL_RECEIVED", "AVAILABLE"]:
                amb["status"] = "EN_ROUTE_TO_PATIENT"
                self.is_running = True  # Automatically start simulation movement
                self.log_event(f"🚨 {ambulance_id} operator ACCEPTED call. Navigation active en route to patient scene.", "info")
                return True
        return False

    def ambulance_patient_picked_up(self, ambulance_id: str) -> Optional[Dict[str, Any]]:
        """
        Ambulance operator confirms patient picked up.
        Calculates optimal hospital eligibility and sets hospital route.
        """
        target_amb = None
        for amb in self.ambulances:
            if amb["ambulance_id"] == ambulance_id:
                target_amb = amb
                break

        if not target_amb:
            return None

        # Scenario 2B: Check if ambulance is trapped in floodwaters
        if target_amb.get("status") == "TRAPPED_IN_FLOOD":
            self.log_event(f"⚠️ {ambulance_id} is TRAPPED IN FLOODWATERS. Vehicle immobilised; cannot transport patient. Boat evacuation required.", "warning")
            return None

        curr_pos = target_amb["current_location"]
        is_amb_f, amb_d, _ = self.flood_engine.is_location_flooded(curr_pos[0], curr_pos[1], self.flood_poly, self.water_rise_m)
        if is_amb_f or amb_d >= 0.35:
            # Check exit routes
            can_exit = any(self.routing_graph.calculate_route(curr_pos, h.get("routing_location", h["coordinates"])) for h in self.hospitals)
            if not can_exit:
                target_amb["status"] = "TRAPPED_IN_FLOOD"
                target_amb["is_trapped"] = True
                target_amb["speed_kmh"] = 0.0
                target_amb["eta_minutes"] = 0.0
                target_amb["patients_onboard"] = 1
                self.log_event(f"🆘 CRITICAL MAYDAY: {ambulance_id} picked up patient but is TRAPPED IN FLOODWATERS at scene [{curr_pos[1]:.4f}, {curr_pos[0]:.4f}]! Vehicle immobilised. Urgent rescue boat needed!", "critical")
                return None

        # Update status and patient count
        target_amb["status"] = "PATIENT_PICKED_UP"
        
        # Find associated incident
        target_inc = None
        for inc in self.incidents:
            if inc["incident_id"] == target_amb.get("current_incident_id"):
                target_inc = inc
                inc["status"] = "PICKED_UP"
                break

        if not target_inc:
            target_inc = {"severity": "HIGH", "patient_count": 1}

        target_amb["patients_onboard"] = target_inc.get("patient_count", 1)

        # Hospital Selection Optimization
        best_hosp, hosp_route, explanation = select_best_hospital(
            target_inc, self.hospitals, target_amb["current_location"], self.routing_graph
        )

        if best_hosp and hosp_route:
            target_amb["target_hospital_id"] = best_hosp["hospital_id"]
            target_amb["target_hospital_name"] = best_hosp["name"]
            target_amb["hospital_route"] = hosp_route
            self.log_event(f"Hospital Eligibility: {best_hosp['name']} selected for {ambulance_id}. {explanation}", "info")
            return {
                "hospital": best_hosp,
                "route": hosp_route,
                "explanation": explanation
            }
        else:
            target_amb["status"] = "BLOCKED_NO_HOSPITAL"
            self.log_event(f"CRITICAL GAP: No eligible hospital available for {ambulance_id}! {explanation}", "critical")
            return None

    def ambulance_start_hospital_route(self, ambulance_id: str) -> bool:
        """Operator starts hospital route after viewing recommendation."""
        for amb in self.ambulances:
            if amb["ambulance_id"] == ambulance_id and amb.get("hospital_route"):
                amb["status"] = "EN_ROUTE_TO_HOSPITAL"
                amb["active_route"] = amb["hospital_route"]
                amb["target_location"] = amb["active_route"]["route_coordinates"][-1]
                amb["route_progress"] = 0.0
                amb["eta_minutes"] = amb["active_route"]["duration_min"]
                self.log_event(f"{ambulance_id} en route to {amb.get('target_hospital_name', 'hospital')}.", "info")
                return True
        return False

    def deploy_medical_camp(self, zone_id: str) -> Optional[Dict[str, Any]]:
        """Admin deploys temporary medical camp in response to coverage gap."""
        target_zone = next((z for z in self.zones if z["zone_id"] == zone_id), None)
        if not target_zone:
            return None

        camp_id = f"CAMP-{len(self.medical_camps)+1:02d}"
        centroid = target_zone["coordinates"][0][0]
        camp_loc = [centroid[0] + 0.006, centroid[1] - 0.004]

        camp = {
            "camp_id": camp_id,
            "zone_id": zone_id,
            "zone_name": target_zone["name"],
            "coordinates": camp_loc,
            "capacity": 20,
            "available_beds": 20,
            "status": "OPERATIONAL",
            "type": "Triage & First Aid Field Unit"
        }
        self.medical_camps.append(camp)

        # Improve zone medical coverage score
        target_zone["medical_coverage_score"] = min(1.0, target_zone.get("medical_coverage_score", 0.5) + 0.35)
        # Clear recommendation
        self.recommendations = [r for r in self.recommendations if r.get("zone_id") != zone_id]

        self.log_event(f"🏕️ DEPLOYED: Temporary Medical Camp {camp_id} operational in Zone {target_zone['name']} (Capacity: 20 patients).", "alert")
        return camp

    def position_fleet(self):
        """Runs OR-Tools vehicle positioning to deploy fleet across zones."""
        assignments = optimize_ambulance_staging(self.ambulances, self.zones)
        zone_lookup = {z["zone_id"]: z for z in self.zones}

        ZONE_STAGING_LOCATIONS = {
            "Z1": [73.8512, 18.5312],  # Sancheti / Shivajinagar
            "Z2": [73.8550, 18.5195],  # Shaniwar Wada / Kasba
            "Z3": [73.8744, 18.5284],  # Sassoon General Hospital
            "Z4": [73.8390, 18.5170],  # Deccan Gymkhana
            "Z5": [73.8570, 18.5010],  # Swargate Transit Hub
            "Z6": [73.8760, 18.5150],  # Camp MG Road
            "Z7": [73.8810, 18.5490],  # Yerawada Hub
            "Z8": [73.8120, 18.5070],  # Kothrud Stand
        }

        for amb_id, target_zone_id in assignments.items():
            for amb in self.ambulances:
                if amb["ambulance_id"] == amb_id:
                    amb["assigned_zone"] = target_zone_id
                    loc = ZONE_STAGING_LOCATIONS.get(target_zone_id)
                    if loc:
                        amb["current_location"] = [loc[0], loc[1]]
                    else:
                        z = zone_lookup.get(target_zone_id)
                        if z:
                            centroid = z["coordinates"][0][0]
                            amb["current_location"] = [round(centroid[0], 5), round(centroid[1], 5)]

        self.log_event(f"Ambulance fleet automatically staged based on predicted demand and zone risk.", "info")

    def load_demo_scenario(self):
        """Prepares the comprehensive demo scenario for judges/testing."""
        self.load_initial_state()
        self.scenario_name = "MODERATE FLOOD"
        self.sim_time_minutes = 20.0  # T+20 min: flood active, R17 blocking soon
        self.water_rise_m = 1.6
        self.update_simulation_state(dt_minutes=0.0)

        # Strategic non-overlapping zone staging across Pune:
        # AMB-01: Zone 1 (Shivajinagar / Sancheti North)
        # AMB-02: Zone 4 (Deccan Gymkhana / Karve Road West)
        # AMB-03: Zone 5 (Swargate Transit Hub South)
        # AMB-04: Zone 3 (Sassoon Trauma Core East)
        staging = {
            "AMB-01": ("Z1", [73.8512, 18.5312]),
            "AMB-02": ("Z4", [73.8390, 18.5170]),
            "AMB-03": ("Z5", [73.8570, 18.5010]),
            "AMB-04": ("Z3", [73.8744, 18.5284]),
        }
        for amb in self.ambulances:
            amb_id = amb["ambulance_id"]
            if amb_id in staging:
                amb["assigned_zone"] = staging[amb_id][0]
                amb["current_location"] = list(staging[amb_id][1])
                amb["status"] = "AVAILABLE"
                amb["patients_onboard"] = 0
                amb["current_incident_id"] = None
                amb["active_route"] = None
                amb["previous_route"] = None
                amb["route_progress"] = 0.0

        # Seed pre-existing demo incident INC-101 in Deccan / Alka Talkies riverside [73.8440, 18.5160]
        # In this area, AMB-02 (Deccan [73.8390, 18.5170]) is 0.5km away (fastest response, ~1.2 min)!
        # AMB-01 is 1.8km away across the river, AMB-03 is 2.3km away, AMB-04 is 3.5km away.
        # Multi-criteria dispatch optimization automatically selects AMB-02 as the fastest available unit!
        self.create_incident(73.8440, 18.5160, severity="HIGH", patient_count=1)
        self.log_event("Demo scenario loaded: 4 ambulances staged across distinct zones. Flood active along Mutha riverbed.", "alert")


    def save_fleet_registry(self):
        """Persists commissioned fleet to disk so admin additions and deletions survive resets."""
        try:
            records = []
            for a in self.ambulances:
                records.append({
                    "ambulance_id": a["ambulance_id"],
                    "callsign": a.get("callsign", a["ambulance_id"]),
                    "type": a.get("type", "ALS"),
                    "assigned_zone": a.get("assigned_zone", "Z1"),
                    "base_location": a.get("base_location", a.get("current_location", [73.8512, 18.5312])),
                    "speed_kmh": a.get("speed_kmh", 45.0),
                    "patient_capacity": a.get("patient_capacity", 2),
                    "password": a.get("password", "demo123")
                })
            with open("data/processed/fleet_registry.json", "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
            
            # Sync to Supabase cloud database
            try:
                from backend.app.core.database import sync_ambulances_to_db
                sync_ambulances_to_db(self.ambulances)
            except Exception:
                pass
        except Exception as e:
            print(f"Error saving fleet registry: {e}")

    def get_ambulance_credentials(self) -> Dict[str, str]:
        if not hasattr(self, "ambulance_credentials") or not self.ambulance_credentials:
            self.ambulance_credentials = {}
        for a in self.ambulances:
            aid = a["ambulance_id"]
            if aid not in self.ambulance_credentials:
                self.ambulance_credentials[aid] = a.get("password", "demo123")
        return self.ambulance_credentials

    def add_ambulance(self, amb_data: Dict[str, Any]) -> Dict[str, Any]:
        raw_id = (amb_data.get("ambulance_id") or "").strip().upper()
        if not raw_id:
            nums = []
            for a in self.ambulances:
                m = re.search(r"AMB-(\d+)", a["ambulance_id"])
                if m:
                    nums.append(int(m.group(1)))
            next_num = max(nums, default=0) + 1
            raw_id = f"AMB-{next_num:02d}"

        if any(a["ambulance_id"] == raw_id for a in self.ambulances):
            raise ValueError(f"Ambulance unit {raw_id} already exists in fleet")

        zone_id = amb_data.get("assigned_zone", "Z1")
        ZONE_STAGING_LOCATIONS = {
            "Z1": [73.8512, 18.5312],
            "Z2": [73.8550, 18.5195],
            "Z3": [73.8744, 18.5284],
            "Z4": [73.8390, 18.5170],
            "Z5": [73.8570, 18.5010],
            "Z6": [73.8760, 18.5150],
            "Z7": [73.8810, 18.5490],
            "Z8": [73.8120, 18.5070],
        }
        loc = amb_data.get("current_location") or ZONE_STAGING_LOCATIONS.get(zone_id, [73.8512, 18.5312])
        callsign = amb_data.get("callsign") or f"Ambulance {raw_id.replace('AMB-', '')}"
        vtype = amb_data.get("type", "ALS").upper()
        if vtype not in ["ALS", "BLS", "CC"]:
            vtype = "ALS"
        password = amb_data.get("password") or "demo123"

        new_amb = {
            "ambulance_id": raw_id,
            "callsign": callsign,
            "type": vtype,
            "status": "AVAILABLE",
            "assigned_zone": zone_id,
            "current_location": [float(loc[0]), float(loc[1])],
            "target_location": None,
            "current_incident_id": None,
            "active_route": None,
            "previous_route": None,
            "route_progress": 0.0,
            "speed_multiplier": 1.0,
            "speed_kmh": float(amb_data.get("speed_kmh", 45.0)),
            "eta_minutes": 0.0,
            "patients_onboard": 0,
            "patient_capacity": int(amb_data.get("patient_capacity", 2)),
            "password": password
        }

        new_amb["base_location"] = list(loc)
        self.ambulances.append(new_amb)
        self.get_ambulance_credentials()[raw_id] = password
        self.save_fleet_registry()
        self.log_event(
            f"?? NEW AMBULANCE ADDED: {raw_id} ({callsign}, {vtype}) deployed to Zone {zone_id} staging.",
            "info"
        )
        return new_amb

    def delete_ambulance(self, ambulance_id: str) -> bool:
        aid = ambulance_id.strip().upper()
        idx_to_del = None
        for i, a in enumerate(self.ambulances):
            if a["ambulance_id"] == aid:
                idx_to_del = i
                break

        if idx_to_del is None:
            return False

        amb = self.ambulances.pop(idx_to_del)
        if amb.get("current_incident_id"):
            for inc in self.incidents:
                if inc["incident_id"] == amb["current_incident_id"]:
                    if inc.get("status") in ["ASSIGNED", "DISPATCHED"]:
                        inc["status"] = "PENDING"
                        inc["assigned_ambulance_id"] = None
                        self.log_event(
                            f"?? Incident {inc['incident_id']} returned to PENDING queue due to {aid} decommissioning.",
                            "warning"
                        )

        creds = self.get_ambulance_credentials()
        if aid in creds:
            del creds[aid]
        self.save_fleet_registry()

        try:
            from backend.app.core.database import delete_ambulance_from_db
            delete_ambulance_from_db(aid)
        except Exception:
            pass

        self.log_event(
            f"??? AMBULANCE DECOMMISSIONED: Unit {aid} ({amb.get('callsign')}) removed from active fleet.",
            "alert"
        )
        return True

    def get_full_state(self) -> Dict[str, Any]:
        """Full simulation state broadcast to Admin and Ambulance clients."""
        total_mins = int(self.sim_time_minutes)
        h = 14 + (total_mins // 60)
        m = total_mins % 60
        timestr = f"Day 1 • {h:02d}:{m:02d}"

        open_roads = sum(1 for r in self.roads if r.get("status") == "OPEN")
        restricted_roads = sum(1 for r in self.roads if r.get("status") == "RESTRICTED")
        high_risk_roads = sum(1 for r in self.roads if r.get("status") == "HIGH_RISK")
        blocked_roads = sum(1 for r in self.roads if r.get("status") == "BLOCKED")

        total_demand = sum(z.get("predicted_demand", 0.0) for z in self.zones)

        return {
            "simulation_time_str": timestr,
            "simulation_time_minutes": round(self.sim_time_minutes, 1),
            "is_running": self.is_running,
            "sim_speed": self.sim_speed,
            "scenario_name": self.scenario_name,
            "water_rise_m": round(self.water_rise_m, 2),
            "flood_polygon": self.flood_polygon_geojson,
            "network_stats": {
                "open_roads": open_roads,
                "restricted_roads": restricted_roads,
                "high_risk_roads": high_risk_roads,
                "blocked_roads": blocked_roads,
                "total_demand": round(total_demand, 0)
            },
            "zones": self.zones,
            "roads": [r for r in self.roads if r.get("status") != "OPEN"],
            "hospitals": self.hospitals,
            "ambulances": self.ambulances,
            "incidents": self.incidents,
            "medical_camps": self.medical_camps,
            "recommendations": self.recommendations,
            "recent_sos_messages": getattr(self, "recent_sos_messages", []),
            "active_evacuations": getattr(self, "active_evacuations", []),
            "events": self.events[:25]
        }