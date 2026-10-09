# HC-05 — Climate-Aware Emergency Response Network
### International Federation of Red Cross and Red Crescent Societies (IFRC) Challenge

> **Intelligent, multi-echelon disaster emergency simulation system featuring continuous road-aligned routing, multi-criteria dispatch, ICU hospital eligibility constraints, flood plain dynamics, and synchronized dual dashboards (Admin Command Center & Ambulance In-Vehicle Terminal).**

---

## 1. Project Overview & Challenge Statement

During acute natural hazards (monsoon surges, riverine floods, cyclones), civil protection and humanitarian emergency systems face compounded operational bottlenecks:
- **Evolving Road Inundation:** Road accessibility shifts dynamically as river basins overflow, cutting off critical corridors.
- **Surging Triage Demand:** Vulnerable, isolated riverbank populations generate escalating emergency calls.
- **Resource Constraints:** Emergency medical vehicles (ALS/BLS) and hospital bed/ICU capacities are finite.
- **Severe Routing Hazards:** Blind shortest-path navigation sends emergency vehicles into impassable flood waters or traps them behind washed-out crossings.
- **Medical Coverage Deficits:** Floodwaters isolate entire urban sectors from tertiary trauma centers, creating dangerous care gaps.

**HC-05** solves this through a **single shared simulation world** that combines:
1. **Real Geographic Data:** Pune, Maharashtra, India (Mula-Mutha river basin, physical road network geometries from HOT/OSM, real hospital locations, administrative sectors, and 3D buildings).
2. **Urban Flood Inundation Engine:** Elevation- and river-proximity-dependent flood depth calculation interacting with streets and 3D buildings.
3. **Machine Learning Pipeline:** 3 locally trained, leakage-free scikit-learn models (Zone Demand, Zone Risk, and Road Accessibility).
4. **Operations Research & Optimization Engine:** Google OR-Tools and graph algorithms for risk-based fleet staging, multi-criteria ambulance dispatch, ICU-constrained hospital eligibility, and temporary field medical camp deployment.
5. **Real-time Dual Dashboards:** An **Administrator Command Center** (`/admin`) and an **Ambulance In-Vehicle Navigation Portal** (`/ambulance`), synchronized over high-throughput WebSockets.

---

## 2. Technical Architecture & Data Flow

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 SHARED SIMULATION STATE                │
                  │             (Single In-Memory Source of Truth)         │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
                      ▼ WebSocket (/ws/simulation)                    ▼ WebSocket (/ws/simulation)
           ┌──────────────────────┐                       ┌──────────────────────┐
           │   ADMIN DASHBOARD    │                       │ AMBULANCE DASHBOARD  │
           │       (/admin)       │                       │    (/ambulance)      │
           │  • 3D Isometric Map  │                       │  • Turn-by-Turn Nav  │
           │  • Incident Creation │                       │  • Call Acceptance   │
           │  • Resource Actions  │                       │  • Patient Pickup    │
           │  • Flood Progression │                       │  • Hospital Route    │
           └──────────────────────┘                       └──────────────────────┘
                      ▲                                               ▲
                      │ REST API                                      │ REST API
                      └───────────────────────┬───────────────────────┘
                                              │
                                   ┌──────────┴──────────┐
                                   │  FASTAPI BACKEND    │
                                   │   (Port 8000)       │
                                   └──────────┬──────────┘
                                              │
          ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
          │                  │                │                 │                  │
          ▼                  ▼                ▼                 ▼                  ▼
  ┌──────────────┐   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  GIS ENGINE  │   │ FLOOD ENGINE │  │  ML MODELS   │  │ OPTIMIZATION │  │ ROUTE GRAPH  │
  │ • Real Pune  │   │ • Stage Rise │  │ • Demand RF  │  │ • Dispatch   │  │ • NetworkX   │
  │   Zones (HDX)│   │ • Elevation  │  │ • Risk GB    │  │ • Hospital   │  │ • Road Segs  │
  │ • OSM Roads  │   │ • Drainage & │  │ • Access RF  │  │ • Camp Alloc │  │ • Continuous │
  │ • 3D Bldgs   │   │   Buildings  │  │ (No Leakage) │  │ • OR-Tools   │  │   Rerouting  │
  └──────────────┘   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 3. Data Sources & Provenance (OSM, DEM, HDX)

A complete provenance catalog with licenses, bounding boxes, and attribution is documented in [`DATA_PROVENANCE.md`](file:///e:/HC-5/DATA_PROVENANCE.md) and [`data/manifest.json`](file:///e:/HC-5/data/manifest.json).

| Dataset | Source / Provider | License / Attribution | Purpose in HC-05 | Real vs. Simulated |
|---|---|---|---|---|
| **Road Network & Intersections** | OpenStreetMap (OSM) / Overpass API | ODbL 1.0 (© OpenStreetMap contributors) | **15,976 real road segments** across **12,675 nodes**; topology, lengths in UTM 43N, classes, speed limits, bridges | **Real Static Road Geometry**; production graph routing & MapLibre overlay |
| **Waterways & River Channels** | OpenStreetMap (OSM) / Hydrography | ODbL 1.0 (© OpenStreetMap contributors) | 119 physical river channels & canals (Mutha/Mula channels); seeds flood propagation | **Real Riverbed Geography** |
| **Digital Elevation Model (DEM)** | NASA JPL / USGS SRTM Elevation | Public Domain | 35x45 elevation grid (535.9m – 671.4m MSL) for terrain head calculation & road midpoints | **Real DEM Grid (SRTM)** |
| **Healthcare Facilities** | OSM Healthcare / Municipal Directory | ODbL 1.0 (© OpenStreetMap contributors) | 8 validated regional trauma & general hospitals with road-snapped routing locations | **Real Facility Locations**; capacity baseline |
| **3D Building Footprints** | OpenStreetMap Building Footprints | ODbL 1.0 (© OpenStreetMap contributors) | 1,500 real building footprints with 3D extrusion heights | **Real Physical Footprints** |
| **Urban Zones & Boundaries** | Humanitarian Data Exchange (HDX) / UN OCHA | CC BY-IGO | Population density, vulnerability index across 8 Pune administrative sectors | **Real Boundary & Census Baseline** |

### Explicit Separation: Real Static Data vs. Simulated Dynamic Data
- **Real Static Geography:** Physical OSM road polylines and intersection topology, 3D building footprints, river channels, NASA/USGS SRTM elevation grid, hospital facility coordinates, and census demographics.
- **Simulated Dynamic State:** Hydraulic water level progression (0.0m – 4.2m), emergency call creation, ambulance GPS movement along OSM road lines, hospital bed/ICU deductions, and temporary medical camps.

---

## 4. Machine Learning & Deterministic Safety Override

All 3 models were trained on simulation-derived scenarios using reproducible scripts in `ml/` and persisted to `models/`. **Circular data leakage was strictly eliminated** in Model 3 (Road Accessibility) by predicting inundation status from upstream river surge, road elevation, river distance, and road type rather than direct flood depth thresholding.

### Model 1: Zone Emergency Demand Predictor (`demand_model.pkl`)
- **Algorithm:** `RandomForestRegressor(n_estimators=100, max_depth=8)`
- **Input Features:** Population (k), area (km²), density, elevation MSL, river proximity, vulnerability index, upstream river surge, inundation head, disaster duration.
- **Evaluation:** **MAE = 4.938 calls** | **RMSE = 18.360 calls** | **R² = 0.969**

### Model 2: Zone Disaster Risk Classifier & Score (`risk_model.pkl`)
- **Algorithm:** `GradientBoostingClassifier` & `GradientBoostingRegressor`
- **Input Features:** Inundation head, exposed population, vulnerability index, active demand, accessible road %, medical coverage baseline.
- **Evaluation:** **Accuracy = 84.4%** | **Weighted F1 = 0.844** | Produces `[0, 1]` risk score + LOW/MEDIUM/HIGH/CRITICAL classification.

### Model 3: Predictive Road Accessibility (`road_access_model.pkl`)
- **Algorithm:** `RandomForestClassifier(n_estimators=100, max_depth=6)`
- **Input Features:** Road elevation (MSL), river channel distance (m), upstream river surge (m), segment length (m), speed limit (km/h), is_bridge flag, road class code.
- **Deterministic Physical Safety Constraint:** While ML predicts hazard probabilities, **deterministic physical accessibility always governs ground truth**: if physical flood depth on a road segment exceeds 0.50m (or >50% length inundated), the road is deterministically marked as `BLOCKED`.

---

## 5. Road-Following Routing & Snapping Engine

- **Point-to-Segment Snapping:** When clicked anywhere on the map, incidents and staging units preserve their original clicked coordinates as `display_location`, while projecting onto the nearest OSM road segment as `routing_location` using a high-performance `shapely.strtree.STRtree` index.
- **Zero Straight-Line Fallbacks:** The engine strictly forbids direct straight-line shortcuts. If no path exists on the road network, routing returns `ROUTE_UNAVAILABLE`.
- **Exact Subsegment Assembly:** Routes begin and end by slicing the exact subsegment along the source OSM road LineString using `shapely.ops.substring`, ensuring 100% geometric alignment with the road network.
- **Automated Validation:** Verified by `scripts/validate_gis.py` with **100.0% route-to-road buffer match** across tested urban origin-destination pairs.
- **Hydraulic Edge Cost Formulation:**
  $$\text{Edge Cost} = \text{Travel Time (min)} \times \text{Risk Multiplier} + \text{Inundation Penalty}$$
  - `OPEN`: standard travel time (multiplier 1.0x).
  - `RESTRICTED` (water $\le 0.30\text{m}$): 2.0x travel time penalty.
  - `HIGH_RISK` (water $\le 0.50\text{m}$): 4.0x travel time penalty + hazard penalty.
  - `BLOCKED` (water $> 0.50\text{m}$): impassable (infinite weight).
- **Dynamic Rerouting:** When floodwaters inundate a road on an active route, the routing engine recalculates an alternate route along dry roads, updating the vehicle's route live.

---

## 6. Multi-Criteria Dispatch & Capacity Enforcement

The dispatch engine (`optimization/dispatch.py`) selects the **best available ambulance**, not merely the closest:
1. **Hard Capacity Constraint:** Ambulances have finite patient capacities (`BLS = 2`, `ALS = 2`). The engine rejects assignments where incident patient count exceeds vehicle capacity.
2. **Severity Matching:** CRITICAL incidents prioritize Advanced Life Support (ALS) units.
3. **Composite Impedance Score:** Evaluates ETA, route hazard rating, vehicle workload, and zone coverage preservation.
4. **Targeted Notification:** Only the dispatched ambulance receives the call alert on its dashboard (`/ambulance`), while other units remain in their current state.

---

## 7. Hospital Selection & Hard Constraints

When a patient is picked up, the system evaluates all regional hospitals (`optimization/hospital_assignment.py`):
1. **Hard Bed Constraint:** Standard beds must exceed patient count.
2. **Hard ICU Constraint:** For CRITICAL patients, available ICU beds must be $\ge \text{patient count}$.
3. **Trauma Center Verification:** Critical polytrauma requires verified Level-1 trauma capability.
4. **Reachable Safe Route:** Hospital must have an accessible, non-blocked road path.
5. **Bed/ICU Deduction:** Upon ambulance arrival at the hospital, beds and ICU units are decremented from the shared state.
6. **Medical Coverage Gap:** If no hospital meets the constraints, a formal `MEDICAL_COVERAGE_GAP` alert is raised.

---

## 8. Medical Camp Recommendation & Deployment

- **Decision Model:** Evaluates `medical_gap_score` combining demand pressure, hospital capacity deficit, access failure, and hazard exposure.
- **Admin Deployment:** Recommended camps require explicit administrator confirmation (`[DEPLOY CAMP]`).
- **Simulation Consequences:** Deploying a field camp creates a 20-bed triage facility, immediately improves the zone's medical coverage score, and allows local patient stabilization.

---

## 9. Map Marker Stability & 3D Visualization

- **Elimination of Marker Remapping Bug:** The CSS `transition: transform` was permanently removed from MapLibre HTML marker root elements. MapLibre now updates marker pixel projections at 60 fps natively during any camera action.
- **Camera Independence:** Zooming, panning, pitching, or rotating the map **never alters** ambulance coordinates, triggers route regeneration, or moves markers off course.
- **Multi-Layer Urban Flood Rendering:**
  1. Base Map (OSM raster / Carto Positron).
  2. Waterways channel layer (deep natural blue).
  3. River basin inundation corridor layer expanding with water level rise.
  4. Flooded street hazard overlays with animated warning glow.
  5. Physical road network with status casing (OPEN, RESTRICTED, HIGH_RISK, BLOCKED).
  6. Active road-aligned route polylines.
  7. 3D extruded building footprints placed above water layers so buildings physically rise out of the streets and water corridors.
- **Decoupled High-Performance Layer Architecture:** Static OSM roads (15,976 segments) and 3D buildings are loaded once on initial map load from `/api/gis/roads`. Real-time WebSockets only transmit dynamic, non-open roads (<40 KB payload, 200x reduction), eliminating main-thread browser locks and keeping rendering at 60 FPS.

---

## 10. How to Run the System

### Backend Setup (FastAPI + WebSockets)
```bash
# In project root:
py -3.11 -m venv .venv
# Activate virtual environment, or use python 3.11:
py -3.11 -m pip install -r requirements.txt

# Run automated GIS validation suite (100% road alignment & flood checks):
py -3.11 scripts/validate_gis.py

# Run full automated test suite (16 unit and end-to-end integration tests):
py -3.11 -m unittest discover tests -v

# Start backend server on port 8000:
py -3.11 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### Frontend Setup (React + Vite + MapLibre)
```bash
cd frontend
npm install
npm run dev
# Open in browser: http://localhost:5173/
```

### Demonstration Accounts & Dashboards
- **Administrator Command Center:**
  - URL: `http://localhost:5173/` or `/admin`
  - Demo Username: `admin` | Password: `admin123`
- **Ambulance In-Vehicle Navigation Portal:**
  - URL: `http://localhost:5173/ambulance`
  - Available Units: `AMB-01`, `AMB-02`, `AMB-03`, `AMB-04`
  - Demo Password: `demo123`

---

## 11. Honest Disclaimers & Assumptions

- **Hydraulic Approximation:** The flood engine uses a 1D/stage-elevation urban flood approximation rather than a full 2D Saint-Venant hydraulic solver.
- **Simulated Dynamic Variables:** Live emergency call arrivals, hospital occupancy variations, and ambulance GPS updates are generated deterministically by the simulation engine, built upon real static geographic data.
- **No False Claims:** We do not claim live municipal emergency dispatch CAD integration, certified automotive vehicle dynamics, or real-time clinical hospital telemetry. All dynamic operational variables operate within a transparent, reproducible simulation layer.
