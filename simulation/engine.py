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
        self.ambulances = [
            {
                "ambulance_id": "AMB-01",
                "callsign": "Ambulance 01",
                "type": "ALS",  # Advanced Life Support
                "status": "AVAILABLE",  # AVAILABLE, CALL_RECEIVED, ACCEPTED, EN_ROUTE_TO_PATIENT, AT_PATIENT, PATIENT_PICKED_UP, EN_ROUTE_TO_HOSPITAL, AT_HOSPITAL
                "assigned_zone": "Z1",
                "current_location": [73.8512, 18.5312],  # Sancheti / Shivajinagar
                "target_location": None,
                "current_incident_id": None,
                "active_route": None,
                "previous_route": None,  # for visual rerouting transition
                "route_progress": 0.0,
                "speed_multiplier": 1.0,
                "speed_kmh": 45.0,
                "eta_minutes": 0.0,
                "patients_onboard": 0,
                "patient_capacity": 2
            },
            {
                "ambulance_id": "AMB-02",
                "callsign": "Ambulance 02",
                "type": "BLS",
                "status": "AVAILABLE",
                "assigned_zone": "Z4",
                "current_location": [73.8390, 18.5170],  # Deccan Gymkhana
                "target_location": None,
                "current_incident_id": None,
                "active_route": None,
                "previous_route": None,
                "route_progress": 0.0,
                "speed_multiplier": 1.0,
                "speed_kmh": 45.0,
                "eta_minutes": 0.0,
                "patients_onboard": 0,
                "patient_capacity": 2
            },
            {
                "ambulance_id": "AMB-03",
                "callsign": "Ambulance 03",
                "type": "ALS",
                "status": "AVAILABLE",
                "assigned_zone": "Z5",
                "current_location": [73.8570, 18.5010],  # Swargate Hub
                "target_location": None,
                "current_incident_id": None,
                "active_route": None,
                "previous_route": None,
                "route_progress": 0.0,
                "speed_multiplier": 1.0,
                "speed_kmh": 45.0,
                "eta_minutes": 0.0,
                "patients_onboard": 0,
                "patient_capacity": 2
            },
            {
                "ambulance_id": "AMB-04",
                "callsign": "Ambulance 04",
                "type": "ALS",
                "status": "AVAILABLE",
                "assigned_zone": "Z3",
                "current_location": [73.8744, 18.5284],  # Sassoon General Hospital
                "target_location": None,
                "current_incident_id": None,
                "active_route": None,
                "previous_route": None,
                "route_progress": 0.0,
                "speed_multiplier": 1.0,
                "speed_kmh": 45.0,
                "eta_minutes": 0.0,
                "patients_onboard": 0,
                "patient_capacity": 2
            }
        ]

        self.incidents = []
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

        # 3. Check for Live Ambulance Rerouting if active route traverses blocked roads
        for amb in self.ambulances:
            if amb["status"] in ["EN_ROUTE_TO_PATIENT", "EN_ROUTE_TO_HOSPITAL"] and amb.get("active_route"):
                route = amb["active_route"]
                road_ids_in_route = route.get("road_ids", [])
                
                # Check intersection with newly blocked roads
                intersects_blocked = any(rid in blocked_roads for rid in road_ids_in_route)
                if intersects_blocked and amb.get("target_location"):
                    # Recalculate route from ambulance's current location!
                    new_route = self.routing_graph.calculate_route(amb["current_location"], amb["target_location"])
                    if new_route:
                        amb["previous_route"] = copy.deepcopy(amb["active_route"])
                        amb["active_route"] = new_route
                        amb["route_progress"] = 0.0
                        amb["eta_minutes"] = new_route["duration_min"]
                        self.log_event(f"⚡ LIVE REROUTE: {amb['ambulance_id']} redirected via safe route ({new_route['distance_km']} km, ETA {new_route['duration_min']}m).", "alert")
                    else:
                        amb["status"] = "BLOCKED_NO_ROUTE"
                        self.log_event(f"CRITICAL: {amb['ambulance_id']} has no viable route to destination due to floodwaters!", "critical")

        # 4. Advance Ambulances Along Routes
        for amb in self.ambulances:
            if amb["status"] in ["EN_ROUTE_TO_PATIENT", "EN_ROUTE_TO_HOSPITAL"] and amb.get("active_route"):
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
                    if amb["status"] == "EN_ROUTE_TO_PATIENT":
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

        amb["status"] = "COMPLETED"
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
            self.log_event(f"DISPATCH ALERT: No accessible ambulance for {incident['incident_id']}! Reason: {explanation}", "warning")

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
            "events": self.events[:25]
        }
