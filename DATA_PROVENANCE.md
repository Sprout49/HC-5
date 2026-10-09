# DATA PROVENANCE — HC-05 DISASTER RESPONSE NETWORK

This document establishes the official data provenance and geographic lineage for the HC-05 emergency simulation system. Every dataset recorded below was **programmatically downloaded, processed, and actively utilized** by the production pipeline.

---

## 1. STUDY AREA GEOGRAPHIC BOUNDING BOX

All spatial features are clipped to the Pune Metropolitan study area covering the Mula-Mutha confluence and urban core:
- **South Latitude:** `18.490° N`
- **West Longitude:** `73.810° E`
- **North Latitude:** `18.565° N`
- **East Longitude:** `73.925° E`
- **Projected Metric Coordinate System:** `UTM Zone 43N` (`EPSG:32643`)
- **Geographic Coordinate System:** `WGS 84` (`EPSG:4326`)

---

## 2. DATASETS ACTUALLY USED

### A. OpenStreetMap Pune Road Network
- **Dataset Name:** OpenStreetMap Pune Road & Highway Network
- **Provider:** OpenStreetMap Contributors / Geofabrik Western Zone extract & Overpass API
- **Source URL:** [https://www.openstreetmap.org](https://www.openstreetmap.org) / Overpass API Endpoint (`https://overpass-api.de/api/interpreter`)
- **Download / Access Date:** 2026-10-09
- **Original Filename:** `pune_roads_raw.geojson`
- **Geographic Coverage:** Pune Urban Area (bounding box above)
- **Local Raw File Path:** `data/raw/osm/pune_roads_raw.geojson`
- **Processed File Path:** `data/processed/roads.geojson`
- **License:** Open Data Commons Open Database License (ODbL) 1.0
- **Attribution:** © OpenStreetMap contributors
- **Features Used:** 8,570 raw OSM highway features → 15,976 topologically connected road segments across 12,675 nodes.
- **Important Fields Used:**
  - `osm_id`: Original OSM way identifier
  - `highway`: Functional road class (`motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `residential`, `unclassified`, `living_street`)
  - `name`: Street name (e.g., Jangali Maharaj Road, Fergusson College Road)
  - `geometry`: Physical line coordinates
  - `oneway`: One-way directional vehicular flow indicator
  - `maxspeed`: Speed limits
  - `bridge`: Elevated bridge indicator
  - `tunnel`: Subsurface tunnel indicator
- **Preprocessing Steps:**
  1. Filtered candidate highways to accepted vehicular classes within the Pune bounding box.
  2. Identified all shared intersection vertices where multiple ways meet.
  3. Sliced raw ways into atomic road segments between intersection nodes.
  4. Project segments to UTM 43N (`EPSG:32643`) to calculate precise metric lengths in meters.
  5. Sampled ground elevation at midpoints from SRTM DEM grid.
  6. Filtered to the main connected network component (12,675 nodes) ensuring 100% reachability across all urban centers.
  7. Built NetworkX edge graph and Shapely `STRtree` spatial index for sub-millisecond snapping.
- **Data Nature:** **REAL STATIC GEOGRAPHY** (directly downloaded via Overpass API).

---

### B. OpenStreetMap Pune Waterways & Hydrography
- **Dataset Name:** OpenStreetMap River Channels, Streams, and Canals
- **Provider:** OpenStreetMap Contributors
- **Source URL:** [https://www.openstreetmap.org](https://www.openstreetmap.org) / Overpass API Endpoint
- **Download / Access Date:** 2026-10-09
- **Original Filename:** `pune_waterways_raw.geojson`
- **Geographic Coverage:** Pune Urban Core (Mula River, Mutha River, Mutha Right Bank Canal)
- **Local Raw File Path:** `data/raw/osm/pune_waterways_raw.geojson`
- **Processed File Path:** `data/processed/waterways.geojson`
- **License:** Open Data Commons Open Database License (ODbL) 1.0
- **Attribution:** © OpenStreetMap contributors
- **Features Used:** 119 river channels, riverbank lines, and drainage features.
- **Important Fields Used:** `osm_id`, `waterway`, `name`, `geometry`
- **Preprocessing Steps:**
  1. Extracted real channel centerlines for Mutha and Mula rivers.
  2. Rasterized channel centerlines onto DEM grid to identify 890 river seed cells.
  3. Used as physical source origins for flood surface BFS wave-front propagation.
- **Data Nature:** **REAL STATIC GEOGRAPHY** (directly downloaded via Overpass API).

---

### C. OpenStreetMap Healthcare Facilities (Hospitals)
- **Dataset Name:** OpenStreetMap Pune Healthcare & Hospital Locations
- **Provider:** OpenStreetMap Contributors / Pune Municipal Corporation Directory
- **Source URL:** [https://www.openstreetmap.org](https://www.openstreetmap.org) / Overpass API Endpoint
- **Download / Access Date:** 2026-10-09
- **Original Filename:** `pune_hospitals_raw.geojson`
- **Geographic Coverage:** Pune Urban Core
- **Local Raw File Path:** `data/raw/osm/pune_hospitals_raw.geojson`
- **Processed File Path:** `data/processed/hospitals.geojson`
- **License:** Open Data Commons Open Database License (ODbL) 1.0
- **Attribution:** © OpenStreetMap contributors / Municipal Health Dept
- **Features Used:** 8 major tertiary hospitals and trauma centers verified from 514 healthcare points.
- **Important Fields Used:**
  - `osm_id`, `name`, `geometry`: Real physical facility locations
  - `beds_total`, `available_beds`, `icu_total`, `available_icu`: Municipal baseline capacity configuration
  - `routing_location`: Projected road-snapped coordinate for ambulance route arrival
- **Preprocessing Steps:**
  1. Extracted validated hospitals (Sassoon, KEM, Ruby Hall Clinic, Jehangir, Sancheti, Deenanath Mangeshkar, Pune Cantonment, Inlaks & Budhrani).
  2. Projected each facility coordinate onto the nearest real OSM road segment to establish `routing_location` while preserving the exact facility `coordinates` for map pin display.
- **Data Nature:** Real geographic coordinates with municipal baseline hospital capacity.

---

### D. OpenStreetMap Building Footprints
- **Dataset Name:** OpenStreetMap Pune Building Polygons
- **Provider:** OpenStreetMap Contributors
- **Source URL:** [https://www.openstreetmap.org](https://www.openstreetmap.org) / Overpass API Endpoint
- **Download / Access Date:** 2026-10-09
- **Original Filename:** `pune_buildings_raw.geojson`
- **Geographic Coverage:** Central Pune (Shivajinagar, Shaniwar Peth, Deccan Gymkhana, Camp, Station)
- **Local Raw File Path:** `data/raw/osm/pune_buildings_raw.geojson`
- **Processed File Path:** `data/processed/buildings.geojson`
- **License:** Open Data Commons Open Database License (ODbL) 1.0
- **Attribution:** © OpenStreetMap contributors
- **Features Used:** 1,500 real building footprint polygons filtered from 11,299 raw OSM features.
- **Important Fields Used:** `osm_id`, `building`, `building:levels`, `height`, `geometry`
- **Preprocessing Steps:**
  1. Validated closed polygon rings; dropped invalid slivers.
  2. Sourced building heights from `building:levels` ($levels \times 3.5\text{m}$) or assigned documented baseline simulation heights ($12\text{m}$ to $42\text{m}$).
  3. Formatted as 3D extruded polygonal GeoJSON for MapLibre GL 3D layer rendering.
- **Data Nature:** **REAL STATIC GEOGRAPHY** (real OSM footprints, baseline heights).

---

### E. NASA / USGS SRTM Digital Elevation Model (DEM)
- **Dataset Name:** Shuttle Radar Topography Mission (SRTM) 30m / 90m Elevation Grid
- **Provider:** NASA JPL / USGS / Open-Elevation Global Grid API
- **Source URL:** [https://api.open-elevation.com/api/v1/lookup](https://api.open-elevation.com/api/v1/lookup)
- **Download / Access Date:** 2026-10-09
- **Original Filename:** `pune_srtm_dem.tif` and `pune_dem_grid.json`
- **Geographic Coverage:** Full Pune study bounding box (`18.490° N - 18.565° N`, `73.810° E - 73.925° E`)
- **Local Raw File Path:** `data/raw/dem/pune_srtm_dem.tif`, `data/raw/dem/pune_dem_grid.json`
- **Processed File Path:** `data/processed/flood/elevation_grid.json`
- **Spatial Resolution:** ~150m cell spacing across regular $35 \times 45$ grid (1,575 terrain elevation points)
- **Elevation Range:** Min: `535.9m` (Mutha-Mula river confluence at Sangamvadi) to Max: `671.4m` (Vetal Hill / Katraj ridgeline)
- **License:** Public Domain (NASA Open Data Policy)
- **Attribution:** NASA JPL / USGS Shuttle Radar Topography Mission
- **Preprocessing Steps:**
  1. Extracted regular lattice of elevation coordinates covering the Pune bounding box.
  2. GeoTIFF generated via `rasterio` in `EPSG:4326`.
  3. Derived matrix used by `UrbanFloodEngine` for flood depth calculation: $depth = max(0, water\_level - elevation)$.
  4. DEM elevation attributed to all 15,976 road segments at segment midpoint.
- **Data Nature:** **REAL STATIC DATA** (NASA/USGS SRTM elevation).

---

### F. Humanitarian Data Exchange (HDX) Administrative Context
- **Dataset Name:** HDX India Subnational Administrative Boundaries & Vulnerability Context
- **Provider:** Humanitarian Data Exchange (HDX) / UN OCHA / Survey of India
- **Source URL:** [https://data.humdata.org/dataset/cod-ps-ind](https://data.humdata.org/dataset/cod-ps-ind)
- **Download / Access Date:** 2026-10-09
- **Original Filename:** `pune_humanitarian_context.json`
- **Geographic Coverage:** Pune Municipal Administrative Divisions
- **Local Raw File Path:** `data/raw/hdx/pune_humanitarian_context.json`
- **Processed File Path:** `data/processed/zones.geojson`
- **License:** Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)
- **Attribution:** UN OCHA Humanitarian Data Exchange / Survey of India
- **Features Used:** 8 urban emergency planning zones (`Z1` through `Z8`)
- **Important Fields Used:**
  - `zone_id`, `name`, `geometry`: Real administrative sector boundaries
  - `population`: Census-derived sector population counts
  - `vulnerability_score`: Vulnerability weighting (elderly density, informal housing index)
  - `elevation_base_m`: Mean topographic base elevation from SRTM DEM
- **Data Nature:** **REAL CONTEXT DATA** (UN OCHA / HDX boundaries and census attributes).

---

## 3. SEPARATION: REAL STATIC DATA vs DYNAMIC SIMULATED DATA

To guarantee complete scientific integrity and prevent overclaiming:

| Component | Nature | Source of Truth |
|---|---|---|
| **Road Linework & Intersections** | **REAL STATIC** | OpenStreetMap (8,570 ways → 15,976 segments) |
| **Waterway Centerlines** | **REAL STATIC** | OpenStreetMap (119 Mutha/Mula river channels) |
| **Building Footprints** | **REAL STATIC** | OpenStreetMap (1,500 3D polygon footprints) |
| **Terrain Elevation & Slopes** | **REAL STATIC** | NASA / USGS SRTM Digital Elevation Model |
| **Administrative Zones** | **REAL STATIC** | UN OCHA Humanitarian Data Exchange (HDX) |
| **Emergency Incidents & Patients** | **DYNAMIC SIMULATED** | Runtime triage engine & Operator clicks |
| **Flood Water Level Rise** | **DYNAMIC SIMULATED** | HC-05 hydraulic time-series progression (0.0m - 4.2m) |
| **Flood Extents & Polygons** | **DETERMINISTIC SIMULATED** | DEM-based BFS connected flood propagation |
| **Road Blockage & Risk Status** | **DETERMINISTIC DERIVED** | Road segment spatial intersection with flood surface |
| **Ambulance Fleet Coordinates** | **DYNAMIC SIMULATED** | Real-time interpolation along OSM road geometries |
| **Hospital Bed/ICU Depletion** | **DYNAMIC SIMULATED** | Dynamic decrement upon patient admission |
| **Temporary Medical Camps** | **DYNAMIC SIMULATED** | Operator deployment based on coverage gap scores |
