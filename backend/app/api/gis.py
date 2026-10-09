"""
GIS static vector layers endpoint for HC-05.
Serves static OSM roads, 3D building footprints, and waterways for MapLibre GL JS.
"""

import json
import os
from fastapi import APIRouter

router = APIRouter(prefix="/gis", tags=["gis"])

_roads_cache = None
_buildings_cache = None
_waterways_cache = None

@router.get("/roads")
def get_roads():
    global _roads_cache
    if _roads_cache is None:
        path = "data/processed/roads.geojson"
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                _roads_cache = json.load(f)
        else:
            _roads_cache = {"type": "FeatureCollection", "features": []}
    return _roads_cache

@router.get("/buildings")
def get_buildings():
    global _buildings_cache
    if _buildings_cache is None:
        path = "data/processed/buildings.geojson"
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                _buildings_cache = json.load(f)
        else:
            _buildings_cache = {"type": "FeatureCollection", "features": []}
    return _buildings_cache

@router.get("/waterways")
def get_waterways():
    global _waterways_cache
    if _waterways_cache is None:
        path = "data/processed/waterways.geojson"
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                _waterways_cache = json.load(f)
        else:
            _waterways_cache = {"type": "FeatureCollection", "features": []}
    return _waterways_cache
