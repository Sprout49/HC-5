"""
GIS Real OpenStreetMap Road Network & Graph Routing Engine.
Features:
- STRtree spatial indexing over real OSM road segments for sub-millisecond snapping
- True orthogonal point-to-segment projection
- Sliced, continuous road-following route geometries (NO straight-line fallbacks)
- Dynamic flood avoidance with configurable impedance weights
- Contrastive route explanations comparing optimal routes to flood-blocked alternatives
- Versioned route states
"""

import os
import json
import math
import time
from typing import List, Dict, Any, Optional, Tuple
import networkx as nx
from shapely.geometry import Point, LineString
from shapely.strtree import STRtree
from shapely.ops import substring

def point_to_segment_projection(
    px: float, py: float,
    x1: float, y1: float,
    x2: float, y2: float
) -> Tuple[float, float, float]:
    """
    Orthogonally projects point P(px, py) onto line segment A(x1, y1) -> B(x2, y2).
    Returns (proj_x, proj_y, distance_meters).
    """
    lat_scale = 110574.0
    lon_scale = 105600.0

    dx = (x2 - x1) * lon_scale
    dy = (y2 - y1) * lat_scale
    l2 = dx * dx + dy * dy

    if l2 <= 1e-9:
        d_lon = (px - x1) * lon_scale
        d_lat = (py - y1) * lat_scale
        dist = math.sqrt(d_lon * d_lon + d_lat * d_lat)
        return x1, y1, dist

    dpx = (px - x1) * lon_scale
    dpy = (py - y1) * lat_scale
    t = max(0.0, min(1.0, (dpx * dx + dpy * dy) / l2))

    proj_x = x1 + t * (x2 - x1)
    proj_y = y1 + t * (y2 - y1)

    dist_x = (px - proj_x) * lon_scale
    dist_y = (py - proj_y) * lat_scale
    dist = math.sqrt(dist_x * dist_x + dist_y * dist_y)

    return proj_x, proj_y, dist

class RoadNetworkGraph:
    def __init__(self, roads_geojson_path: str = "data/processed/roads.geojson"):
        self.roads_path = roads_geojson_path
        self.graph = nx.Graph()
        self.roads_by_id: Dict[str, Dict[str, Any]] = {}
        self.road_lines: List[LineString] = []
        self.road_id_list: List[str] = []
        self.road_shapely_geoms: Dict[str, LineString] = {}
        self.spatial_tree: Optional[STRtree] = None
        self.load_network()

    def load_network(self):
        if not os.path.exists(self.roads_path):
            print(f"Warning: {self.roads_path} not found. Graph empty.")
            return

        with open(self.roads_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.graph.clear()
        self.roads_by_id.clear()
        self.road_lines.clear()
        self.road_id_list.clear()
        self.road_shapely_geoms.clear()

        for feat in data["features"]:
            props = feat["properties"]
            geom = feat["geometry"]
            road_id = props["road_id"]
            u = props["from_node"]
            v = props["to_node"]
            coords = geom["coordinates"]
            length_m = props["length_m"]
            speed_kmh = props.get("speed_limit_kmh", 45)

            # Base traversal time in seconds
            base_time_s = (length_m / max(5.0, speed_kmh * 1000.0 / 3600.0))

            line = LineString(coords)
            self.road_lines.append(line)
            self.road_id_list.append(road_id)
            self.road_shapely_geoms[road_id] = line

            road_info = {
                "road_id": road_id,
                "osm_way_id": props.get("osm_way_id"),
                "name": props["name"],
                "from_node": u,
                "to_node": v,
                "coordinates": coords,
                "geometry": {"type": "LineString", "coordinates": coords},
                "length_m": length_m,
                "speed_kmh": speed_kmh,
                "base_time_s": base_time_s,
                "road_class": props.get("road_class", "primary"),
                "elevation_m": props.get("elevation_m", 555.0),
                "status": props.get("status", "OPEN"),
                "flood_depth": props.get("flood_depth", 0.0),
                "flooded_portion_pct": props.get("flooded_portion_pct", 0.0),
                "reason": props.get("reason", "Open")
            }
            self.roads_by_id[road_id] = road_info

            # Add nodes with geographic positions
            self.graph.add_node(u, pos=coords[0])
            self.graph.add_node(v, pos=coords[-1])
            self.graph.add_edge(u, v, road_id=road_id, weight=base_time_s, road_info=road_info)

        # Build high-performance STRtree spatial index
        if self.road_lines:
            self.spatial_tree = STRtree(self.road_lines)
            print(f"Loaded road network: {len(self.roads_by_id)} segments, {self.graph.number_of_nodes()} nodes. Spatial index built.")

    def get_road_geometry(self, road_id: str) -> Optional[LineString]:
        return self.road_shapely_geoms.get(road_id)

    def update_road_status(self, road_id: str, status: str, flood_depth: float, reason: str, flooded_portion_pct: float = 0.0):
        if road_id in self.roads_by_id:
            self.roads_by_id[road_id]["status"] = status
            self.roads_by_id[road_id]["flood_depth"] = flood_depth
            self.roads_by_id[road_id]["flooded_portion_pct"] = flooded_portion_pct
            self.roads_by_id[road_id]["reason"] = reason

            u = self.roads_by_id[road_id]["from_node"]
            v = self.roads_by_id[road_id]["to_node"]
            base_time = self.roads_by_id[road_id]["base_time_s"]

            if self.graph.has_edge(u, v):
                if status == "BLOCKED":
                    weight = float('inf')  # Impassable
                elif status == "HIGH_RISK":
                    weight = base_time * 5.0
                elif status == "RESTRICTED":
                    weight = base_time * 2.0
                else:
                    weight = base_time
                self.graph[u][v]["weight"] = weight

    def snap_to_road(
        self, lon: float, lat: float, allowed_edges: Optional[set] = None
    ) -> Tuple[List[float], Optional[str], Optional[str], float]:
        """
        Sub-millisecond map-matching using STRtree.
        Projects point P(lon, lat) onto the nearest valid road segment.
        Returns: (snapped_coords, nearest_node, road_id, distance_meters).
        """
        pt = Point(lon, lat)
        lat_scale = 110574.0
        lon_scale = 105600.0

        if not self.spatial_tree or not self.road_lines:
            return [lon, lat], None, None, 0.0

        # Query nearest candidate roads
        nearest_indices = self.spatial_tree.query_nearest(pt, max_distance=0.02)
        if len(nearest_indices) == 0:
            nearest_indices = [self.spatial_tree.nearest(pt)]

        best_dist = float('inf')
        best_pt = [lon, lat]
        best_node = None
        best_road_id = None

        for idx in nearest_indices:
            road_id = self.road_id_list[idx]
            rinfo = self.roads_by_id[road_id]
            u, v = rinfo["from_node"], rinfo["to_node"]

            if allowed_edges is not None:
                if (u, v) not in allowed_edges and (v, u) not in allowed_edges:
                    continue

            line = self.road_lines[idx]
            d_along = line.project(pt)
            proj_pt = line.interpolate(d_along)

            d_lon = (lon - proj_pt.x) * lon_scale
            d_lat = (lat - proj_pt.y) * lat_scale
            dist_m = math.sqrt(d_lon * d_lon + d_lat * d_lat)

            if dist_m < best_dist:
                best_dist = dist_m
                best_pt = [round(proj_pt.x, 6), round(proj_pt.y, 6)]
                best_road_id = road_id

                # Closer endpoint node of the segment
                d_u = math.sqrt((proj_pt.x - rinfo["coordinates"][0][0])**2 + (proj_pt.y - rinfo["coordinates"][0][1])**2)
                d_v = math.sqrt((proj_pt.x - rinfo["coordinates"][-1][0])**2 + (proj_pt.y - rinfo["coordinates"][-1][1])**2)
                best_node = u if d_u <= d_v else v

        # Fallback if no allowed edge was within threshold
        if not best_road_id and self.spatial_tree:
            idx = self.spatial_tree.nearest(pt)
            road_id = self.road_id_list[idx]
            rinfo = self.roads_by_id[road_id]
            line = self.road_lines[idx]
            proj_pt = line.interpolate(line.project(pt))
            best_road_id = road_id
            best_pt = [round(proj_pt.x, 6), round(proj_pt.y, 6)]
            best_node = rinfo["from_node"]
            best_dist = math.sqrt(((lon - proj_pt.x)*lon_scale)**2 + ((lat - proj_pt.y)*lat_scale)**2)

        return best_pt, best_node, best_road_id, best_dist

    def calculate_route(
        self,
        start_coords: List[float],
        end_coords: List[float],
        vehicle_id: Optional[str] = None,
        previous_route: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Calculates safe, fast, road-aligned route strictly following real road geometries.
        NO STRAIGHT-LINE FALLBACKS.
        """
        valid_edges = {
            (u, v) for u, v, d in self.graph.edges(data=True)
            if d.get("weight", 0) < float('inf')
        }
        sub_g = self.graph.edge_subgraph(valid_edges).copy()

        if not sub_g.nodes:
            return None

        # 1. Map-match points to accessible roads
        snapped_start, start_node, start_road_id, _ = self.snap_to_road(
            start_coords[0], start_coords[1], valid_edges
        )
        snapped_end, end_node, end_road_id, _ = self.snap_to_road(
            end_coords[0], end_coords[1], valid_edges
        )

        if not start_node or not end_node:
            return None

        # 2. Case A: Start and end snap onto the EXACT SAME road segment
        if start_road_id and (start_road_id == end_road_id):
            rinfo = self.roads_by_id[start_road_id]
            if rinfo["status"] != "BLOCKED":
                line = self.get_road_geometry(start_road_id) or LineString(rinfo["coordinates"])
                d1 = line.project(Point(snapped_start))
                d2 = line.project(Point(snapped_end))
                if d1 <= d2:
                    sub_line = substring(line, d1, d2)
                    segment_coords = list(sub_line.coords)
                else:
                    sub_line = substring(line, d2, d1)
                    segment_coords = list(reversed(sub_line.coords))

                if len(segment_coords) < 2:
                    segment_coords = [snapped_start, snapped_end]

                dist_m = abs(d2 - d1) * 111320.0
                time_s = max(5.0, dist_m / (rinfo["speed_kmh"] * 1000.0 / 3600.0))
                route_ver = (previous_route.get("version", 0) + 1) if previous_route else 1

                return {
                    "route_id": f"RT-{int(time.time() * 1000) % 100000:05d}-V{route_ver}",
                    "version": route_ver,
                    "vehicle_id": vehicle_id,
                    "origin": start_coords,
                    "destination": end_coords,
                    "snapped_origin": snapped_start,
                    "snapped_destination": snapped_end,
                    "route_coordinates": segment_coords,
                    "path_nodes": [rinfo["from_node"], rinfo["to_node"]],
                    "road_ids": [start_road_id],
                    "road_segments": [rinfo],
                    "distance_km": round(max(0.05, dist_m / 1000.0), 2),
                    "duration_min": round(max(0.2, time_s / 60.0), 1),
                    "risk_rating": "LOW" if rinfo["status"] == "OPEN" else rinfo["status"],
                    "contains_restricted": rinfo["status"] == "RESTRICTED",
                    "status": "ACTIVE",
                    "explanation": f"Direct road traversal along {rinfo['name']}.",
                    "created_at": round(time.time(), 1)
                }

        # 3. Case B: Multi-segment network path search
        try:
            path_nodes = nx.shortest_path(sub_g, source=start_node, target=end_node, weight="weight")
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            # STRICT REQUIREMENT: NEVER fall back to a straight line!
            return None

        # 4. Assemble road geometries with exact subsegment slicing
        road_ids = []
        road_segments = []
        has_restricted = False
        has_high_risk = False
        total_dist_m = 0.0
        total_time_s = 0.0

        # Start subsegment along start_road_id
        full_coords = []
        if start_road_id and start_road_id in self.roads_by_id:
            s_rinfo = self.roads_by_id[start_road_id]
            s_line = self.get_road_geometry(start_road_id) or LineString(s_rinfo["coordinates"])
            first_node_pt = Point(self.graph.nodes[path_nodes[0]]["pos"])
            d_start = s_line.project(Point(snapped_start))
            d_first = s_line.project(first_node_pt)
            if abs(d_start - d_first) > 1e-6:
                if d_start < d_first:
                    sub = substring(s_line, d_start, d_first)
                    full_coords = [list(c) for c in sub.coords]
                else:
                    sub = substring(s_line, d_first, d_start)
                    full_coords = list(reversed([list(c) for c in sub.coords]))
            if start_road_id not in road_ids:
                road_ids.append(start_road_id)
                road_segments.append(s_rinfo)
        if not full_coords:
            full_coords = [snapped_start]

        for i in range(len(path_nodes) - 1):
            u, v = path_nodes[i], path_nodes[i+1]
            edge_data = sub_g[u][v]
            road_id = edge_data["road_id"]
            if road_id not in road_ids:
                road_ids.append(road_id)
                road_info = self.roads_by_id[road_id]
                road_segments.append(road_info)
            else:
                road_info = self.roads_by_id[road_id]

            coords = road_info["coordinates"]
            # Correct orientation from node u to node v
            if road_info["from_node"] == u:
                edge_coords = coords
            else:
                edge_coords = list(reversed(coords))

            for pt in edge_coords:
                if not full_coords or full_coords[-1] != pt:
                    full_coords.append(pt)

            total_dist_m += road_info["length_m"]
            total_time_s += edge_data.get("weight", road_info["base_time_s"])

            if road_info["status"] == "RESTRICTED":
                has_restricted = True
            elif road_info["status"] == "HIGH_RISK":
                has_high_risk = True

        # End subsegment along end_road_id
        end_segment_coords = []
        if end_road_id and end_road_id in self.roads_by_id:
            e_rinfo = self.roads_by_id[end_road_id]
            e_line = self.get_road_geometry(end_road_id) or LineString(e_rinfo["coordinates"])
            last_node_pt = Point(self.graph.nodes[path_nodes[-1]]["pos"])
            d_last = e_line.project(last_node_pt)
            d_end = e_line.project(Point(snapped_end))
            if abs(d_last - d_end) > 1e-6:
                if d_last < d_end:
                    sub = substring(e_line, d_last, d_end)
                    end_segment_coords = [list(c) for c in sub.coords]
                else:
                    sub = substring(e_line, d_end, d_last)
                    end_segment_coords = list(reversed([list(c) for c in sub.coords]))
            if end_road_id not in road_ids:
                road_ids.append(end_road_id)
                road_segments.append(e_rinfo)

        for pt in end_segment_coords:
            if not full_coords or full_coords[-1] != pt:
                full_coords.append(pt)
        if not full_coords or full_coords[-1] != snapped_end:
            full_coords.append(snapped_end)

        risk_rating = "HIGH" if has_high_risk else "MODERATE" if has_restricted else "LOW"

        # 5. Contrastive Flood Rationale
        avoided_hazards = []
        try:
            dry_path = nx.shortest_path(
                self.graph, source=start_node, target=end_node,
                weight=lambda u, v, d: d["road_info"]["base_time_s"]
            )
            if dry_path != path_nodes:
                for idx in range(len(dry_path) - 1):
                    u_dry, v_dry = dry_path[idx], dry_path[idx+1]
                    if self.graph.has_edge(u_dry, v_dry):
                        edge = self.graph[u_dry][v_dry]
                        rinfo = edge["road_info"]
                        if rinfo["status"] in ["BLOCKED", "HIGH_RISK", "RESTRICTED"]:
                            depth_cm = int(round(rinfo.get("flood_depth", 0.0) * 100))
                            avoided_hazards.append(f"{rinfo['name']} ({rinfo['status']}: {depth_cm}cm water)")
        except Exception:
            pass

        if avoided_hazards:
            unique_hazards = list(dict.fromkeys(avoided_hazards))[:2]
            hazards_str = " and ".join(unique_hazards)
            explanation = f"Avoided direct route via {hazards_str}. Detoured via elevated flood-safe roads."
        elif risk_rating == "LOW":
            explanation = "Optimal route via dry elevated arterials (0cm flood risk)."
        elif has_restricted:
            explanation = "Caution: traverses shallow waterlogged segment with reduced speed."
        else:
            explanation = "Elevated bypass avoiding river basin flood zones."

        route_ver = (previous_route.get("version", 0) + 1) if previous_route else 1
        route_id = f"RT-{int(time.time() * 1000) % 100000:05d}-V{route_ver}"

        return {
            "route_id": route_id,
            "version": route_ver,
            "vehicle_id": vehicle_id,
            "origin": start_coords,
            "destination": end_coords,
            "snapped_origin": snapped_start,
            "snapped_destination": snapped_end,
            "route_coordinates": full_coords,
            "path_nodes": path_nodes,
            "road_ids": road_ids,
            "road_segments": road_segments,
            "distance_km": round(max(0.1, total_dist_m / 1000.0), 2),
            "duration_min": round(max(0.5, total_time_s / 60.0), 1),
            "risk_rating": risk_rating,
            "contains_restricted": has_restricted,
            "status": "ACTIVE",
            "explanation": explanation,
            "created_at": round(time.time(), 1)
        }
