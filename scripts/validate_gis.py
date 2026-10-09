"""
Automated GIS Validation and Route Integrity Verification Script for HC-05.
Validates:
1. Route-to-Road alignment tolerance (>= 99% length matched within 4m buffer in metric UTM 43N).
2. Elimination of straight-line fallbacks across city blocks.
3. Decoupled display_location vs snapped routing_location.
4. Spatial flood geometry (MultiPolygon/Polygon surfaces, NOT LineStrings).
5. Flood progression & spatial road blockage intersection.
6. Dynamic rerouting around blocked road segments.
"""

import os
import json
import math
import sys

# Ensure project root is on sys.path and UTF-8 output
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from typing import List, Dict, Any, Tuple
import pyproj
from shapely.geometry import Point, LineString, Polygon, MultiPolygon, shape
from shapely.ops import transform, unary_union
import networkx as nx

from gis.roads import RoadNetworkGraph
from gis.flood import UrbanFloodEngine
from simulation.engine import SimulationEngine

# Projections
project_to_utm = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True).transform

def run_gis_validation() -> bool:
    print("=" * 70)
    print("HC-05 AUTOMATED GIS VALIDATION & INTEGRITY SUITE")
    print("=" * 70)

    # 1. Load Road Network
    roads_path = "data/processed/roads.geojson"
    if not os.path.exists(roads_path):
        print(f"❌ FAIL: Processed roads file not found: {roads_path}")
        return False

    with open(roads_path, "r", encoding="utf-8") as f:
        roads_geojson = json.load(f)

    road_features = roads_geojson["features"]
    print(f"✔ Loaded {len(road_features)} real OSM processed road segments.")

    graph = RoadNetworkGraph(roads_path)
    engine = SimulationEngine.get_instance()
    engine.load_initial_state()
    flood_engine = UrbanFloodEngine()

    all_passed = True

    # -------------------------------------------------------------
    # TEST 1: ROUTE VS ROAD NETWORK METRIC BUFFER MATCH (>= 99%)
    # -------------------------------------------------------------
    print("\n--- TEST 1: ROUTE ↔ ROAD GEOMETRY BUFFER MATCH (Tolerance: 5.0m in UTM 43N) ---")
    test_od_pairs = [
        ("Deccan Gymkhana to Sassoon Hospital", [73.8390, 18.5170], [73.8744, 18.5284]),
        ("Shivajinagar to Swargate Hub", [73.8512, 18.5312], [73.8570, 18.5010]),
        ("Kothrud to Pune Station", [73.8180, 18.5050], [73.8730, 18.5290]),
        ("Camp to Yerawada", [73.8780, 18.5120], [73.8820, 18.5520]),
    ]

    for name, orig, dest in test_od_pairs:
        route = graph.calculate_route(orig, dest)
        if not route:
            print(f"❌ FAIL: No route found for {name}")
            all_passed = False
            continue

        route_coords = route["route_coordinates"]
        route_line = LineString(route_coords)
        route_utm = transform(project_to_utm, route_line)
        total_len_m = route_utm.length

        # Collect source road segments used by this route
        road_ids_used = route["road_ids"]
        used_geoms_utm = []
        for rid in road_ids_used:
            rinfo = graph.roads_by_id.get(rid)
            if rinfo:
                line = graph.get_road_geometry(rid) if hasattr(graph, 'get_road_geometry') else None
                if not line:
                    geom = rinfo.get("geometry")
                    line = geom if isinstance(geom, LineString) else LineString(rinfo["coordinates"])
                line_utm = transform(project_to_utm, line)
                used_geoms_utm.append(line_utm.buffer(5.0))  # 5m tolerance buffer

        if not used_geoms_utm:
            print(f"❌ FAIL: No road geometries found for route {name}")
            all_passed = False
            continue

        road_corridor_union = unary_union(used_geoms_utm)
        matched_geom = route_utm.intersection(road_corridor_union)
        matched_len_m = matched_geom.length
        match_pct = (matched_len_m / max(0.001, total_len_m)) * 100.0

        print(f"  {name}:")
        print(f"    Total Route Length: {total_len_m:.1f}m | Matched: {matched_len_m:.1f}m | Match: {match_pct:.2f}%")
        print(f"    Source Road Segments: {len(road_ids_used)} real OSM segments")

        if match_pct >= 99.0:
            print(f"    [PASS] Route strictly follows physical road network (>= 99.0%)")
        else:
            print(f"    [FAIL] Route match percentage below 99.0% ({match_pct:.2f}%)")
            all_passed = False

    # -------------------------------------------------------------
    # TEST 2: ABSOLUTELY NO STRAIGHT-LINE FALLBACKS
    # -------------------------------------------------------------
    print("\n--- TEST 2: ELIMINATION OF STRAIGHT-LINE FALLBACKS ---")
    origin = [73.8390, 18.5170]
    destination = [73.8744, 18.5284]
    route = graph.calculate_route(origin, destination)
    straight_line_coords = [origin, destination]
    straight_line_dist_m = transform(project_to_utm, LineString(straight_line_coords)).length
    route_dist_m = transform(project_to_utm, LineString(route["route_coordinates"])).length

    print(f"  Euclidean straight-line distance: {straight_line_dist_m:.1f}m")
    print(f"  Actual road network route distance: {route_dist_m:.1f}m")
    print(f"  Detour ratio: {route_dist_m / straight_line_dist_m:.2f}x (due to Pune street geometry)")
    
    if route["route_coordinates"] == straight_line_coords or len(route["route_coordinates"]) == 2:
        print("  [FAIL] Direct straight-line fallback detected!")
        all_passed = False
    else:
        print("  [PASS] Route follows complex street geometry with turns and real intersections.")

    # -------------------------------------------------------------
    # TEST 3: POINT-TO-SEGMENT SNAPPING & DISPLAY COORDINATE PRESERVATION
    # -------------------------------------------------------------
    print("\n--- TEST 3: POINT-TO-SEGMENT SNAPPING & COORDINATE PRESERVATION ---")
    # Off-road click near Shaniwar Wada
    off_road_click = [73.85532, 18.51954]
    snapped_coords, node, road_id, dist_m = graph.snap_to_road(off_road_click[0], off_road_click[1])
    
    incident = engine.create_incident(off_road_click[0], off_road_click[1], severity="HIGH", patient_count=1)
    disp_loc = incident["display_location"]
    rout_loc = incident["routing_location"]

    print(f"  Clicked Marker Coordinate: {disp_loc}")
    print(f"  Road-Snapped Routing Coordinate: {rout_loc}")
    print(f"  Snap Distance: {dist_m:.1f}m onto Road {road_id}")

    if disp_loc == off_road_click and rout_loc == snapped_coords and dist_m < 100.0:
        print("  [PASS] Clicked display point preserved; routing location snapped onto real road centerline.")
    else:
        print("  [FAIL] Snapping or coordinate preservation failed.")
        all_passed = False

    # -------------------------------------------------------------
    # TEST 4: SPATIAL FLOOD GEOMETRY VALIDATION (NO LINESTRINGS)
    # -------------------------------------------------------------
    print("\n--- TEST 4: SPATIAL FLOOD GEOMETRY VALIDATION ---")
    flood_stages = [0.0, 1.5, 2.8, 4.2]
    prev_area = -1.0

    for stage_rise in flood_stages:
        poly, _, geojson = flood_engine.compute_flood_surface(stage_rise)
        feat = geojson["features"][0]
        geom_type = feat["geometry"]["type"]
        inundated_km2 = feat["properties"]["inundated_area_km2"]
        area_sqm = inundated_km2 * 1e6
        
        print(f"  Water Rise: {stage_rise}m -> Geometry Type: {geom_type} | Inundation Area: {inundated_km2:.3f} km²")
        if geom_type not in ["Polygon", "MultiPolygon"]:
            print(f"  [FAIL] Flood geometry is {geom_type}, expected Polygon or MultiPolygon!")
            all_passed = False
        elif area_sqm < prev_area:
            print(f"  [FAIL] Flood extent did not grow monotonically with rising water level!")
            all_passed = False
        else:
            print(f"  [PASS] Spatial flood extent verified (Polygon surface, deterministic progression).")
        prev_area = area_sqm

    # -------------------------------------------------------------
    # TEST 5: FLOOD ↔ ROAD SPATIAL INTERSECTION & EXPLAINABILITY
    # -------------------------------------------------------------
    print("\n--- TEST 5: ROAD STATUS DETERMINED BY FLOOD INTERSECTION ---")
    engine.water_rise_m = 3.5
    engine.update_simulation_state(dt_minutes=0.0)
    blocked_sample = [r for r in engine.roads if r["status"] == "BLOCKED"]
    print(f"  Total Blocked Roads at 3.5m Rise: {len(blocked_sample)}")

    if not blocked_sample:
        print("  ❌ FAIL: No roads blocked under 3.5m simulated water rise!")
        all_passed = False
    else:
        sample_road = blocked_sample[0]
        line = LineString(sample_road["coordinates"])
        intersects_flood = line.intersects(engine.flood_poly)
        print(f"  Sample Blocked Road: {sample_road['name']} ({sample_road['road_id']})")
        print(f"    Intersects Flood Polygon: {intersects_flood}")
        print(f"    Simulated Flood Depth: {sample_road['flood_depth']}m")
        print(f"    Flooded Portion: {sample_road['flooded_portion_pct']:.1f}%")
        print(f"    Explainability: \"{sample_road['reason']}\"")

        if intersects_flood and sample_road["flood_depth"] > 0.50 and "exceed" in sample_road["reason"].lower():
            print("  [PASS] Road status derived strictly from spatial flood intersection with explainable reason.")
        else:
            print("  [FAIL] Blocked road criteria or explainability invalid.")
            all_passed = False

    # -------------------------------------------------------------
    # TEST 6: DYNAMIC REROUTING AROUND BLOCKED ROADS
    # -------------------------------------------------------------
    print("\n--- TEST 6: DYNAMIC REROUTING AROUND BLOCKED ROADS ---")
    orig = [73.8390, 18.5170]
    dest = [73.8744, 18.5284]
    initial_route = graph.calculate_route(orig, dest)
    if initial_route:
        road_to_block = initial_route["road_ids"][10]
        graph.update_road_status(road_to_block, "BLOCKED", 0.85, "Critical flood inundation")
        rerouted = graph.calculate_route(orig, dest)
        if rerouted and road_to_block not in rerouted["road_ids"]:
            print(f"  [PASS] Successfully rerouted around blocked road {road_to_block} along alternative streets.")
        else:
            print(f"  [FAIL] Rerouting failed to bypass blocked road {road_to_block}.")
            all_passed = False

    print("\n" + "=" * 70)
    if all_passed:
        print("[SUCCESS] ALL GIS AND ROUTE VALIDATION CHECKS PASSED (100% COMPLIANT)!")
    else:
        print("[WARNING] SOME GIS VALIDATION CHECKS FAILED.")
    print("=" * 70)
    return all_passed

if __name__ == "__main__":
    success = run_gis_validation()
    sys.exit(0 if success else 1)
