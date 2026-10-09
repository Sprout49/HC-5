"""
Automated OpenStreetMap Data Downloader for Pune Study Area.
Queries OpenStreetMap via Overpass API for:
- Roads (motorway, trunk, primary, secondary, tertiary, residential, unclassified)
- Waterways (river, stream, canal, basin, natural=water)
- Healthcare Facilities (amenity=hospital)
- Building Footprints (landmark & core urban buildings)
Outputs raw GeoJSON datasets in data/raw/osm/.
"""

import os
import json
import time
import requests
from typing import Dict, Any, List

BBOX = {
    "south": 18.490,
    "west": 73.810,
    "north": 18.565,
    "east": 73.925
}

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
]

HEADERS = {
    "User-Agent": "HC05-EmergencySimulation/2.0 (Pune Disaster Response Research; contact: dev@sprout49.hc05)"
}

def query_overpass(query_str: str) -> Dict[str, Any]:
    last_error = None
    for url in OVERPASS_URLS:
        try:
            print(f"Querying Overpass endpoint: {url}...")
            resp = requests.post(url, data={"data": query_str}, headers=HEADERS, timeout=90)
            if resp.status_code == 200:
                return resp.json()
            else:
                print(f"Endpoint {url} returned status {resp.status_code}")
        except Exception as e:
            print(f"Endpoint {url} failed: {e}")
            last_error = e
        time.sleep(2)
    raise RuntimeError(f"All Overpass endpoints failed. Last error: {last_error}")

def parse_elements_to_geojson(elements: List[Dict[str, Any]], target_type: str) -> Dict[str, Any]:
    nodes = {}
    for el in elements:
        if el["type"] == "node":
            nodes[el["id"]] = (el["lon"], el["lat"])

    features = []
    for el in elements:
        props = el.get("tags", {})
        props["osm_id"] = el["id"]
        props["osm_type"] = el["type"]

        if el["type"] == "node" and target_type == "hospital":
            coords = [el["lon"], el["lat"]]
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Point", "coordinates": coords}
            })
        elif el["type"] == "way":
            way_nodes = el.get("nodes", [])
            coords = [nodes[nid] for nid in way_nodes if nid in nodes]
            if len(coords) < 2:
                continue

            # Determine whether polygon or linestring
            is_closed = (coords[0] == coords[-1]) and len(coords) >= 4
            if target_type == "building" or (target_type in ["waterway", "hospital"] and is_closed):
                geom_type = "Polygon"
                geom_coords = [coords]
            else:
                geom_type = "LineString"
                geom_coords = coords

            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": {"type": geom_type, "coordinates": geom_coords}
            })

    return {
        "type": "FeatureCollection",
        "bbox": [BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"]],
        "features": features
    }

def download_osm_data():
    os.makedirs("data/raw/osm", exist_ok=True)
    b = BBOX
    bbox_str = f"{b['south']},{b['west']},{b['north']},{b['east']}"

    # 1. Download Roads
    print("\n--- 1. Downloading OSM Roads ---")
    roads_query = f"""
    [out:json][timeout:90];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"]({bbox_str});
    );
    out body;
    >;
    out skel qt;
    """
    roads_data = query_overpass(roads_query)
    roads_geojson = parse_elements_to_geojson(roads_data.get("elements", []), "road")
    roads_path = "data/raw/osm/pune_roads_raw.geojson"
    with open(roads_path, "w", encoding="utf-8") as f:
        json.dump(roads_geojson, f, indent=2)
    print(f"Saved {len(roads_geojson['features'])} road features to {roads_path}")

    # 2. Download Waterways
    print("\n--- 2. Downloading OSM Waterways ---")
    water_query = f"""
    [out:json][timeout:60];
    (
      way["waterway"]({bbox_str});
      way["natural"="water"]({bbox_str});
    );
    out body;
    >;
    out skel qt;
    """
    water_data = query_overpass(water_query)
    water_geojson = parse_elements_to_geojson(water_data.get("elements", []), "waterway")
    water_path = "data/raw/osm/pune_waterways_raw.geojson"
    with open(water_path, "w", encoding="utf-8") as f:
        json.dump(water_geojson, f, indent=2)
    print(f"Saved {len(water_geojson['features'])} waterway features to {water_path}")

    # 3. Download Healthcare Facilities
    print("\n--- 3. Downloading OSM Healthcare Facilities ---")
    hosp_query = f"""
    [out:json][timeout:60];
    (
      node["amenity"="hospital"]({bbox_str});
      way["amenity"="hospital"]({bbox_str});
    );
    out body;
    >;
    out skel qt;
    """
    hosp_data = query_overpass(hosp_query)
    hosp_geojson = parse_elements_to_geojson(hosp_data.get("elements", []), "hospital")
    hosp_path = "data/raw/osm/pune_hospitals_raw.geojson"
    with open(hosp_path, "w", encoding="utf-8") as f:
        json.dump(hosp_geojson, f, indent=2)
    print(f"Saved {len(hosp_geojson['features'])} healthcare features to {hosp_path}")

    # 4. Download Landmark Buildings
    print("\n--- 4. Downloading OSM Building Footprints ---")
    # Sub-bounding box focused on central urban corridor to keep payload snappy
    bld_bbox = "18.510,73.835,18.545,73.885"
    bld_query = f"""
    [out:json][timeout:60];
    (
      way["building"]({bld_bbox});
    );
    out body;
    >;
    out skel qt;
    """
    bld_data = query_overpass(bld_query)
    bld_geojson = parse_elements_to_geojson(bld_data.get("elements", []), "building")
    bld_path = "data/raw/osm/pune_buildings_raw.geojson"
    with open(bld_path, "w", encoding="utf-8") as f:
        json.dump(bld_geojson, f, indent=2)
    print(f"Saved {len(bld_geojson['features'])} building footprints to {bld_path}")

if __name__ == "__main__":
    download_osm_data()
