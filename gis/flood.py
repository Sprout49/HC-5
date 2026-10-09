"""
Spatial Flood Simulation & Hydraulic Road Interaction Engine.
Provides:
- Connected flood surface propagation from OpenStreetMap waterways across the SRTM DEM
- Generation of spatial MultiPolygon flood extent GeoJSON
- Spatial intersection with road geometries to derive exact flood depth and inundation ratio
- Explainable emergency vehicle accessibility status (OPEN, RESTRICTED, HIGH_RISK, BLOCKED)
"""

import os
import json
from collections import deque
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box
from shapely.ops import unary_union

class UrbanFloodEngine:
    _instance = None

    def __init__(
        self,
        dem_grid_path: str = "data/raw/dem/pune_dem_grid.json",
        waterways_path: str = "data/processed/waterways.geojson"
    ):
        self.dem_grid_path = dem_grid_path
        self.waterways_path = waterways_path
        self.dem_meta = {}
        self.waterways_geo = {}
        self.seed_cells: List[Tuple[int, int]] = []
        self._load_data()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = UrbanFloodEngine()
        return cls._instance

    def _load_data(self):
        if not os.path.exists(self.dem_grid_path) or not os.path.exists(self.waterways_path):
            print("Flood engine data files not found yet.")
            return

        with open(self.dem_grid_path, "r", encoding="utf-8") as f:
            self.dem_meta = json.load(f)

        with open(self.waterways_path, "r", encoding="utf-8") as f:
            self.waterways_geo = json.load(f)

        self.lats = np.array(self.dem_meta["lats"])
        self.lons = np.array(self.dem_meta["lons"])
        self.elev_matrix = np.array(self.dem_meta["elevation_matrix"])
        self.n_lat, self.n_lon = self.elev_matrix.shape

        self.d_lat = abs(self.lats[0] - self.lats[1])
        self.d_lon = abs(self.lons[1] - self.lons[0])

        self.seed_cells = self._identify_waterway_seed_cells()

    def _identify_waterway_seed_cells(self) -> List[Tuple[int, int]]:
        seeds = set()
        for feat in self.waterways_geo.get("features", []):
            geom = feat.get("geometry", {})
            coords = []
            if geom.get("type") == "LineString":
                coords = geom.get("coordinates", [])
            elif geom.get("type") == "Polygon":
                coords = geom.get("coordinates", [[]])[0]

            for pt in coords:
                lon, lat = pt[0], pt[1]
                r = int(np.clip(int((self.lats[0] - lat) / (self.lats[0] - self.lats[-1]) * (self.n_lat - 1)), 0, self.n_lat - 1))
                c = int(np.clip(int((lon - self.lons[0]) / (self.lons[-1] - self.lons[0]) * (self.n_lon - 1)), 0, self.n_lon - 1))
                seeds.add((r, c))
                for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < self.n_lat and 0 <= nc < self.n_lon:
                        seeds.add((nr, nc))
        return list(seeds)

    def compute_flood_surface(self, water_rise_m: float) -> Tuple[MultiPolygon, np.ndarray, Dict[str, Any]]:
        """
        Calculates connected flood surface from waterway seed cells using water level.
        Returns: (shapely MultiPolygon, depth_grid, GeoJSON FeatureCollection)
        """
        if not hasattr(self, 'elev_matrix') or len(self.seed_cells) == 0:
            empty_mp = MultiPolygon([])
            return empty_mp, np.zeros((1, 1)), {"type": "FeatureCollection", "features": []}

        # Baseline riverbed datum ~548.5m MSL
        flood_level = 548.5 + float(water_rise_m)
        depth_grid = np.zeros_like(self.elev_matrix)
        visited = set()
        queue = deque()

        for r, c in self.seed_cells:
            elev = self.elev_matrix[r, c]
            if elev <= flood_level:
                queue.append((r, c))
                visited.add((r, c))
                depth_grid[r, c] = max(0.0, flood_level - elev)

        while queue:
            r, c = queue.popleft()
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < self.n_lat and 0 <= nc < self.n_lon:
                    if (nr, nc) not in visited:
                        neighbor_elev = self.elev_matrix[nr, nc]
                        if neighbor_elev <= flood_level:
                            depth = flood_level - neighbor_elev
                            depth_grid[nr, nc] = depth
                            visited.add((nr, nc))
                            queue.append((nr, nc))

        polys = []
        for r in range(self.n_lat):
            for c in range(self.n_lon):
                if depth_grid[r, c] > 0.05:
                    lat_center = self.lats[r]
                    lon_center = self.lons[c]
                    cell_box = box(
                        lon_center - self.d_lon / 2.0,
                        lat_center - self.d_lat / 2.0,
                        lon_center + self.d_lon / 2.0,
                        lat_center + self.d_lat / 2.0
                    )
                    polys.append(cell_box)

        if not polys:
            empty_mp = MultiPolygon([])
            return empty_mp, depth_grid, {"type": "FeatureCollection", "features": []}

        merged = unary_union(polys)
        if isinstance(merged, Polygon):
            surface = MultiPolygon([merged])
        else:
            surface = merged

        smoothed = surface.simplify(0.0003, preserve_topology=True)
        geojson_surface = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "water_rise_m": round(water_rise_m, 2),
                        "flood_stage_m": round(flood_level, 2),
                        "inundated_area_km2": round(smoothed.area * (111.0 * 111.0), 3)
                    },
                    "geometry": smoothed.__geo_interface__
                }
            ]
        }
        return smoothed, depth_grid, geojson_surface

    def evaluate_road(
        self,
        road_props: Dict[str, Any],
        road_coords: List[List[float]],
        flood_poly: MultiPolygon,
        water_rise_m: float
    ) -> Tuple[str, float, float, str]:
        """
        Evaluates road physical accessibility based on spatial flood intersection.
        Returns: (status, flood_depth_m, flooded_ratio_pct, reason)
        """
        line = LineString(road_coords)
        elev = float(road_props.get("elevation_m", 555.0))

        if flood_poly.is_empty or not flood_poly.intersects(line):
            return "OPEN", 0.0, 0.0, "Normal conditions: road elevation is above flood surface"

        try:
            intersection = flood_poly.intersection(line)
            flooded_length = float(intersection.length)
            total_length = float(line.length)
            flooded_ratio = flooded_length / max(total_length, 1e-6)
        except Exception:
            flooded_ratio = 0.0

        water_surface = 548.5 + float(water_rise_m)
        depth = round(water_surface - elev, 2)
        if depth <= 0.0:
            return "OPEN", 0.0, 0.0, "Normal conditions: road elevation is above flood surface"

        flooded_pct = round(flooded_ratio * 100.0, 1)

        # Configurable emergency accessibility thresholds based on actual inundation depth
        if depth >= 0.50 or (depth >= 0.35 and flooded_ratio >= 0.40):
            status = "BLOCKED"
            reason = f"Simulated flood depth reached {depth:.2f}m ({flooded_pct:.0f}% of road inundated), exceeding emergency access clearance (0.50m)."
        elif depth >= 0.25 or (depth >= 0.15 and flooded_ratio >= 0.25):
            status = "HIGH_RISK"
            reason = f"Hazardous water flow: simulated depth {depth:.2f}m ({flooded_pct:.0f}% of segment inundated) approaching emergency vehicle limit."
        elif depth >= 0.08 or flooded_ratio >= 0.10:
            status = "RESTRICTED"
            reason = f"Shallow water flow: {depth:.2f}m depth ({flooded_pct:.0f}% inundated). Speed restricted to 20 km/h."
        else:
            status = "OPEN"
            reason = f"Minor surface water ({depth:.2f}m); road passable with caution."

        return status, depth, flooded_pct, reason

    def is_location_flooded(
        self,
        lon: float,
        lat: float,
        flood_poly: MultiPolygon,
        water_rise_m: float
    ) -> Tuple[bool, float, float]:
        """
        Evaluates whether a point coordinate is flooded, its local depth, and distance to flood edge.
        Returns: (is_flooded, depth_m, distance_to_flood_m)
        """
        pt = Point(lon, lat)
        dist_to_flood_m = 9999.0
        is_inside_poly = False

        if flood_poly and not flood_poly.is_empty:
            is_inside_poly = flood_poly.contains(pt) or flood_poly.intersects(pt)
            try:
                dist_to_flood_m = float(flood_poly.distance(pt)) * 111320.0
            except Exception:
                dist_to_flood_m = 0.0 if is_inside_poly else 9999.0

        # Elevation and hydraulic depth lookup
        depth_m = 0.0
        if hasattr(self, 'elev_matrix') and self.elev_matrix.size > 0:
            r = int(np.clip(int((self.lats[0] - lat) / (self.lats[0] - self.lats[-1]) * (self.n_lat - 1)), 0, self.n_lat - 1))
            c = int(np.clip(int((lon - self.lons[0]) / (self.lons[-1] - self.lons[0]) * (self.n_lon - 1)), 0, self.n_lon - 1))
            elev = float(self.elev_matrix[r, c])
            water_surface = 548.5 + float(water_rise_m)
            depth_m = max(0.0, round(water_surface - elev, 2))

        # Flooded condition: inside flood polygon OR local water depth >= 0.35m within flood basin OR immediate perimeter
        is_flooded = is_inside_poly or (depth_m >= 0.35 and dist_to_flood_m <= 120.0) or (dist_to_flood_m <= 25.0)
        return is_flooded, depth_m, round(dist_to_flood_m, 1)

    def predict_submergence(
        self,
        lon: float,
        lat: float,
        current_water_rise_m: float,
        sim_time_min: float,
        eta_min: float,
        scenario_name: str
    ) -> Tuple[bool, float, float]:
        """
        Predicts if a point coordinate will be submerged by advancing floodwaters upon vehicle ETA.
        Returns: (will_submerge, predicted_depth_m, dist_to_flood_m)
        """
        future_time = sim_time_min + max(1.0, eta_min)
        if scenario_name == "NORMAL":
            future_water = 0.2
        elif scenario_name == "MODERATE FLOOD":
            future_water = round(0.2 + (future_time / 50.0) * 3.0, 2)
        else:
            future_water = round(0.4 + (future_time / 40.0) * 4.2, 2)

        # Check future depth at location
        predicted_depth = 0.0
        if hasattr(self, 'elev_matrix') and self.elev_matrix.size > 0:
            r = int(np.clip(int((self.lats[0] - lat) / (self.lats[0] - self.lats[-1]) * (self.n_lat - 1)), 0, self.n_lat - 1))
            c = int(np.clip(int((lon - self.lons[0]) / (self.lons[-1] - self.lons[0]) * (self.n_lon - 1)), 0, self.n_lon - 1))
            elev = float(self.elev_matrix[r, c])
            future_surface = 548.5 + float(future_water)
            predicted_depth = max(0.0, round(future_surface - elev, 2))

        # Check distance to current flood surface
        pt = Point(lon, lat)
        curr_poly, _, _ = self.compute_flood_surface(current_water_rise_m)
        dist_to_flood_m = 9999.0
        if curr_poly and not curr_poly.is_empty:
            if curr_poly.contains(pt) or curr_poly.intersects(pt):
                dist_to_flood_m = 0.0
            else:
                dist_to_flood_m = float(curr_poly.distance(pt)) * 111320.0

        # Submergence predicted if future depth >= 0.25m or within immediate flood perimeter with rising water
        will_submerge = (predicted_depth >= 0.25) or (dist_to_flood_m <= 65.0 and future_water >= current_water_rise_m) or (dist_to_flood_m <= 25.0)
        return will_submerge, predicted_depth, round(dist_to_flood_m, 1)
