"""
DEM-Based Urban Flood Simulation & Propagation Engine for Pune Study Area.
Implements connected flood propagation from real OpenStreetMap waterway channels
across the high-resolution NASA/USGS SRTM Digital Elevation Model (DEM).

Calculates:
1. Connected spatial flood extent polygons (GeoJSON MultiPolygon) for scenario stages
2. Spatial intersection with real OSM road segments
3. Road status determination (OPEN, RESTRICTED, HIGH_RISK, BLOCKED) with explainable reasons
Outputs precomputed scenario stages to data/processed/flood/.
"""

import os
import json
from collections import deque
from typing import Dict, Any, List, Tuple
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, LineString, box
from shapely.ops import unary_union

class UrbanFloodEngine:
    def __init__(
        self,
        dem_grid_path: str = "data/raw/dem/pune_dem_grid.json",
        waterways_path: str = "data/processed/waterways.geojson",
        roads_path: str = "data/processed/roads.geojson"
    ):
        self.dem_grid_path = dem_grid_path
        self.waterways_path = waterways_path
        self.roads_path = roads_path

        with open(dem_grid_path, "r", encoding="utf-8") as f:
            self.dem_meta = json.load(f)

        with open(waterways_path, "r", encoding="utf-8") as f:
            self.waterways_geo = json.load(f)

        self.lats = np.array(self.dem_meta["lats"])
        self.lons = np.array(self.dem_meta["lons"])
        self.elev_matrix = np.array(self.dem_meta["elevation_matrix"])
        self.n_lat, self.n_lon = self.elev_matrix.shape

        # Cell size
        self.d_lat = abs(self.lats[0] - self.lats[1])
        self.d_lon = abs(self.lons[1] - self.lons[0])

        self.seed_cells = self._identify_waterway_seed_cells()
        print(f"Identified {len(self.seed_cells)} waterway seed cells for connected flood propagation.")

    def _identify_waterway_seed_cells(self) -> List[Tuple[int, int]]:
        seeds = set()
        for feat in self.waterways_geo["features"]:
            geom = feat.get("geometry", {})
            coords = []
            if geom.get("type") == "LineString":
                coords = geom.get("coordinates", [])
            elif geom.get("type") == "Polygon":
                coords = geom.get("coordinates", [[]])[0]

            for pt in coords:
                lon, lat = pt[0], pt[1]
                # Find closest grid index
                r = int(np.clip(int((self.lats[0] - lat) / (self.lats[0] - self.lats[-1]) * (self.n_lat - 1)), 0, self.n_lat - 1))
                c = int(np.clip(int((lon - self.lons[0]) / (self.lons[-1] - self.lons[0]) * (self.n_lon - 1)), 0, self.n_lon - 1))
                seeds.add((r, c))
                # Add 4-connected neighbors for river channel width
                for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < self.n_lat and 0 <= nc < self.n_lon:
                        seeds.add((nr, nc))
        return list(seeds)

    def compute_flood_surface(self, water_rise_m: float) -> Tuple[MultiPolygon, np.ndarray]:
        """
        Connected flood propagation starting from waterway seed cells.
        Baseline riverbed datum in Pune central basin is ~548.0m MSL.
        """
        flood_level = 548.5 + float(water_rise_m)
        depth_grid = np.zeros_like(self.elev_matrix)
        visited = set()
        queue = deque()

        # Seed queue
        for r, c in self.seed_cells:
            elev = self.elev_matrix[r, c]
            if elev <= flood_level:
                queue.append((r, c))
                visited.add((r, c))
                depth_grid[r, c] = max(0.0, flood_level - elev)

        # BFS Connected Propagation
        while queue:
            r, c = queue.popleft()
            curr_depth = depth_grid[r, c]

            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < self.n_lat and 0 <= nc < self.n_lon:
                    if (nr, nc) not in visited:
                        neighbor_elev = self.elev_matrix[nr, nc]
                        # Flood propagates if terrain is lower than current water surface
                        if neighbor_elev <= flood_level:
                            depth = flood_level - neighbor_elev
                            depth_grid[nr, nc] = depth
                            visited.add((nr, nc))
                            queue.append((nr, nc))

        # Build Polygon surface from flooded cells
        polys = []
        for r in range(self.n_lat):
            for c in range(self.n_lon):
                if depth_grid[r, c] > 0.05:
                    lat_center = self.lats[r]
                    lon_center = self.lons[c]
                    # Grid cell polygon
                    cell_box = box(
                        lon_center - self.d_lon / 2.0,
                        lat_center - self.d_lat / 2.0,
                        lon_center + self.d_lon / 2.0,
                        lat_center + self.d_lat / 2.0
                    )
                    polys.append(cell_box)

        if not polys:
            return MultiPolygon([]), depth_grid

        # Merge contiguous cells
        merged = unary_union(polys)
        if isinstance(merged, Polygon):
            surface = MultiPolygon([merged])
        else:
            surface = merged

        # Smooth slightly (tolerance ~30m)
        smoothed = surface.simplify(0.0003, preserve_topology=True)
        return smoothed, depth_grid

    def update_road_conditions(self, water_rise_m: float) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        flood_poly, depth_grid = self.compute_flood_surface(water_rise_m)

        with open(self.roads_path, "r", encoding="utf-8") as f:
            roads_geo = json.load(f)

        updated_roads = []
        blocked_count = 0
        restricted_count = 0
        high_risk_count = 0

        for feat in roads_geo["features"]:
            coords = feat["geometry"]["coordinates"]
            line = LineString(coords)
            props = dict(feat["properties"])
            elev = props.get("elevation_m", 555.0)

            # Spatial intersection with flood surface
            if flood_poly.is_empty or not flood_poly.intersects(line):
                props["flood_depth"] = 0.0
                props["flooded_portion_pct"] = 0.0
                props["status"] = "OPEN"
                props["reason"] = "Normal conditions: road elevation is above flood surface"
            else:
                intersection = flood_poly.intersection(line)
                flooded_length = float(intersection.length)
                total_length = float(line.length)
                flooded_ratio = flooded_length / max(total_length, 1e-6)

                # Local flood depth from water level vs road deck elevation
                water_surface = 548.5 + water_rise_m
                depth = max(0.0, round(water_surface - elev, 2))

                props["flood_depth"] = depth
                props["flooded_portion_pct"] = round(flooded_ratio * 100.0, 1)

                # Configurable emergency vehicle accessibility rules
                if depth > 0.50 or flooded_ratio > 0.55:
                    props["status"] = "BLOCKED"
                    props["reason"] = f"Simulated flood depth reached {depth:.2f}m ({props['flooded_portion_pct']:.0f}% of road inundated), exceeding emergency access clearance (0.50m)."
                    blocked_count += 1
                elif depth > 0.30 or flooded_ratio > 0.30:
                    props["status"] = "HIGH_RISK"
                    props["reason"] = f"Hazardous water flow: simulated depth {depth:.2f}m ({props['flooded_portion_pct']:.0f}% of segment inundated) approaching emergency vehicle limit."
                    high_risk_count += 1
                elif depth > 0.08 or flooded_ratio > 0.10:
                    props["status"] = "RESTRICTED"
                    props["reason"] = f"Shallow water flow: {depth:.2f}m depth ({props['flooded_portion_pct']:.0f}% inundated). Speed restricted to 20 km/h."
                    restricted_count += 1
                else:
                    props["status"] = "OPEN"
                    props["reason"] = f"Minor surface water ({depth:.2f}m); road passable with caution."

            feat["properties"] = props
            updated_roads.append(feat)

        summary = {
            "water_rise_m": water_rise_m,
            "blocked_roads": blocked_count,
            "high_risk_roads": high_risk_count,
            "restricted_roads": restricted_count,
            "open_roads": len(updated_roads) - (blocked_count + high_risk_count + restricted_count)
        }
        return updated_roads, summary

def generate_precomputed_flood_scenarios():
    os.makedirs("data/processed/flood", exist_ok=True)
    engine = UrbanFloodEngine()

    # Precompute standard disaster stages:
    # Stage 0: 0.0m (dry baseline)
    # Stage 1: 1.5m (moderate river surge)
    # Stage 2: 2.8m (severe inundation)
    # Stage 3: 4.2m (extreme regional catastrophe)
    stages = [0.0, 1.5, 2.8, 4.2]

    for stage_idx, rise_m in enumerate(stages):
        print(f"\nPrecomputing Flood Scenario Stage {stage_idx} (Rise: {rise_m:.1f}m)...")
        poly, _ = engine.compute_flood_surface(rise_m)
        
        # Save flood polygon GeoJSON
        poly_geo = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "stage": stage_idx,
                        "water_rise_m": rise_m,
                        "inundated_area_km2": round(poly.area * (111.0 * 111.0), 3) if not poly.is_empty else 0.0
                    },
                    "geometry": poly.__geo_interface__ if not poly.is_empty else {"type": "MultiPolygon", "coordinates": []}
                }
            ]
        }
        poly_path = f"data/processed/flood/flood_extent_stage{stage_idx}.geojson"
        with open(poly_path, "w", encoding="utf-8") as f:
            json.dump(poly_geo, f, indent=2)
        print(f"Saved spatial flood polygon to {poly_path}")

        # Update roads for this stage
        updated_roads, summary = engine.update_road_conditions(rise_m)
        print(f"Road status summary at Stage {stage_idx}: {summary}")

    print("\n--- Flood Simulation Precomputations Completed Successfully ---")

if __name__ == "__main__":
    generate_precomputed_flood_scenarios()
