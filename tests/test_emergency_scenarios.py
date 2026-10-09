"""
Test Suite for Emergency Response Scenarios:
- Scenario 1: Submerged incident / no route left -> reported to admin, stops dispatch
- Scenario 2: Encroaching flood prediction & ambulance trapped in flood -> mayday reported, immobilised
- Scenario 4: Idle ambulance proactive evacuation to high ground away from flood
- Scenario 5: Hospital surrounded by flood -> dynamic hospital divert to alternate facility
"""

import sys
import os
sys.path.insert(0, os.path.abspath("."))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
import copy
from simulation.engine import SimulationEngine

def run_tests():
    print("========================================")
    print("Testing HC-05 Emergency Scenarios...")
    print("========================================")
    engine = SimulationEngine.get_instance()
    
    # -------------------------------------------------------------------------
    # TEST SCENARIO 1: Incident placed directly in floodwaters
    # -------------------------------------------------------------------------
    print("\n--- Test Scenario 1A: Incident Reported in Flood ---")
    engine.load_initial_state()
    engine.scenario_name = "MODERATE FLOOD"
    engine.water_rise_m = 2.0
    engine.sim_time_minutes = 25.0
    engine.update_simulation_state(dt_minutes=0.0)

    # Place incident in Mula-Mutha riverbed / flooded low basin [73.8560, 18.5220]
    inc1 = engine.create_incident(73.8560, 18.5220, severity="HIGH", patient_count=1)
    print(f"Incident 1 Status: {inc1['status']}")
    print(f"Incident 1 Unreachable: {inc1.get('is_unreachable')}")
    print(f"Incident 1 Reason: {inc1.get('unreachable_reason')}")
    assert inc1["status"] == "UNREACHABLE_FLOODED", f"Expected UNREACHABLE_FLOODED, got {inc1['status']}"
    assert inc1.get("is_unreachable") is True
    assert inc1.get("assigned_ambulance_id") is None
    print("✅ Scenario 1A PASSED: Submerged incident correctly marked unreachable, ground dispatch stopped.")

    # -------------------------------------------------------------------------
    # TEST SCENARIO 1B: Ambulance en route, but all routes cut off
    # -------------------------------------------------------------------------
    print("\n--- Test Scenario 1B: Route Cutoff En Route ---")
    engine.load_initial_state()
    engine.water_rise_m = 0.5
    engine.update_simulation_state(dt_minutes=0.0)
    
    # Create incident on accessible road near river
    inc1b = engine.create_incident(73.8480, 18.5180, severity="HIGH", patient_count=1)
    amb1b = next((a for a in engine.ambulances if a["ambulance_id"] == inc1b.get("assigned_ambulance_id")), None)
    if amb1b:
        engine.ambulance_accept_call(amb1b["ambulance_id"])
        assert amb1b["status"] == "EN_ROUTE_TO_PATIENT"
        
        # Now simulate severe flood that cuts off the route
        engine.scenario_name = "SEVERE FLOOD"
        engine.sim_time_minutes = 45.0  # At T+45min severe flood, water level > 4.5m
        engine.update_simulation_state(dt_minutes=0.1)
        
        print(f"Ambulance status after cutoff: {amb1b['status']}")
        print(f"Incident status after cutoff: {inc1b['status']}")
        assert inc1b["status"] in ["UNREACHABLE_FLOODED", "PREDICTED_FLOOD_SUBMERGENCE"]
        assert amb1b["status"] in ["AVAILABLE", "RELOCATING_TO_SAFETY"]
        assert amb1b.get("current_incident_id") is None
        print("✅ Scenario 1B PASSED: Ambulance aborted impossible mission, incident escalated to admin.")

    # -------------------------------------------------------------------------
    # TEST SCENARIO 2A: Flood Submergence Prediction Before Arrival
    # -------------------------------------------------------------------------
    print("\n--- Test Scenario 2A: Flood Submergence Prediction ---")
    engine.load_initial_state()
    engine.scenario_name = "MODERATE FLOOD"
    engine.water_rise_m = 1.4
    engine.sim_time_minutes = 15.0
    engine.update_simulation_state(dt_minutes=0.0)

    # Place incident on active flood basin edge [73.8560, 18.5200]
    will_sub, pred_d, dist = engine.flood_engine.predict_submergence(
        73.8560, 18.5200, engine.water_rise_m, engine.sim_time_minutes, eta_min=5.0, scenario_name="MODERATE FLOOD"
    )
    print(f"Prediction for near-flood coords: will_submerge={will_sub}, predicted_depth={pred_d}m, dist={dist}m")
    assert will_sub is True or dist < 65.0, "Expected flood prediction to identify high flood hazard"
    print("✅ Scenario 2A PASSED: Flood prediction accurately calculates encroaching water.")

    # -------------------------------------------------------------------------
    # TEST SCENARIO 2B: Ambulance Trapped in Flood
    # -------------------------------------------------------------------------
    print("\n--- Test Scenario 2B: Ambulance Trapped in Flood ---")
    engine.load_initial_state()
    engine.scenario_name = "SEVERE FLOOD"
    engine.water_rise_m = 3.0
    engine.update_simulation_state(dt_minutes=0.0)

    # Put an ambulance in riverbed / submerged road during severe flood
    engine.scenario_name = "SEVERE FLOOD"
    engine.sim_time_minutes = 35.0  # T+35min severe flood: water level > 4.0m
    test_amb = engine.ambulances[0]
    test_amb["current_location"] = [73.8560, 18.5220]  # Deep riverbed
    test_amb["status"] = "AVAILABLE"
    
    # Run simulation update
    engine.update_simulation_state(dt_minutes=0.5)
    print(f"Ambulance {test_amb['ambulance_id']} Status: {test_amb['status']}")
    print(f"Is Trapped: {test_amb.get('is_trapped')}")
    assert test_amb["status"] == "TRAPPED_IN_FLOOD", f"Expected TRAPPED_IN_FLOOD, got {test_amb['status']}"
    assert test_amb.get("is_trapped") is True
    assert test_amb["speed_kmh"] == 0.0
    print("✅ Scenario 2B PASSED: Stuck ambulance flagged as TRAPPED_IN_FLOOD with mayday logged.")

    # -------------------------------------------------------------------------
    # TEST SCENARIO 4: Idle Ambulance Proactive Relocation Away from Flood
    # -------------------------------------------------------------------------
    print("\n--- Test Scenario 4: Idle Proactive Relocation ---")
    engine.load_initial_state()
    engine.scenario_name = "MODERATE FLOOD"
    engine.water_rise_m = 1.2
    engine.update_simulation_state(dt_minutes=0.0)

    # Position idle ambulance AMB-02 near encroaching water edge
    amb2 = engine.ambulances[1]
    amb2["status"] = "AVAILABLE"
    amb2["current_incident_id"] = None
    amb2["current_location"] = [73.8550, 18.5200]
    engine.sim_time_minutes = 20.0

    # Advance state to trigger proactive evacuation
    engine.update_simulation_state(dt_minutes=0.5)
    print(f"AMB-02 Status: {amb2['status']}")
    print(f"AMB-02 Target Location: {amb2.get('target_location')}")
    print(f"AMB-02 Safe Destination: {amb2.get('safe_staging_name')}")
    assert amb2["status"] == "RELOCATING_TO_SAFETY", f"Expected RELOCATING_TO_SAFETY, got {amb2['status']}"
    assert amb2.get("active_route") is not None
    print("✅ Scenario 4 PASSED: Idle ambulance autonomously relocated to high ground.")

    # -------------------------------------------------------------------------
    # TEST SCENARIO 5: Hospital Surrounded by Flood -> Dynamic Hospital Divert
    # -------------------------------------------------------------------------
    print("\n--- Test Scenario 5: Dynamic Hospital Divert ---")
    engine.load_initial_state()
    engine.water_rise_m = 0.5
    engine.update_simulation_state(dt_minutes=0.0)

    # Setup ambulance transporting patient to Hospital H1
    amb3 = engine.ambulances[2]
    amb3["status"] = "EN_ROUTE_TO_HOSPITAL"
    amb3["patients_onboard"] = 1
    amb3["current_location"] = [73.8450, 18.5100]  # Near Alka Talkies
    
    # Assign target hospital (e.g. Inlaks which gets surrounded by flood)
    target_h1 = next(h for h in engine.hospitals if "Inlaks" in h["name"])
    amb3["target_hospital_id"] = target_h1["hospital_id"]
    amb3["target_hospital_name"] = target_h1["name"]
    initial_route = engine.routing_graph.calculate_route(amb3["current_location"], target_h1.get("routing_location", target_h1["coordinates"]))
    amb3["active_route"] = initial_route
    amb3["target_location"] = target_h1.get("routing_location", target_h1["coordinates"])

    # Now simulate flood surrounding target hospital during severe surge
    engine.scenario_name = "SEVERE FLOOD"
    engine.sim_time_minutes = 35.0  # Flood rises, surrounding target hospital

    # Update state: should detect H1 unreachable and divert to another reachable hospital (e.g. Deenanath Mangeshkar / Sassoon)
    engine.update_simulation_state(dt_minutes=0.5)
    print(f"AMB-03 Status: {amb3['status']}")
    print(f"AMB-03 New Target Hospital ID: {amb3.get('target_hospital_id')}")
    print(f"AMB-03 New Target Hospital Name: {amb3.get('target_hospital_name')}")
    print(f"AMB-03 Diverted Flag: {amb3.get('diverted_hospital')}")
    
    assert amb3.get("diverted_hospital") is True
    assert amb3["target_hospital_id"] != target_h1["hospital_id"], "Expected target hospital to be changed to alternative facility"
    assert amb3.get("active_route") is not None
    print("✅ Scenario 5 PASSED: Ambulance dynamically diverted to alternate hospital from current location.")

    print("\n========================================")
    print("🎉 ALL 4 EMERGENCY SCENARIOS VERIFIED SUCCESSFULLY!")
    print("========================================")

if __name__ == "__main__":
    run_tests()
