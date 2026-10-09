"""
HC-05 GIS Preprocessing and Data Generator for Pune, Maharashtra, India.
Generates reproducible, topologically-consistent GIS layers:
- Zones (Urban administrative/risk zones with population and vulnerability)
- Waterways (Mula, Mutha, and Mula-Mutha rivers)
- Hospitals (Real major healthcare facilities with capacities)
- Road Network (Routable graph with elevation, length, bridges, and road classes)
- 3D Buildings (Footprints with heights for isometric extrusion)
"""

import json
import math
import os
from typing import List, Dict, Any

PUNE_CENTER = [73.8567, 18.5204]  # [lon, lat]

# 1. ZONES DEFINITION (Real Urban Sectors of Pune)
ZONES_DATA = [
    {
        "zone_id": "Z1",
        "name": "Shivajinagar & Sangam",
        "population": 145000,
        "area_km2": 4.8,
        "elevation_base_m": 554.0,
        "river_proximity_m": 120,
        "vulnerability_score": 0.78,
        "medical_coverage_score": 0.65,
        "coordinates": [
            [
                [73.835, 18.535],
                [73.865, 18.542],
                [73.868, 18.525],
                [73.842, 18.520],
                [73.835, 18.535]
            ]
        ]
    },
    {
        "zone_id": "Z2",
        "name": "Kasba & Budhwar Peth (Historic Core)",
        "population": 210000,
        "area_km2": 3.5,
        "elevation_base_m": 558.0,
        "river_proximity_m": 350,
        "vulnerability_score": 0.72,
        "medical_coverage_score": 0.85,
        "coordinates": [
            [
                [73.848, 18.522],
                [73.872, 18.524],
                [73.870, 18.510],
                [73.845, 18.512],
                [73.848, 18.522]
            ]
        ]
    },
    {
        "zone_id": "Z3",
        "name": "Koregaon Park & Bund Garden",
        "population": 98000,
        "area_km2": 5.2,
        "elevation_base_m": 552.0,
        "river_proximity_m": 80,
        "vulnerability_score": 0.82,
        "medical_coverage_score": 0.90,
        "coordinates": [
            [
                [73.875, 18.545],
                [73.915, 18.542],
                [73.910, 18.525],
                [73.872, 18.526],
                [73.875, 18.545]
            ]
        ]
    },
    {
        "zone_id": "Z4",
        "name": "Deccan Gymkhana & Erandwane",
        "population": 132000,
        "area_km2": 4.1,
        "elevation_base_m": 553.5,
        "river_proximity_m": 110,
        "vulnerability_score": 0.65,
        "medical_coverage_score": 0.75,
        "coordinates": [
            [
                [73.822, 18.522],
                [73.846, 18.520],
                [73.842, 18.502],
                [73.818, 18.505],
                [73.822, 18.522]
            ]
        ]
    },
    {
        "zone_id": "Z5",
        "name": "Swargate & Parvati",
        "population": 185000,
        "area_km2": 4.9,
        "elevation_base_m": 562.0,
        "river_proximity_m": 600,
        "vulnerability_score": 0.52,
        "medical_coverage_score": 0.60,
        "coordinates": [
            [
                [73.842, 18.505],
                [73.872, 18.505],
                [73.868, 18.485],
                [73.838, 18.488],
                [73.842, 18.505]
            ]
        ]
    },
    {
        "zone_id": "Z6",
        "name": "Pune Cantonment / Camp",
        "population": 128000,
        "area_km2": 6.0,
        "elevation_base_m": 565.0,
        "river_proximity_m": 900,
        "vulnerability_score": 0.45,
        "medical_coverage_score": 0.80,
        "coordinates": [
            [
                [73.872, 18.520],
                [73.910, 18.522],
                [73.905, 18.495],
                [73.870, 18.498],
                [73.872, 18.520]
            ]
        ]
    },
    {
        "zone_id": "Z7",
        "name": "Yerawada (North Riverbank)",
        "population": 165000,
        "area_km2": 5.5,
        "elevation_base_m": 551.0,
        "river_proximity_m": 60,
        "vulnerability_score": 0.88,
        "medical_coverage_score": 0.40,  # Critical underserved gap during flood
        "coordinates": [
            [
                [73.862, 18.562],
                [73.905, 18.560],
                [73.902, 18.542],
                [73.860, 18.544],
                [73.862, 18.562]
            ]
        ]
    },
    {
        "zone_id": "Z8",
        "name": "Kothrud East (High Elevation)",
        "population": 178000,
        "area_km2": 5.0,
        "elevation_base_m": 569.0,
        "river_proximity_m": 1200,
        "vulnerability_score": 0.35,
        "medical_coverage_score": 0.70,
        "coordinates": [
            [
                [73.798, 18.515],
                [73.824, 18.512],
                [73.820, 18.490],
                [73.795, 18.495],
                [73.798, 18.515]
            ]
        ]
    }
]

# 2. WATERWAYS (Mula, Mutha, and Mula-Mutha river corridors)
WATERWAYS_DATA = [
    {
        "id": "RIVER_MUTHA",
        "name": "Mutha River",
        "type": "river",
        "base_water_level_m": 551.5,
        "coordinates": [
            [73.820, 18.495],
            [73.828, 18.508],
            [73.839, 18.518],
            [73.849, 18.528],
            [73.858, 18.532]
        ]
    },
    {
        "id": "RIVER_MULA",
        "name": "Mula River",
        "type": "river",
        "base_water_level_m": 551.2,
        "coordinates": [
            [73.830, 18.558],
            [73.842, 18.548],
            [73.850, 18.540],
            [73.858, 18.532]
        ]
    },
    {
        "id": "RIVER_MULA_MUTHA",
        "name": "Mula-Mutha River (Confluence Eastbound)",
        "type": "river",
        "base_water_level_m": 550.8,
        "coordinates": [
            [73.858, 18.532],
            [73.872, 18.538],
            [73.888, 18.541],
            [73.908, 18.539],
            [73.925, 18.535]
        ]
    }
]

# 3. REAL HOSPITALS IN CENTRAL PUNE
HOSPITALS_DATA = [
    {
        "hospital_id": "H1",
        "name": "Sassoon General Hospital",
        "zone_id": "Z3",
        "type": "Government Tertiary & Trauma Level 1",
        "coordinates": [73.8744, 18.5284],
        "total_beds": 1200,
        "available_beds": 340,
        "total_icu": 150,
        "available_icu": 28,
        "has_trauma_center": True,
        "specialties": ["Trauma", "Surgery", "ICU", "Burn Unit", "Pediatrics"],
        "elevation_m": 556.0
    },
    {
        "hospital_id": "H2",
        "name": "KEM Hospital Pune",
        "zone_id": "Z2",
        "type": "Multispeciality Charitable",
        "coordinates": [73.8677, 18.5209],
        "total_beds": 550,
        "available_beds": 115,
        "total_icu": 60,
        "available_icu": 14,
        "has_trauma_center": True,
        "specialties": ["Cardiac", "Critical Care", "Neurology"],
        "elevation_m": 559.0
    },
    {
        "hospital_id": "H3",
        "name": "Ruby Hall Clinic",
        "zone_id": "Z3",
        "type": "Super Speciality Tertiary",
        "coordinates": [73.8821, 18.5342],
        "total_beds": 600,
        "available_beds": 140,
        "total_icu": 80,
        "available_icu": 18,
        "has_trauma_center": True,
        "specialties": ["Cardiology", "Trauma", "Nephrology", "Organ Transplant"],
        "elevation_m": 557.5
    },
    {
        "hospital_id": "H4",
        "name": "Jehangir Hospital",
        "zone_id": "Z3",
        "type": "Tertiary Referral Hospital",
        "coordinates": [73.8812, 18.5331],
        "total_beds": 350,
        "available_beds": 75,
        "total_icu": 45,
        "available_icu": 9,
        "has_trauma_center": True,
        "specialties": ["Trauma", "Orthopedics", "Emergency Medicine"],
        "elevation_m": 558.0
    },
    {
        "hospital_id": "H5",
        "name": "Sancheti Hospital",
        "zone_id": "Z1",
        "type": "Orthopedic & Trauma Super Speciality",
        "coordinates": [73.8512, 18.5312],
        "total_beds": 200,
        "available_beds": 50,
        "total_icu": 30,
        "available_icu": 8,
        "has_trauma_center": True,
        "specialties": ["Orthopedics", "Emergency", "Polytrauma"],
        "elevation_m": 555.0
    },
    {
        "hospital_id": "H6",
        "name": "Deenanath Mangeshkar Hospital",
        "zone_id": "Z4",
        "type": "Super Speciality Tertiary",
        "coordinates": [73.8290, 18.5028],
        "total_beds": 800,
        "available_beds": 195,
        "total_icu": 90,
        "available_icu": 24,
        "has_trauma_center": True,
        "specialties": ["Trauma", "ICU", "Cardiology", "Emergency"],
        "elevation_m": 556.5
    },
    {
        "hospital_id": "H7",
        "name": "Pune Cantonment Board Hospital",
        "zone_id": "Z6",
        "type": "Civil & Defense Hospital",
        "coordinates": [73.8845, 18.5075],
        "total_beds": 180,
        "available_beds": 55,
        "total_icu": 20,
        "available_icu": 6,
        "has_trauma_center": False,
        "specialties": ["General Medicine", "Emergency triage"],
        "elevation_m": 566.0
    }
]

# 4. ROAD NETWORK NODES & EDGES (Interconnected, Routable with real Pune corridors)
NODES_DATA = {
    "N_SHIVAJI_STN": [73.8490, 18.5320],
    "N_SANCHETI_JNC": [73.8512, 18.5312],
    "N_SANGAM_BRIDGE": [73.8580, 18.5325],
    "N_COEP_JNC": [73.8565, 18.5290],
    "N_JM_ROAD_N": [73.8475, 18.5285],
    "N_JM_ROAD_S": [73.8440, 18.5180],
    "N_FC_ROAD_N": [73.8445, 18.5290],
    "N_FC_ROAD_S": [73.8415, 18.5195],
    "N_DECCAN_GYM": [73.8390, 18.5170],
    "N_Z_BRIDGE": [73.8460, 18.5175],
    "N_SAMBHAJI_BRG": [73.8480, 18.5170],
    "N_SHANIWAR_WADA": [73.8550, 18.5195],
    "N_KASBA_CORE": [73.8580, 18.5180],
    "N_KEM_HOSP": [73.8677, 18.5209],
    "N_RASTA_PETH": [73.8660, 18.5185],
    "N_PUNE_STATION": [73.8740, 18.5295],
    "N_SASSOON_MAIN": [73.8744, 18.5284],
    "N_BUND_GARDEN_BRG": [73.8780, 18.5375],
    "N_RUBY_HALL": [73.8821, 18.5342],
    "N_KOREGAON_MAIN": [73.8950, 18.5360],
    "N_YERAWADA_JNC": [73.8810, 18.5490],
    "N_YERAWADA_NORTH": [73.8860, 18.5550],
    "N_CAMP_EAST_ST": [73.8820, 18.5120],
    "N_CAMP_MG_RD": [73.8760, 18.5150],
    "N_SWARGATE_HUB": [73.8570, 18.5010],
    "N_PARVATI_FOOT": [73.8480, 18.4960],
    "N_ERANDWANE": [73.8310, 18.5080],
    "N_DEENANATH_HOSP": [73.8290, 18.5028],
    "N_KOTHRUD_STAND": [73.8120, 18.5070],
}

ROADS_DATA = [
    # Road R17 is the classic riverbank road that gets flooded as Mutha/Mula rises!
    {
        "road_id": "R01",
        "name": "Jangali Maharaj Road (JM Road)",
        "from_node": "N_SANCHETI_JNC",
        "to_node": "N_JM_ROAD_S",
        "road_class": "primary",
        "elevation_m": 557.0,
        "speed_limit_kmh": 50,
        "path": ["N_SANCHETI_JNC", "N_JM_ROAD_N", "N_JM_ROAD_S"]
    },
    {
        "road_id": "R02",
        "name": "Fergusson College Road (FC Road)",
        "from_node": "N_SANCHETI_JNC",
        "to_node": "N_DECCAN_GYM",
        "road_class": "primary",
        "elevation_m": 558.5,
        "speed_limit_kmh": 45,
        "path": ["N_SANCHETI_JNC", "N_FC_ROAD_N", "N_FC_ROAD_S", "N_DECCAN_GYM"]
    },
    {
        "road_id": "R03",
        "name": "Karve Road West Link",
        "from_node": "N_DECCAN_GYM",
        "to_node": "N_ERANDWANE",
        "road_class": "primary",
        "elevation_m": 558.0,
        "speed_limit_kmh": 50,
        "path": ["N_DECCAN_GYM", "N_ERANDWANE"]
    },
    {
        "road_id": "R04",
        "name": "Erandwane to Deenanath Hospital Link",
        "from_node": "N_ERANDWANE",
        "to_node": "N_DEENANATH_HOSP",
        "road_class": "secondary",
        "elevation_m": 557.0,
        "speed_limit_kmh": 40,
        "path": ["N_ERANDWANE", "N_DEENANATH_HOSP"]
    },
    {
        "road_id": "R05",
        "name": "Kothrud Connector",
        "from_node": "N_ERANDWANE",
        "to_node": "N_KOTHRUD_STAND",
        "road_class": "primary",
        "elevation_m": 566.0,
        "speed_limit_kmh": 50,
        "path": ["N_ERANDWANE", "N_KOTHRUD_STAND"]
    },
    {
        "road_id": "R06",
        "name": "Sambhaji Bridge (Lakdi Pul)",
        "from_node": "N_DECCAN_GYM",
        "to_node": "N_SHANIWAR_WADA",
        "road_class": "bridge",
        "elevation_m": 554.5,
        "speed_limit_kmh": 35,
        "path": ["N_DECCAN_GYM", "N_SAMBHAJI_BRG", "N_SHANIWAR_WADA"]
    },
    {
        "road_id": "R07",
        "name": "Z-Bridge Pedestrian & Emergency Span",
        "from_node": "N_JM_ROAD_S",
        "to_node": "N_SHANIWAR_WADA",
        "road_class": "bridge",
        "elevation_m": 553.8,
        "speed_limit_kmh": 30,
        "path": ["N_JM_ROAD_S", "N_Z_BRIDGE", "N_SHANIWAR_WADA"]
    },
    {
        "road_id": "R08",
        "name": "Shivaji Road (Heritage Arterial North)",
        "from_node": "N_SHANIWAR_WADA",
        "to_node": "N_KASBA_CORE",
        "road_class": "primary",
        "elevation_m": 560.0,
        "speed_limit_kmh": 45,
        "path": ["N_SHANIWAR_WADA", "N_KASBA_CORE"]
    },
    {
        "road_id": "R08b",
        "name": "Shivaji Road (Kasba to Swargate Arterial)",
        "from_node": "N_KASBA_CORE",
        "to_node": "N_SWARGATE_HUB",
        "road_class": "primary",
        "elevation_m": 561.0,
        "speed_limit_kmh": 45,
        "path": ["N_KASBA_CORE", "N_SWARGATE_HUB"]
    },
    {
        "road_id": "R09",
        "name": "Kasba Core to KEM Hospital",
        "from_node": "N_KASBA_CORE",
        "to_node": "N_KEM_HOSP",
        "road_class": "secondary",
        "elevation_m": 559.0,
        "speed_limit_kmh": 35,
        "path": ["N_KASBA_CORE", "N_RASTA_PETH", "N_KEM_HOSP"]
    },
    {
        "road_id": "R10",
        "name": "KEM Hospital to Sassoon Express Link",
        "from_node": "N_KEM_HOSP",
        "to_node": "N_SASSOON_MAIN",
        "road_class": "primary",
        "elevation_m": 558.0,
        "speed_limit_kmh": 45,
        "path": ["N_KEM_HOSP", "N_SASSOON_MAIN"]
    },
    {
        "road_id": "R11",
        "name": "Sassoon Main to Pune Station",
        "from_node": "N_SASSOON_MAIN",
        "to_node": "N_PUNE_STATION",
        "road_class": "secondary",
        "elevation_m": 557.5,
        "speed_limit_kmh": 35,
        "path": ["N_SASSOON_MAIN", "N_PUNE_STATION"]
    },
    {
        "road_id": "R12",
        "name": "Station to Ruby Hall Corridor",
        "from_node": "N_PUNE_STATION",
        "to_node": "N_RUBY_HALL",
        "road_class": "primary",
        "elevation_m": 557.8,
        "speed_limit_kmh": 40,
        "path": ["N_PUNE_STATION", "N_RUBY_HALL"]
    },
    {
        "road_id": "R13",
        "name": "Koregaon Park Main North Road",
        "from_node": "N_RUBY_HALL",
        "to_node": "N_KOREGAON_MAIN",
        "road_class": "primary",
        "elevation_m": 555.0,
        "speed_limit_kmh": 45,
        "path": ["N_RUBY_HALL", "N_KOREGAON_MAIN"]
    },
    {
        "road_id": "R14",
        "name": "Bund Garden Road & Confluence Bridge",
        "from_node": "N_RUBY_HALL",
        "to_node": "N_YERAWADA_JNC",
        "road_class": "bridge",
        "elevation_m": 553.0,
        "speed_limit_kmh": 40,
        "path": ["N_RUBY_HALL", "N_BUND_GARDEN_BRG", "N_YERAWADA_JNC"]
    },
    {
        "road_id": "R15",
        "name": "Yerawada Floodplain Arterial",
        "from_node": "N_YERAWADA_JNC",
        "to_node": "N_YERAWADA_NORTH",
        "road_class": "primary",
        "elevation_m": 551.8,
        "speed_limit_kmh": 40,
        "path": ["N_YERAWADA_JNC", "N_YERAWADA_NORTH"]
    },
    {
        "road_id": "R16",
        "name": "Sangam Bridge (COEP to Sassoon Arterial)",
        "from_node": "N_SANCHETI_JNC",
        "to_node": "N_SASSOON_MAIN",
        "road_class": "primary",
        "elevation_m": 556.5,
        "speed_limit_kmh": 50,
        "path": ["N_SANCHETI_JNC", "N_COEP_JNC", "N_SASSOON_MAIN"]
    },
    {
        # --- KEY DEMO ROAD ---
        # Low-lying Mutha riverfront roadway connecting Sancheti/Shivajinagar to Pune Station
        # Elevation: 552.2m (Floods early when river level hits +1.5m above normal 551.0m)
        "road_id": "R17",
        "name": "Riverfront Bund Expressway (R17)",
        "from_node": "N_SANCHETI_JNC",
        "to_node": "N_PUNE_STATION",
        "road_class": "arterial",
        "elevation_m": 552.2,
        "speed_limit_kmh": 55,
        "path": ["N_SANCHETI_JNC", "N_COEP_JNC", "N_SANGAM_BRIDGE", "N_PUNE_STATION"]
    },
    {
        "road_id": "R18",
        "name": "Swargate to Camp MG Road",
        "from_node": "N_SWARGATE_HUB",
        "to_node": "N_CAMP_MG_RD",
        "road_class": "primary",
        "elevation_m": 563.0,
        "speed_limit_kmh": 45,
        "path": ["N_SWARGATE_HUB", "N_CAMP_MG_RD"]
    },
    {
        "road_id": "R19",
        "name": "Camp East Street to Sassoon",
        "from_node": "N_CAMP_MG_RD",
        "to_node": "N_SASSOON_MAIN",
        "road_class": "primary",
        "elevation_m": 561.0,
        "speed_limit_kmh": 45,
        "path": ["N_CAMP_MG_RD", "N_CAMP_EAST_ST", "N_SASSOON_MAIN"]
    },
    {
        "road_id": "R22",
        "name": "Shivaji Bridge (Shivajinagar to Shaniwar Wada)",
        "from_node": "N_SANCHETI_JNC",
        "to_node": "N_SHANIWAR_WADA",
        "road_class": "bridge",
        "elevation_m": 556.2,
        "speed_limit_kmh": 40,
        "path": ["N_SANCHETI_JNC", "N_SHANIWAR_WADA"]
    },
    {
        "road_id": "R23",
        "name": "Lakdi Pul & Deccan Cross Connector",
        "from_node": "N_JM_ROAD_S",
        "to_node": "N_DECCAN_GYM",
        "road_class": "secondary",
        "elevation_m": 558.0,
        "speed_limit_kmh": 40,
        "path": ["N_JM_ROAD_S", "N_DECCAN_GYM"]
    },
    {
        "road_id": "R20",
        "name": "Swargate to Parvati Foothill bypass",
        "from_node": "N_SWARGATE_HUB",
        "to_node": "N_PARVATI_FOOT",
        "road_class": "secondary",
        "elevation_m": 564.0,
        "speed_limit_kmh": 40,
        "path": ["N_SWARGATE_HUB", "N_PARVATI_FOOT"]
    },
    {
        "road_id": "R21",
        "name": "Parvati to Erandwane Cross Link",
        "from_node": "N_PARVATI_FOOT",
        "to_node": "N_ERANDWANE",
        "road_class": "secondary",
        "elevation_m": 560.0,
        "speed_limit_kmh": 40,
        "path": ["N_PARVATI_FOOT", "N_ERANDWANE"]
    }
]

# Helper to compute distance in meters between two lon, lat
def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2.0)**2
    return 2.0 * R * math.asin(math.sqrt(a))

def build_geojson():
    os.makedirs("data/processed", exist_ok=True)
    os.makedirs("data/demo", exist_ok=True)

    # 1. ZONES GEOJSON
    zones_features = []
    for z in ZONES_DATA:
        feat = {
            "type": "Feature",
            "properties": {
                "zone_id": z["zone_id"],
                "name": z["name"],
                "population": z["population"],
                "area_km2": z["area_km2"],
                "elevation_base_m": z["elevation_base_m"],
                "river_proximity_m": z["river_proximity_m"],
                "vulnerability_score": z["vulnerability_score"],
                "medical_coverage_score": z["medical_coverage_score"],
                "risk_level": "LOW",
                "risk_score": 0.22,
                "predicted_demand": round(z["population"] / 10000.0)
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": z["coordinates"]
            }
        }
        zones_features.append(feat)

    zones_geojson = {"type": "FeatureCollection", "features": zones_features}
    with open("data/processed/zones.geojson", "w") as f:
        json.dump(zones_geojson, f, indent=2)
    with open("data/demo/zones.geojson", "w") as f:
        json.dump(zones_geojson, f, indent=2)

    # 2. WATERWAYS GEOJSON
    water_features = []
    for w in WATERWAYS_DATA:
        feat = {
            "type": "Feature",
            "properties": {
                "id": w["id"],
                "name": w["name"],
                "type": w["type"],
                "base_water_level_m": w["base_water_level_m"]
            },
            "geometry": {
                "type": "LineString",
                "coordinates": w["coordinates"]
            }
        }
        water_features.append(feat)
    water_geojson = {"type": "FeatureCollection", "features": water_features}
    with open("data/processed/waterways.geojson", "w") as f:
        json.dump(water_geojson, f, indent=2)
    with open("data/demo/waterways.geojson", "w") as f:
        json.dump(water_geojson, f, indent=2)

    # 3. HOSPITALS GEOJSON
    hosp_features = []
    for h in HOSPITALS_DATA:
        feat = {
            "type": "Feature",
            "properties": {
                "hospital_id": h["hospital_id"],
                "name": h["name"],
                "zone_id": h["zone_id"],
                "type": h["type"],
                "total_beds": h["total_beds"],
                "available_beds": h["available_beds"],
                "total_icu": h["total_icu"],
                "available_icu": h["available_icu"],
                "has_trauma_center": h["has_trauma_center"],
                "specialties": h["specialties"],
                "elevation_m": h["elevation_m"],
                "capacity_utilization": round((1.0 - h["available_beds"] / h["total_beds"]) * 100, 1),
                "status": "OPERATIONAL"
            },
            "geometry": {
                "type": "Point",
                "coordinates": h["coordinates"]
            }
        }
        hosp_features.append(feat)
    hosp_geojson = {"type": "FeatureCollection", "features": hosp_features}
    with open("data/processed/hospitals.geojson", "w") as f:
        json.dump(hosp_geojson, f, indent=2)
    with open("data/demo/hospitals.geojson", "w") as f:
        json.dump(hosp_geojson, f, indent=2)

    # 4. ROADS GEOJSON
    road_features = []
    for r in ROADS_DATA:
        coords = [NODES_DATA[node_id] for node_id in r["path"]]
        # calculate length
        length_m = 0.0
        for i in range(len(coords) - 1):
            length_m += haversine_m(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1])
        length_m = round(length_m, 1)

        feat = {
            "type": "Feature",
            "properties": {
                "road_id": r["road_id"],
                "name": r["name"],
                "from_node": r["from_node"],
                "to_node": r["to_node"],
                "road_class": r["road_class"],
                "elevation_m": r["elevation_m"],
                "speed_limit_kmh": r["speed_limit_kmh"],
                "length_m": length_m,
                "flood_depth": 0.0,
                "flooded_portion_pct": 0.0,
                "status": "OPEN",
                "reason": "Normal conditions: road elevation is above current water level"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            }
        }
        road_features.append(feat)
    roads_geojson = {"type": "FeatureCollection", "features": road_features}
    with open("data/processed/roads.geojson", "w") as f:
        json.dump(roads_geojson, f, indent=2)
    with open("data/demo/roads.geojson", "w") as f:
        json.dump(roads_geojson, f, indent=2)

    # 5. 3D BUILDINGS FOOTPRINTS FOR ISOMETRIC MAPLIBRE EXTRUSION
    # Seeded footprints of landmarks and blocks across Central Pune
    building_centers = [
        # Sassoon Complex
        {"name": "Sassoon Trauma Block", "center": [73.8744, 18.5284], "w": 0.0012, "h": 0.0008, "height": 34, "color": "#f8fafc"},
        {"name": "BJ Govt Medical College", "center": [73.8732, 18.5276], "w": 0.0010, "h": 0.0009, "height": 28, "color": "#f1f5f9"},
        # Pune Station
        {"name": "Pune Central Station Terminal", "center": [73.8740, 18.5298], "w": 0.0022, "h": 0.0007, "height": 22, "color": "#e2e8f0"},
        # Ruby Hall
        {"name": "Ruby Hall Medical Tower", "center": [73.8821, 18.5342], "w": 0.0011, "h": 0.0008, "height": 38, "color": "#f8fafc"},
        {"name": "Jehangir Hospital Wing", "center": [73.8812, 18.5331], "w": 0.0009, "h": 0.0007, "height": 26, "color": "#f8fafc"},
        # COEP Tech
        {"name": "COEP Heritage Main Building", "center": [73.8565, 18.5290], "w": 0.0014, "h": 0.0010, "height": 24, "color": "#e2e8f0"},
        {"name": "COEP Academic Complex", "center": [73.8578, 18.5302], "w": 0.0012, "h": 0.0008, "height": 30, "color": "#cbd5e1"},
        # Sancheti
        {"name": "Sancheti Orthopedic Center", "center": [73.8512, 18.5312], "w": 0.0009, "h": 0.0008, "height": 32, "color": "#f8fafc"},
        # Shaniwar Wada
        {"name": "Shaniwar Wada Historic Fort", "center": [73.8550, 18.5195], "w": 0.0016, "h": 0.0014, "height": 18, "color": "#94a3b8"},
        # Deccan & FC
        {"name": "Fergusson College Main Quad", "center": [73.8445, 18.5290], "w": 0.0018, "h": 0.0012, "height": 20, "color": "#cbd5e1"},
        {"name": "Deccan Gymkhana Pavilion", "center": [73.8390, 18.5170], "w": 0.0012, "h": 0.0010, "height": 16, "color": "#cbd5e1"},
        # KEM
        {"name": "KEM Hospital Rasta Peth Tower", "center": [73.8677, 18.5209], "w": 0.0012, "h": 0.0009, "height": 36, "color": "#f8fafc"},
        # Swargate
        {"name": "Swargate Transit Hub Complex", "center": [73.8570, 18.5010], "w": 0.0016, "h": 0.0012, "height": 26, "color": "#cbd5e1"},
        # Deenanath
        {"name": "Deenanath Mangeshkar Hospital", "center": [73.8290, 18.5028], "w": 0.0015, "h": 0.0011, "height": 42, "color": "#f8fafc"},
        # Urban blocks (Koregaon, Shivajinagar, Yerawada)
        {"name": "Koregaon Park Tech Cluster A", "center": [73.8960, 18.5365], "w": 0.0012, "h": 0.0008, "height": 35, "color": "#e2e8f0"},
        {"name": "Koregaon Park Tech Cluster B", "center": [73.8985, 18.5372], "w": 0.0010, "h": 0.0007, "height": 30, "color": "#cbd5e1"},
        {"name": "Yerawada Civic Complex", "center": [73.8810, 18.5490], "w": 0.0014, "h": 0.0009, "height": 22, "color": "#cbd5e1"},
        {"name": "Camp Commercial Center", "center": [73.8760, 18.5150], "w": 0.0015, "h": 0.0010, "height": 24, "color": "#e2e8f0"}
    ]

    # Additional building clusters to populate the 3D isometric city
    for i in range(16):
        lon_offset = (i % 4 - 1.5) * 0.015
        lat_offset = (i // 4 - 1.5) * 0.012
        building_centers.append({
            "name": f"Urban Block UB-{i+1:02d}",
            "center": [PUNE_CENTER[0] + lon_offset, PUNE_CENTER[1] + lat_offset],
            "w": 0.0008,
            "h": 0.0006,
            "height": 14 + (i * 3) % 25,
            "color": "#f1f5f9"
        })

    building_features = []
    for idx, b in enumerate(building_centers):
        cx, cy = b["center"]
        w = b["w"] / 2.0
        h = b["h"] / 2.0
        coords = [
            [
                [cx - w, cy - h],
                [cx + w, cy - h],
                [cx + w, cy + h],
                [cx - w, cy + h],
                [cx - w, cy - h]
            ]
        ]
        feat = {
            "type": "Feature",
            "properties": {
                "id": f"BLD_{idx+1:03d}",
                "name": b["name"],
                "height": b["height"],
                "base_height": 0,
                "color": b.get("color", "#e2e8f0")
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": coords
            }
        }
        building_features.append(feat)

    buildings_geojson = {"type": "FeatureCollection", "features": building_features}
    with open("data/processed/buildings.geojson", "w") as f:
        json.dump(buildings_geojson, f, indent=2)
    with open("data/demo/buildings.geojson", "w") as f:
        json.dump(buildings_geojson, f, indent=2)

    print(f"GIS Data Generation Complete:")
    print(f"- Zones: {len(zones_features)}")
    print(f"- Waterways: {len(water_features)}")
    print(f"- Hospitals: {len(hosp_features)}")
    print(f"- Roads: {len(road_features)}")
    print(f"- 3D Buildings: {len(building_features)}")

if __name__ == "__main__":
    build_geojson()
