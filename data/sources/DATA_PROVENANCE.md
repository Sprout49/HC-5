# HC-05 — Data Provenance & Humanitarian Sources Specification

**Challenge**: International Federation of Red Cross and Red Crescent Societies (IFRC) — Climate-Aware Emergency Response Network  
**Study Region**: Pune Urban Basin, Mula-Mutha Confluence, Maharashtra, India  
**Coordinates**: 73.8100°E to 73.9300°E, 18.4900°N to 18.5600°N  

---

## 1. Primary Data Sources & Provenance

This project adheres to the mandatory challenge requirement by ingesting and referencing official humanitarian data platforms:

| Dataset Name | Humanitarian Source Platform | Direct Resource URL | Download / Ingestion Date | License / Attribution | Relevant Attributes & Fields | Purpose in HC-05 Architecture |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Pune Road Network & Infrastructure** | **Humanitarian OpenStreetMap Team (HOT)** via **HDX** | [https://data.humdata.org/organization/hot](https://data.humdata.org/organization/hot) | 2026-10-08 | Open Database License (ODbL) / © OpenStreetMap contributors | `highway`, `name`, `bridge`, `surface`, `maxspeed`, `lanes`, `geometry` (LineString) | Routable road network graph edges, road classifications, speed limits, and bridge crossings. |
| **Health Facilities & Hospitals** | **Humanitarian OpenStreetMap Team (HOT)** / HDX Health Sites | [https://data.humdata.org/dataset/india-healthsites](https://data.humdata.org/dataset/india-healthsites) | 2026-10-08 | CC-BY 4.0 / Open Data | `amenity=hospital`, `name`, `operator:type`, `healthcare:speciality`, `emergency`, `coordinates` (Point) | Real Pune tertiary and trauma healthcare facilities (Sassoon, KEM, Sancheti, Deenanath, Ruby Hall). |
| **Subnational Population & Administrative Wards** | **UN OCHA Humanitarian Data Exchange (HDX)** | [https://data.humdata.org/dataset/india-population](https://data.humdata.org/dataset/india-population) | 2026-10-08 | Creative Commons Attribution | `ward_name`, `population`, `density_km2`, `admin_level`, `vulnerability_score` | Zone boundaries, exposed population density, baseline demand, and medical coverage indices. |
| **Mula-Mutha Waterways & River Basins** | **OpenStreetMap / HDX Waterways** | [https://data.humdata.org/](https://data.humdata.org/) | 2026-10-08 | ODbL / © OSM contributors | `waterway=river`, `name`, `natural=water`, `geometry` (LineString / Polygon) | River centerline and flood plain channel (Mutha, Mula, and Mula-Mutha confluence). |
| **Digital Elevation Model (DEM)** | **Copernicus GLO-30 / NASA SRTM 30m** | [https://portal.opentopography.org/](https://portal.opentopography.org/) | 2026-10-08 | Public Domain / Open Government Data | `elevation_m` (raster grid / contour elevation) | Baseline elevation for urban terrain (550m to 568m MSL) to calculate water head and road inundation. |

---

## 2. Real Static Geography vs. Simulated Dynamic State

To maintain absolute scientific and engineering integrity, HC-05 explicitly separates **real static physical geography** from the **simulated dynamic disaster state**:

```
+-----------------------------------------------------------------------------------------+
|                                    HC-05 ARCHITECTURE                                   |
+------------------------------------------------------------+----------------------------+
|                  REAL STATIC GEOGRAPHY                     |  SIMULATED DYNAMIC STATE   |
|                 (From HDX, HOT, and OSM)                   | (Hydraulic & Event Engine) |
+------------------------------------------------------------+----------------------------+
| * Road network topology & intersection nodes               | * Water rise progression   |
| * Road classifications, lengths, and speed limits          | * Inundated road depths    |
| * Real hospital locations, trauma tiers, and baseline beds | * Road accessibility state |
| * Zone administrative boundaries & population density      | * Live ambulance positions |
| * Waterways, river channels, and confluence paths          | * Emergency incident calls |
| * Ground surface elevation (DEM)                           | * Real-time hospital loads |
| * 3D building footprint polygons                           | * Temporary medical camps  |
+------------------------------------------------------------+----------------------------+
```

### Scientific Honesty Disclaimers:
1. **Continuous Road Elevation**: HOT/OSM does not natively provide high-resolution continuous pavement elevation; road elevation is sampled from public 30m Digital Elevation Model (DEM) data referenced to Mean Sea Level (MSL).
2. **Real-Time GPS & Hospital Occupancy**: Live public APIs for Indian city ambulance telematics and real-time ICU occupancy do not exist in open data; these variables are managed by our transparent, deterministic simulation engine.
3. **Flood Inundation**: This prototype implements an urban terrain hydraulic elevation-head simulation rather than a commercial 2D hydrodynamic solver (such as HEC-RAS or TUFLOW).

---

## 3. Directory Layout in `data/`

* `data/sources/`: This documentation, source references, and license manifests.
* `data/raw/`: Raw GeoJSON and tabular downloads from HDX and OSM exports.
* `data/processed/`: Normalized, topologically validated GeoJSON layers:
  - `zones.geojson`: Urban zones with population and baseline vulnerability.
  - `roads.geojson`: Routable road network graph edges with elevation and speed limits.
  - `hospitals.geojson`: Healthcare facilities with trauma capability, bed and ICU pools.
  - `waterways.geojson`: River centerlines for hydraulic modeling.
  - `buildings.geojson`: 3D building footprint geometries with extrusion heights.
* `data/training/`: Training datasets for Machine Learning models with documented feature schemas.
