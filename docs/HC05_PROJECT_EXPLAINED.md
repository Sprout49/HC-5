# HC-05: Climate-Aware Emergency Response Network
## Complete Project Understanding Guide for the Team

> **Welcome to the team guide!**  
> If you are presenting this project to hackathon judges or explaining it to anyone else, this document is written for you. It explains everything in simple, everyday English without unnecessary technical jargon, while remaining 100% faithful to the actual code in this repository.

---

## Table of Contents
1. [A. HC-05 in One Minute](#a-hc-05-in-one-minute)
2. [B. Understanding the Real-World Problem](#b-understanding-the-real-world-problem)
3. [C. How Our Solution Works: Dual Dashboards](#c-how-our-solution-works-dual-dashboards)
4. [D. The Complete Workflow with an Easy Example](#d-the-complete-workflow-with-an-easy-example)
5. [E. How Mapping, Snapping, and Routing Work](#e-how-mapping-snapping-and-routing-work)
6. [F. How Flood Simulation Works](#f-how-flood-simulation-works)
7. [G. How Ambulances Are Dispatched](#g-how-ambulances-are-dispatched)
8. [H. How Hospitals and Temporary Medical Camps Work](#h-how-hospitals-and-temporary-medical-camps-work)
9. [I. Technologies Used: Explained Simply](#i-technologies-used-explained-simply)
10. [J. Datasets and Data Sources: Real vs. Simulated](#j-datasets-and-data-sources-real-vs-simulated)
11. [K. Machine Learning & Optimization Explained](#k-machine-learning--optimization-explained)
12. [L. What Makes HC-05 Innovative?](#l-what-makes-hc-05-innovative)
13. [M. Honest Project Limitations & Future Improvements](#m-honest-project-limitations--future-improvements)
14. [N. What to Say to Judges (30s, 1-min, 2-min Scripts)](#n-what-to-say-to-judges)
15. [O. Live Demonstration Walkthrough Guide](#o-live-demonstration-walkthrough-guide)
16. [P. 22 Likely Judge Questions & Honest Answers](#p-22-likely-judge-questions--honest-answers)
17. [Q. Simple Technical Glossary](#q-simple-technical-glossary)

---

## A. HC-05 in One Minute

### What is HC-05?
**HC-05** is an intelligent disaster emergency simulation system. It helps city coordinators and ambulance drivers make fast, safe decisions when severe monsoon rains flood urban streets.

### What problem does it solve?
During a flood, roads become blocked by water. Normal navigation apps (like standard consumer GPS) do not know which streets are underwater and might direct an ambulance straight into deep water. Meanwhile, dispatchers might send an ambulance to a hospital that has no electricity or no available intensive care beds.

### Who would use it?
1. **Disaster Emergency Coordinators** (City administrators, Red Cross/IFRC teams, municipal emergency departments) who need an eagle-eye view of flooded zones, ambulances, and hospital loads.
2. **Ambulance Operators & Paramedics** who need a clean in-vehicle screen showing safe, flood-free turn-by-turn routes, patient details, and the right hospital destination.

### What does our solution do?
It runs a single connected simulation where:
- A flood rises along Pune's Mula-Mutha riverbed.
- Low-elevation roads become hazardous or completely blocked.
- When an emergency occurs, the system automatically finds the **safest, fastest available ambulance** (not just the closest straight-line distance).
- The route strictly follows real Pune streets and automatically bends around flooded roads.
- When the patient is picked up, the system guides the vehicle to a hospital that actually has available beds and ICU equipment.
- If an entire neighbourhood is cut off by floodwaters, the system detects a "Medical Coverage Gap" and recommends deploying a temporary field clinic.

### 30-Second Elevator Pitch (Memorize This!)
> *"HC-05 is a climate-aware emergency response platform built for urban flood disasters in Pune. When floods submerge streets, standard navigation fails. Our system combines real OpenStreetMap roads and terrain elevation to predict road flooding, dispatches the best-equipped ambulance via flood-safe routes, ensures hospitals have ICU bed capacity, and identifies isolated zones that need temporary medical camps—all synchronized in real time across administrator and ambulance screens."*

---

## B. Understanding the Real-World Problem

When a major urban flood hits a city like Pune during monsoon season:

1. **Road Inundation Happens Rapidly:**  
   Rivers overflow and low-lying roads become rivers themselves. Water depths of 30 cm can stall an engine; depths above 50 cm will float an ambulance or sweep it away.
2. **The Nearest Ambulance is Not the Best Ambulance:**  
   An ambulance might be only 500 metres away in a straight line, but if the river or a deep pool of water lies between the vehicle and the patient, that ambulance cannot cross. An ambulance 2 kilometres away on high ground might reach the patient much faster.
3. **Different Emergencies Need Different Care:**  
   A patient suffering from severe cardiac arrest or drowning trauma needs an **ALS (Advanced Life Support)** ambulance with a ventilator and paramedic, whereas a patient with a minor fracture can use a **BLS (Basic Life Support)** vehicle.
4. **Hospitals Get Overwhelmed:**  
   In disasters, people rush to the most famous hospital, filling every bed, while another hospital 5 minutes away has open ICU capacity. If an ambulance arrives at a hospital with no open ICU beds, the patient suffers dangerous transfer delays.
5. **Entire Urban Pockets Get Cut Off:**  
   Bridges and causeways submerge, isolating thousands of residents from any hospital. Emergency teams must identify these isolated pockets early to set up emergency triage camps on high ground.

**Why coordinating these together is vital:**  
In real emergencies, road status, vehicle locations, emergency calls, and hospital capacities are constantly changing. If dispatchers, drivers, and hospitals operate in silos, delays cost lives. HC-05 puts all four pieces into one synchronized intelligence network.

---

## C. How Our Solution Works: Dual Dashboards

HC-05 runs **one shared backend simulation engine**. That engine broadcasts updates via WebSockets and REST APIs to **two distinct frontend dashboards**:

```
                  ┌───────────────────────────────────────────────┐
                  │             SHARED SIMULATION BACKEND         │
                  │   (Disaster progression, roads, ambulances)   │
                  └───────────────────────┬───────────────────────┘
                                          │ Real-Time Sync (WebSockets + REST)
                 ┌────────────────────────┴────────────────────────┐
                 ▼                                                 ▼
     ┌───────────────────────┐                         ┌───────────────────────┐
     │ ADMINISTRATOR PORTAL  │                         │  AMBULANCE IN-VEHICLE │
     │       (/admin)        │                         │      (/ambulance)     │
     └───────────────────────┘                         └───────────────────────┘
```

### 1. The Administrator Command Dashboard (`/admin`)
This is the command center used by emergency management leadership.
- **3D Isometric Map:** An interactive 3D map of Pune displaying Carto/OSM base tiles, 1,500 real extruded 3D buildings, physical river channels, and administrative zones.
- **Dynamic Flood Visualizer:** Shows the live blue flood surface expanding outwards from the riverbed as water rise progresses.
- **Road Network Status Overlay:** Shows which streets are **OPEN** (green), **RESTRICTED** (amber/slowed), **HIGH RISK** (orange), or **BLOCKED** (red with warning glow).
- **Network Statistics Panel:** Shows real-time counts of open, restricted, high-risk, and blocked roads across all 15,976 Pune road segments.
- **Simulation Progression Controls:** Buttons to **Play/Start**, **Pause**, **Step Forward (+10 mins)**, **Reset**, and change speed (**1x, 2x, 4x**).
- **Hazard Scenario Selector:** One-click toggles between **NORMAL** (dry), **MODERATE FLOOD** (monsoon swell), and **SEVERE FLOOD** (catastrophic dam discharge).
- **Report Emergency Tool:** Click the "Report Incident" button, click anywhere on the map, select severity (Low/Medium/High/Critical) and patient count, and click submit.
- **Load Demo Scenario Button:** Instantly stages 4 ambulances across North, West, South, and East Pune zones, triggers active floodwaters, and creates a realistic riverside incident.
- **Hospital Capacity Monitor:** Displays real hospital locations (Sassoon, KEM, Ruby Hall, Deenanath, etc.) with real-time bed count and ICU availability percentages.
- **Interactive Inspection Drawer:** Clicking any road, zone, hospital, or ambulance opens a side drawer showing detailed elevation, flood depth, speed limit, and risk ratings.
- **Medical Camp Deployment Card:** Displays system recommendations when an isolated zone is cut off, allowing the admin to click **[DEPLOY MEDICAL CAMP]**.

### 2. The Ambulance Navigation Dashboard (`/ambulance`)
This is the touch-friendly interface designed for a tablet mounted inside an ambulance cab.
- **Unit Selector & Login:** Allows switching between **AMB-01**, **AMB-02**, **AMB-03**, and **AMB-04** (password: `demo123`).
- **Emergency Dispatch Alert:** Flashes an audible/visual card when a call is assigned to this specific ambulance, displaying incident severity, patient count, and location.
- **Action Workflow Buttons:**
  - **[ACCEPT EMERGENCY CALL]**: Acknowledges the dispatch and locks in the route.
  - **[CONFIRM PATIENT PICKUP]**: Recorded when the ambulance arrives at the scene; triggers automatic hospital selection.
  - **[START ROUTE TO HOSPITAL]**: Directs navigation to the optimal selected hospital.
- **Turn-by-Turn Nav Panel:** Shows real road distance (in km), estimated travel time (in minutes), hazard level, and destination name.
- **Contrastive Rationale Card:** Plain-English explanation explaining *why* this path was chosen (e.g., *"⚡ Safe Reroute: Avoided direct route via Alka Talkies due to 75cm floodwater. Detoured via elevated Karve Road arterial."*).
- **Live In-Cab Map:** Shows the ambulance moving along the physical road geometry towards its objective.

---

## D. The Complete Workflow with an Easy Example

Let's walk through an actual scenario in Pune, from the initial disaster call to final hospital admission:

```
[1. Flood Rises] ──> [2. Emergency Occurs] ──> [3. Smart Dispatch] ──> [4. Safe Route]
         │                                                                   │
         ▼                                                                   ▼
[8. Camp Deploy] <── [7. Hospital Selected] <── [6. Patient Pickup] <── [5. Auto-Reroute]
```

### Step 1: The Disaster Unfolds
- The simulation begins at Day 1, 14:00. The administrator selects "MODERATE FLOOD".
- Upstream river discharge raises the water level in the Mula-Mutha riverbed from 0.2m to 1.6m.
- Low-lying streets near Alka Talkies and riverside causeways (elevation ~549m) submerge under water.
- The system automatically marks these roads as **BLOCKED** and assigns infinite travel penalty so no vehicle will cross them.

### Step 2: An Incident is Reported
- A citizen calls in an emergency near Alka Talkies riverside: 1 patient, **HIGH** severity.
- In the dashboard, the admin clicks **Report Incident** and clicks the map location.
- The map captures the exact click coordinates `[73.8440, 18.5160]` as the display marker, and instantly snaps to the closest real road centerline for routing.

### Step 3: Multi-Criteria Dispatch Evaluation
- The backend evaluates all available ambulances:
  - **AMB-01** (Sancheti / North): 1.8 km away, but the bridge across the river has rising water.
  - **AMB-02** (Deccan Gymkhana / West): 0.8 km away on high dry ground, BLS certified, 0 patients onboard.
  - **AMB-03** (Swargate / South): 2.3 km away.
  - **AMB-04** (Sassoon / East): 3.5 km away.
- The system selects **AMB-02** as the fastest and safest unit (ETA 1.3 minutes) and assigns `INC-101`.

### Step 4: Route Generation (No Straight Lines!)
- The graph routing engine searches Pune's road network.
- It builds a continuous polyline that slices along real street corners, turns, and junctions.
- It confirms zero flooded roads are on this path. AMB-02's screen displays the route with an ETA of 1.3 mins.

### Step 5: Live Inundation & Rerouting (If Conditions Worsen)
- While AMB-02 is en route, river water surges by another 0.4m.
- If an upcoming road on AMB-02's path becomes submerged, the backend instantly detects the intersection between the active route and the blocked road.
- It triggers a **Live Reroute**, calculates a dry detour along an elevated arterial street, updates AMB-02's route, and logs a high-priority alert on both screens.

### Step 6: Patient Pickup
- AMB-02 arrives at the patient location (`route_progress = 1.0`).
- The ambulance driver taps **[CONFIRM PATIENT PICKUP]** on the ambulance portal.
- Status changes to `PATIENT_PICKED_UP`. The vehicle's onboard patient count increments to 1.

### Step 7: Hospital Selection Under Constraints
- The system immediately evaluates all 8 regional hospitals in Pune:
  - Is standard bed capacity available?
  - If the patient is critical, are ICU beds available?
  - Does the facility have emergency trauma capability?
  - Is there an open, non-flooded road corridor from the ambulance to the hospital?
- Hospital KEM or Sassoon is selected based on accessible travel time and open bed headroom.
- The driver taps **[START ROUTE TO HOSPITAL]**, and navigation switches to the hospital route.
- Upon arrival, available beds at the hospital automatically decrement by 1.

### Step 8: Medical Coverage Gap & Field Camp Deployment
- In Yerawada (North riverbank), floodwaters cut off road access to all major hospitals, while local emergency demand surges.
- The system computes a `medical_gap_score = 0.52` (exceeding the 0.48 threshold).
- A recommendation card appears on the Admin Dashboard: *"Medical Coverage Gap in Yerawada: Isolating 35 potential patients."*
- The admin clicks **[DEPLOY MEDICAL CAMP]**. A temporary 20-bed emergency triage camp is deployed at high elevation, stabilizing local patients without requiring dangerous river crossings.

---

## E. How Mapping, Snapping, and Routing Work

### 1. OpenStreetMap (OSM)
**OpenStreetMap** is a free, crowdsourced map of the world (like the Wikipedia of maps). Instead of using artificial toy grids or made-up streets, HC-05 downloaded real Pune OpenStreetMap data containing **15,976 actual road segments** across **12,675 real road intersections**.

### 2. Road Network as a Mathematical Graph
To calculate routes, computers cannot just look at pictures of roads. We convert the roads into a **graph**:
- **Nodes (Vertices):** Every road intersection, junction, or sharp bend.
- **Edges:** The road segments connecting two intersections.
- **Weight (Cost):** The time it takes to drive along that road segment.
  $$\text{Base Travel Time} = \frac{\text{Length of road (meters)}}{\text{Speed limit (meters/second)}}$$

### 3. Snapping (Point-to-Segment Map Matching)
When an administrator clicks the map to report an incident, their mouse click might land on a building, a courtyard, or the sidewalk.
- We cannot start driving from inside a building!
- Using a high-speed spatial search tree (`shapely.strtree.STRtree`), the system finds the nearest real road in **less than 1 millisecond**.
- It calculates the exact **orthogonal projection** (the 90-degree closest point) onto the road's centerline.
- **Important:** The system preserves the original click coordinate as the visual icon (`display_location`), while using the snapped road point for vehicle navigation (`routing_location`).

### 4. Continuous Subsegment Slicing (No Straight Lines!)
In amateur projects, ambulances often jump in a straight line from their starting point to the road network.
- In HC-05, we strictly forbid straight-line fallbacks.
- Using `shapely.ops.substring`, the routing engine slices the exact fraction of the road between the ambulance and the next intersection, stitching it together into one seamless, unbroken path that hugs every curb and bend.
- **Proof:** Our GIS validation test (`scripts/validate_gis.py`) proves **100.0% geometric alignment** between calculated routes and physical road corridors.

### 5. Road Accessibility & Dynamic Penalties
Each road segment has a status:
- `OPEN`: Water depth = 0 cm. Normal travel time (multiplier 1.0x).
- `RESTRICTED`: Shallow surface water (8 cm to 25 cm). Speed reduced to 20 km/h (2.0x time penalty).
- `HIGH_RISK`: Hazardous water (25 cm to 50 cm). Heavy penalty (4.0x time penalty + safety risk penalty).
- `BLOCKED`: Flood depth $\ge 50$ cm (or $>40\%$ segment inundated). Weight set to **infinity** ($\infty$), making it completely impassable to routing algorithms.

---

## F. How Flood Simulation Works

### 1. What is Digital Elevation Model (DEM) Data?
Every spot on Earth has an elevation (height above sea level in metres). We use data from NASA's **SRTM (Shuttle Radar Topography Mission)** satellite radar.
- In Pune, the riverbed sits around **536 to 548 metres** above sea level.
- Elevated bridges and hill arterials sit at **560 to 580 metres**.
- High ridges sit at **670+ metres**.

### 2. Terrain and Water-Level Interaction
Water naturally flows downhill and pools in low areas:
- As monsoon rains fall or dams release water, the hydraulic water level rises from an initial dry baseline (e.g., 548.5m) upwards.
- Any terrain grid cell where `Elevation < Water Level` becomes submerged.
- The depth of water at that location is:
  $$\text{Depth} = \text{Water Surface Elevation} - \text{Ground Elevation}$$

### 3. Spatial Flood Inundation MultiPolygon
Instead of drawing a simple thick blue circle around the river, the backend computes an actual spatial polygon representing the flooded zone:
1. It queries the 35×45 DEM terrain elevation grid.
2. It identifies low-lying grid cells contiguous to the Mutha and Mula river channels.
3. It merges them into an authentic **MultiPolygon** using Shapely geometric operations.
4. It sends this polygon to MapLibre, which renders an authentic, expanding blue flood surface that physically respects Pune's hills, valleys, and riverbanks.

### 4. How Roads Become Blocked (and Why 0.00m Blockages Were Fixed)
Each road segment in Pune has a verified elevation:
- If a road line crosses the flood polygon footprint, the system checks whether the road deck elevation is actually lower than the water surface.
- **Elevation Truthfulness Rule:** If a bridge or elevated flyover sits at 565m and the flood level is 550m, the road is **15 metres above the water!** Even though it looks like it crosses the river in 2D, water is NOT on the road deck. The road remains **OPEN** with depth **0.00m**.
- A road is only marked `BLOCKED` if actual water depth on the road exceeds **0.50m** (or $\ge 0.35$m with heavy inundation).

### 5. Limitations of Our Flood Model
- **It is an approximation:** We use a stage-elevation DEM approximation, **not a full 2D Saint-Venant hydraulic fluid-dynamics simulation**.
- It does not calculate water velocity (speed of current) or mudflow sediment.
- It is designed for operational emergency response planning, not hydrodynamic civil engineering.

---

## G. How Ambulances Are Dispatched

Our dispatch engine (`optimization/dispatch.py`) does **not** simply pick the geographically closest vehicle. It uses **Multi-Criteria Decision Analysis (MCDA)** with hard physical safety constraints.

### 1. Hard Constraints (Must Pass or Disqualified)
1. **Status:** The ambulance must be currently `AVAILABLE` or `IDLE`.
2. **Patient Capacity:** If an incident has 2 patients and a single-patient vehicle responds, it is rejected.
3. **Road Connectivity:** There must be an open, non-blocked road path from the ambulance to the incident. If floodwaters cut off access, the ambulance is excluded.

### 2. The Multi-Criteria Scoring Formula
For every eligible ambulance, the system calculates a **Composite Dispatch Impedance Score** (lower score is better):

$$\text{Score} = (\text{ETA} \times 1.0) + (\text{Route Hazard Risk} \times 0.8) + \text{Capability Penalty} + \text{Zone Retention Factor}$$

- **ETA (Estimated Travel Time):** Calculated along the actual road graph turns and speed limits.
- **Route Hazard Penalty:** Routes traversing `MODERATE` risk roads add +2.5; `HIGH` risk roads add +6.0.
- **Medical Capability Match:**
  - If the emergency is `CRITICAL` and an ambulance is only `BLOCKED` / `BLS`, a +1.8 penalty is added to prioritize `ALS` (Advanced Life Support) units equipped with life-support gear.
  - If the emergency is `LOW` severity and an `ALS` unit is nearby, a small penalty (+0.4) is applied to **preserve the ALS unit** for life-threatening calls elsewhere in the city.
- **Zone Coverage Retention:** If an ambulance is the sole emergency unit stationed in a high-vulnerability riverbank zone, a retention penalty prevents stripping that zone of all protection unless no other unit can respond.

The ambulance with the lowest composite score is dispatched.

---

## H. How Hospitals and Temporary Medical Camps Work

### 1. Hospital Selection (`optimization/hospital_assignment.py`)
Pune has 8 validated regional hospitals in our dataset (including Sassoon General Hospital, KEM Hospital, Ruby Hall Clinic, and Deenanath Mangeshkar Hospital).

When an ambulance operator clicks **Patient Picked Up**, the backend runs an automatic optimization:
1. **Bed Availability Hard Constraint:** Standard beds must be $\ge$ incident patient count.
2. **ICU Hard Constraint:** If the emergency is `CRITICAL`, available ICU beds must be $\ge$ patient count. Hospitals with 0 open ICU beds are strictly rejected.
3. **Trauma Center Verification:** Critical polytrauma requires verified Level-1 Emergency Trauma facilities.
4. **Accessible Route:** An accessible, flood-safe road corridor must exist between the patient location and the hospital.
5. **Headroom Headroom Preference:** Prefers hospitals with healthy bed capacity margins to avoid overloading a single facility.

Once assigned, the hospital destination is sent directly to the ambulance navigation screen. Upon arrival, available beds at the hospital are automatically decremented in the shared simulation state.

### 2. Medical Coverage Gaps and Field Camps (`optimization/resource_allocation.py`)
In extreme floods, low-lying sectors can become completely cut off from all major hospitals.

The system evaluates a **Multi-Factor Medical Gap Score** for every urban zone:
$$\text{Gap Score} = (\text{Demand Pressure} \times 0.35) + (\text{Hospital Deficit} \times 0.30) + (\text{Access Failure} \times 0.20) + (\text{Hazard Exposure} \times 0.15)$$

- When `Gap Score >= 0.48`, the system flags an urgent **Medical Coverage Gap**.
- It recommends deploying a **Rapid-Deployment Medical Field Camp** (capacity: 20 patients) at an elevated, flood-safe location inside the isolated zone.
- When the administrator confirms deployment, the camp appears on the map, immediate zone medical coverage improves, and local patients can be stabilized without risking drowning in flood transit.

---

## I. Technologies Used: Explained Simply

Here is the exact technology stack genuinely used in the repository:

### 1. Frontend Technologies
| Technology | What it does in HC-05 | Why we chose it | Where it is used in code |
|---|---|---|---|
| **React 19** | Powers the dynamic user interface and reactive dashboards. | Updates interface components instantly whenever simulation state changes. | `frontend/src/App.tsx`, `frontend/src/pages/` |
| **TypeScript** | Type-safe JavaScript language. | Prevents silent bugs by guaranteeing data structure consistency across frontend and backend. | All `.tsx` and `.ts` files in `frontend/src/` |
| **Vite** | Super-fast web development server and bundler. | Compiles and hot-reloads the frontend in milliseconds; builds production bundles in ~1.8 seconds. | `frontend/vite.config.ts`, `frontend/package.json` |
| **MapLibre GL JS** | High-performance WebGL vector map rendering engine. | Renders 15,976 real road segments, 1,500 3D building extrusions, and flood surfaces smoothly at 60 FPS. | `frontend/src/components/map/CityMap3D.tsx` |
| **Tailwind CSS** | Modern styling framework. | Creates clean, responsive glassmorphic cards, indicators, and buttons without bulky CSS files. | `frontend/src/index.css`, UI components |
| **Lucide React** | Clean, modern iconography library. | Provides crisp status icons for ambulances, sirens, beds, weather, and navigation. | Header controls, action panels |

### 2. Backend Technologies
| Technology | What it does in HC-05 | Why we chose it | Where it is used in code |
|---|---|---|---|
| **Python 3.11** | Core programming language for all backend logic. | Best-in-class ecosystem for GIS, scientific computing, optimization, and machine learning. | Entire backend, simulation, GIS, and ML pipeline |
| **FastAPI** | High-performance asynchronous Python web API framework. | Handles REST requests and WebSocket connections simultaneously with automatic validation. | `backend/app/main.py`, `backend/app/api/` |
| **Uvicorn** | Fast ASGI web server. | Serves the FastAPI application on port 8000. | Server execution runtime |
| **WebSockets** | Bi-directional, real-time communication protocol. | Pushes shared simulation state from backend to all open browser windows every second without polling. | `backend/app/realtime/websocket_manager.py` |
| **Pydantic** | Data validation and parsing library. | Ensures request bodies (such as emergency reporting coordinates) adhere to exact data schemas. | `backend/app/api/` endpoints |

### 3. GIS & Routing Technologies
| Technology | What it does in HC-05 | Why we chose it | Where it is used in code |
|---|---|---|---|
| **NetworkX** | Mathematical graph data structure and algorithms library. | Represents Pune's 15,976 road segments as a navigable graph and executes shortest-path algorithms. | `gis/roads.py` |
| **Shapely** | 2D geometric manipulation and spatial analysis library. | Projects points onto lines (snapping), calculates spatial intersections between roads and flood polygons, and slices subsegments. | `gis/roads.py`, `gis/flood.py` |
| **STRtree (Shapely)** | High-speed spatial indexing tree. | Finds the nearest road segment to any clicked map point in under 1 millisecond. | `gis/roads.py` (`snap_to_road`) |
| **GeoJSON** | Open standard format for representing geographic features. | Transmits road lines, zone boundaries, flood polygons, and building footprints between Python and MapLibre. | `data/processed/`, API endpoints |

### 4. Machine Learning & Data Technologies
| Technology | What it does in HC-05 | Why we chose it | Where it is used in code |
|---|---|---|---|
| **scikit-learn** | Machine learning library. | Trains and runs inference for our 3 models (Random Forest and Gradient Boosting). | `ml/train_models.py`, `ml/inference.py` |
| **NumPy & Pandas** | Array mathematics and tabular data processing. | Prepares feature matrices, processes DEM elevation grids, and manipulates datasets. | `ml/features.py`, `gis/flood.py` |
| **Joblib** | Model serialization library. | Saves trained `.pkl` models to disk and loads them into memory for fast real-time inference. | `ml/inference.py`, `models/*.pkl` |

### 5. Dependency Audit: What is NOT Used?
- **Google OR-Tools:** Listed in `requirements.txt`, but **NOT actively used** in `optimization/dispatch.py` or `optimization/hospital_assignment.py`. The project implements optimization using Multi-Criteria Decision Analysis (MCDA), constraint filtering, and NetworkX Dijkstra algorithms. **Do not claim OR-Tools is used.**
- **GeoPandas & Rasterio:** Present in requirements for preprocessing scripts, but core runtime simulation runs cleanly on standard Shapely and NumPy to maintain maximum speed.

---

## J. Datasets and Data Sources: Real vs. Simulated

A critical strength of HC-05 is its transparent separation between **real static geography** and **simulated dynamic disaster state**:

| Dataset / Source | Origin Provider | Real vs. Simulated | Details & Size | Limitations |
|---|---|---|---|---|
| **Road Network** | OpenStreetMap (OSM) via Overpass API | **REAL STATIC** | 15,976 physical road segments, 12,675 nodes across Pune (lengths, classes, speeds, bridges). | Static snapshot; does not contain real-time traffic jams. |
| **River Channels & Waterways** | OpenStreetMap Hydrography | **REAL STATIC** | 119 physical river channels & canals (Mutha, Mula rivers, canals). | Riverbed boundaries; does not include seasonal bathymetry depth. |
| **3D Building Footprints** | OpenStreetMap Buildings | **REAL STATIC** | 1,500 real building footprints with extrusion heights in central Pune. | Covers central study area, not every building in outer districts. |
| **Hospital Locations** | OpenStreetMap Healthcare | **REAL STATIC** | 8 validated regional hospitals in Pune with coordinates. | Real locations; real baseline bed numbers. |
| **Administrative Sectors** | HDX (Humanitarian Data Exchange) / UN OCHA | **REAL STATIC** | 8 Pune municipal zones (Z1 to Z8) with population and vulnerability indices. | Boundary and population baselines from census estimates. |
| **Elevation Model (DEM)** | NASA JPL / USGS SRTM Radar | **REAL STATIC** | 35×45 elevation grid (535.9m to 671.4m MSL) at ~150m cell resolution. | Satellite radar resolution (~30m-90m baseline interpolated); misses micro-curbs. |
| **Hydraulic Flood Curve** | HC-05 Simulation Engine | **SIMULATED DYNAMIC** | Water rise curve from 0.0m to 4.2m over 50 simulated minutes. | 1D stage-elevation urban approximation, not 2D hydrodynamic solver. |
| **Emergency Incidents** | User Map Clicks / Demo Scenario | **SIMULATED DYNAMIC** | Emergency call locations, patient counts (1-3), severity levels. | Generated for testing and operational simulation. |
| **Ambulance Movement** | HC-05 Simulation Engine | **SIMULATED DYNAMIC** | 4 ambulances moving smoothly along real road coordinates. | Simulated movement, not live GPS trackers from municipal fleet. |
| **Hospital Live Occupancy** | HC-05 Simulation Engine | **SIMULATED DYNAMIC** | Available bed and ICU deductions upon ambulance patient arrival. | Simulated inventory, not connected to live hospital hospital EHR/ERP. |

---

## K. Machine Learning & Optimization Explained

### 1. The Three Machine Learning Models
All three models are trained, evaluated, and saved in `models/`:

#### Model 1: Zone Emergency Demand Predictor (`demand_model.pkl`)
- **Algorithm:** `RandomForestRegressor(n_estimators=100, max_depth=8)`
- **What it predicts:** The number of emergency calls a specific zone will generate in the next hour.
- **Input Features:** Zone population, area, elevation, river distance, vulnerability index, upstream river surge, and disaster duration.
- **Performance:** **MAE = 4.9 calls** | **$R^2$ Score = 0.969**
- **How it's used:** Identifies which neighbourhoods will experience emergency call surges so commanders can stage ambulances before roads flood.

#### Model 2: Zone Disaster Risk Classifier & Score (`risk_model.pkl`)
- **Algorithm:** `GradientBoostingClassifier` & `GradientBoostingRegressor`
- **What it predicts:** Both a continuous risk score `[0.0, 1.0]` and a risk category (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) for each zone.
- **Input Features:** Inundation head, exposed population, vulnerability score, active demand, accessible road percentage.
- **Performance:** **Accuracy = 84.4%** | **Weighted F1 = 0.844**
- **How it's used:** Colors the zone boundaries on the map and drives the Medical Coverage Gap formula.

#### Model 3: Predictive Road Accessibility (`road_access_model.pkl`)
- **Algorithm:** `RandomForestClassifier(n_estimators=100, max_depth=6)`
- **What it predicts:** Probabilistic road accessibility (`OPEN`, `RESTRICTED`, `HIGH_RISK`, `BLOCKED`).
- **Input Features:** Road elevation, distance to river, upstream surge, road length, speed limit, bridge flag, road class code.
- **Performance:** **Accuracy = 85.2%**
- **Critical Safety Override:** Machine learning makes probabilistic predictions, but **deterministic physical safety rules always govern emergency routing**: if physical flood depth on a road exceeds 0.50m, it is deterministically forced to `BLOCKED`.

### 2. Difference Between ML, GIS, Optimization, and Simulation
Judges often ask: *"Why did you use ML here and rules there?"* Here is the simple distinction:
- **GIS:** Handles the *geometry and geography* (where roads are, how lines connect, projecting coordinates).
- **Simulation:** Advances the *disaster story over time* (the clock ticks, the river rises, ambulances advance along roads).
- **Machine Learning (AI):** *Estimates patterns from complex multi-variable inputs* (predicting demand spikes and risk levels across zones).
- **Optimization:** *Finds the best choice among many options under constraints* (which ambulance has the lowest impedance, which hospital meets ICU requirements).

---

## L. What Makes HC-05 Innovative?

1. **Closed-Loop Dual Dashboard Synchronization:**  
   Most disaster hackathon projects build a single map. HC-05 provides **two synchronized operational views**: the Administrator Command Center and the Ambulance Driver Terminal, updating in real time over WebSockets.
2. **True Road-Aligned Navigation (No Straight Lines):**  
   Ambulances do not fly through buildings. Routes strictly follow real OpenStreetMap road curves and intersections, verified with 100% geometric corridor matching.
3. **Terrain-Aware Flood Slicing:**  
   Flooding is not a static circular radius. It is computed from actual satellite elevation data (DEM) and physical river channels, realistically flooding low-lying riverbanks while keeping elevated bridges open.
4. **Contrastive Explainability:**  
   The system doesn't just say *"take route B"*; it explains *why*: *"Avoided direct route via Alka Talkies due to 75cm floodwater. Detoured via elevated Karve Road arterial."*
5. **Multi-Echelon Care Matching:**  
   Emergency response does not stop when the ambulance picks up the patient. HC-05 coordinates the full chain: incident $\rightarrow$ dispatch $\rightarrow$ safe route $\rightarrow$ ICU hospital eligibility $\rightarrow$ temporary medical camp deployment.
6. **High-Performance Decoupled Layer Architecture:**  
   15,976 static roads and 1,500 3D buildings are loaded once into MapLibre GPU memory; WebSocket broadcasts carry only dynamic hazard updates (<40 KB), ensuring silky-smooth 60 FPS performance without browser freezing.

---

## M. Honest Project Limitations & Future Improvements

Be 100% transparent with judges. Judges respect teams that know their system's real-world boundaries:

| Current Limitation | Why it Exists in Prototype | Realistic Real-World Next Step |
|---|---|---|
| **Simplified 1D Flood Hydraulics** | Full 2D Navier-Stokes/Saint-Venant fluid dynamic solvers take hours to calculate; our simulation needs real-time responsiveness. | Ingest external hydrological feeds (such as CWC or IMD flood gauge telemetry) via standard APIs. |
| **Simulated Hospital Telemetry** | Hospitals do not publish live bed/ICU inventory on open public APIs due to privacy and local IT constraints. | Connect via HL7 / FHIR healthcare interoperability standards to hospital emergency management systems. |
| **Simulated Emergency Calls** | Real 112/911 CAD (Computer Aided Dispatch) feeds are restricted government networks. | Integrate with municipal 112 CAD dispatch feeds using standard webhook listeners. |
| **DEM Spatial Resolution (~150m grid)** | Downloaded public SRTM elevation is coarse; it cannot detect a 15cm road curb or micro-embankment. | Ingest high-resolution LiDAR or 1m drone photogrammetry elevation models for urban micro-topography. |
| **Static Traffic Congestion** | Road speeds are based on posted speed limits and flood penalties, not live traffic jams. | Ingest live TomTom, Google, or municipal traffic speed feeds into dynamic graph edge weights. |

---

## N. What to Say to Judges

### 1. The 30-Second Pitch
> *"Judges, when heavy monsoon rains flood a city like Pune, standard navigation apps fail because they don't know which streets are underwater. HC-05 is a climate-aware emergency response network. We combine real OpenStreetMap roads and NASA elevation data to simulate rising floodwaters, dispatch the best-equipped ambulance along flood-safe streets, route patients to hospitals with available ICU beds, and deploy temporary field camps to isolated zones. Everything is synchronized live between an administrator command center and an ambulance in-cab terminal."*

### 2. The 1-Minute Pitch
> *"Good morning, judges. During urban floods, emergency services face three fatal bottlenecks: roads submerge, ambulances take blind routes into floodwaters, and hospitals run out of ICU beds.  
> 
> We built HC-05 to solve this as one connected system. On our Administrator Dashboard, you can see Pune's real road network of 16,000 streets and 3D buildings. As flood levels rise, our engine calculates water depth using satellite elevation data and marks low-elevation streets as impassable.  
> 
> When an emergency is reported, our system doesn't just pick the closest vehicle—it evaluates ambulance medical capability, patient capacity, and flood-safe routes. The driver receives turn-by-turn navigation on their vehicle terminal, complete with an explanation of why that route was chosen. When the patient is picked up, it routes them to a hospital that actually has ICU capacity. And if an entire neighbourhood is cut off, it recommends deploying a temporary field clinic."*

### 3. The 2-Minute Pitch (Full Walkthrough)
> *(Use this if the judges ask: "Tell us about your project from start to finish.")*
> *"Judges, let's look at what happens when a severe storm hits Pune today. A dispatcher sends an ambulance, but five minutes later the ambulance is trapped behind a flooded underpass. Meanwhile, the patient is critical, and when the ambulance finally arrives at the hospital, there are zero open ICU beds.  
> 
> HC-05 is designed to prevent that exact failure chain. It consists of a FastAPI simulation backend and two synchronized frontends.  
> 
> First, for data: we downloaded 15,976 real OpenStreetMap road segments, 119 river channels, and NASA SRTM terrain elevation data for Pune.  
> 
> Second, our flood engine: as floodwaters rise, the system checks the elevation of every road segment. If water depth exceeds 50 centimetres, the road is marked blocked and assigned infinite cost in our NetworkX routing graph.  
> 
> Third, smart dispatch: when a call comes in, our multi-criteria engine checks available units, patient capacity, and medical capability—sending Advanced Life Support units to critical cases. The route is sliced directly from physical road geometry—zero straight-line fallbacks. If waters rise mid-transit, the ambulance is automatically rerouted along dry roads.  
> 
> Fourth, hospital and resource allocation: upon patient pickup, the system checks standard beds, ICU beds, and trauma capability, routing the vehicle to the optimal hospital. If an entire sector is completely cut off, our decision model flags a Medical Coverage Gap and prompts the admin to deploy a temporary 20-bed field camp.  
> 
> It's transparent, explainable, and built on real geographic foundations."*

### 4. Three Strong Innovations to Emphasize
1. **Real Road-Aligned Routing with Zero Straight-Line Fallbacks:** Every route follows real Pune OSM curbs and corners with 100% geometric validation.
2. **Dual-Dashboard Real-Time Synchronization:** Administrator command center and in-vehicle driver terminal stay in sync via WebSockets.
3. **Full Care-Chain Coordination:** Combines flood prediction, ambulance dispatch, ICU-constrained hospital matching, and field camp deployment in one closed loop.

### 5. Three Honest Boundaries to Acknowledge
1. We use an elevation-based flood approximation, not a heavy multi-hour hydrodynamic fluid simulation.
2. Hospital beds and ambulance GPS movement are simulated upon real static GIS data because live municipal emergency feeds are private.
3. Digital elevation resolution is satellite-grade (~150m grid), which does not capture micro-curbs.

---

## O. Live Demonstration Walkthrough Guide

Follow this exact script when demoing to judges. It takes approximately **2.5 to 3 minutes** and showcases every working feature reliably.

### Preparation Before Judges Arrive:
1. Ensure the backend is running on `http://127.0.0.1:8000`.
2. Ensure the frontend is open at `http://localhost:5173/admin`.
3. Have a second browser tab ready at `http://localhost:5173/ambulance`.

---

### Step-by-Step Demo Flow:

#### Step 1: Show the Command Map
- **What to do:** Point at the screen. Zoom in slightly on Pune's river bend.
- **What appears:** 3D buildings, riverbed, green road network, and administrative zone lines.
- **What to say:**  
  *"Judges, this is our Administrator Command Dashboard. Everything you see here is built on real OpenStreetMap data for Pune—nearly 16,000 real road segments and 1,500 3D building footprints, integrated with NASA terrain elevation data."*

#### Step 2: Click "LOAD DEMO SCENARIO"
- **What to do:** Click the blue **[LOAD DEMO SCENARIO]** button in the header.
- **What appears:**  
  - 4 ambulances are staged across North, West, South, and East Pune zones.
  - Active floodwaters expand along the riverbed.
  - Emergency call `INC-101` appears near Alka Talkies riverside.
  - `AMB-02` is automatically dispatched, and a road-following route polyline appears on the map.
  - Event stream logs: *"Demo scenario loaded... AMB-02 assigned (Fastest accessible unit with 1.3 min ETA)."*
- **What to say:**  
  *"I'll click Load Demo Scenario. Immediately, our dispatch engine evaluates all four ambulances. Notice that even though AMB-01 is close, the river crossing is flooded. The engine automatically selects AMB-02 on dry ground and routes it strictly along real streets—no diagonal shortcut lines across buildings."*

#### Step 3: Show the Ambulance In-Vehicle Terminal
- **What to do:** Switch to the Ambulance tab (`/ambulance`) or click the "Ambulance" switcher pill in the top right.
- **What appears:**  
  - AMB-02's in-cab terminal shows the incoming emergency alert (`INC-101`, High Severity, 1 Patient).
  - Navigation panel shows ETA (1.3 mins), distance (0.8 km), and the safe route rationale.
- **What to say:**  
  *"Now we switch to the ambulance driver's screen. The driver sees their assigned emergency, turn-by-turn navigation, and a plain-English explanation of why this route was selected to avoid waterlogged roads."*

#### Step 4: Advance Ambulance Workflow
- **What to do:** Click **[ACCEPT EMERGENCY CALL]**, then click **[CONFIRM PATIENT PICKUP]**.
- **What appears:**  
  - Status updates to `PATIENT_PICKED_UP`.
  - The system automatically selects KEM Hospital or Sassoon Hospital based on ICU availability and safe road access.
  - The button changes to **[START ROUTE TO HOSPITAL]**.
- **What to say:**  
  *"When paramedics reach the patient and confirm pickup, the system instantly evaluates all 8 regional hospitals. It checks bed capacity, ICU availability, and flood-free access roads, routing the vehicle to the optimal facility."*

#### Step 5: Switch Back to Admin & Show Report Incident / Medical Camp
- **What to do:** Switch back to `/admin`. Click **[Report Incident]** in the header. Click anywhere on the map.
- **What appears:** The emergency reporting modal pops up. Click "Dispatch Emergency Response".
- **What to say:**  
  *"An administrator can also report new emergencies anywhere on the map with one click. The coordinates immediately snap to the nearest road, dispatching the next available unit."*

#### Backup Plan (What if an API lags or the browser freezes?):
- **If map doesn't respond:** Refresh the page (`F5`). All static layers reload in under 1 second.
- **If backend is paused:** Click the green **Play** button in the header.
- **If offline:** Explain that the entire GIS dataset and ML models are stored locally on disk and run 100% offline without external internet calls.

---

## P. 22 Likely Judge Questions & Honest Answers

### 1. What problem does HC-05 solve?
> During monsoon floods, roads become submerged, hospitals lose capacity, and navigation apps blindly route vehicles into dangerous water. HC-05 coordinates flood prediction, road accessibility, ambulance dispatch, and hospital ICU matching in one real-time system.

### 2. How is this different from Google Maps?
> Consumer navigation apps rely on live crowd-sourced traffic and do not model physical flood depth, vehicle wading clearance, ICU bed constraints, or emergency fleet coverage balance. HC-05 deterministically blocks roads exceeding emergency vehicle water thresholds and integrates hospital eligibility directly into navigation.

### 3. What data in your project is real and what is simulated?
> The road network (15,976 segments), waterways, 3D buildings, hospital locations, zone demographics, and elevation terrain are **100% real static data** from OpenStreetMap, HDX, and NASA SRTM. The floodwater rise curve, emergency call arrivals, ambulance movement, and live hospital bed decrements are **simulated dynamically** on top of that real geography.

### 4. How do you know the routes follow real roads?
> We use NetworkX graph routing combined with Shapely spatial indexing. We do not use straight-line shortcuts. Our automated GIS validation script (`validate_gis.py`) verifies a **100.0% buffer match** between generated routes and physical OpenStreetMap road polylines.

### 5. How accurate is your flood model?
> It is an operational 1D stage-elevation urban approximation based on satellite digital elevation models (DEM), **not a full 2D hydrodynamic fluid simulation**. It accurately identifies low-elevation riverbanks and depressions, but does not model fluid velocity or drainage storm-pipe physics.

### 6. Why did you use Machine Learning?
> We use ML for three specific tasks: predicting emergency call demand across zones using Random Forest ($R^2 = 0.969$), classifying zone risk using Gradient Boosting (84.4% accuracy), and predicting road inundation probability. However, all safety-critical road closures use deterministic physical thresholds (water depth $\ge 0.50$m), not black-box predictions alone.

### 7. Does your dispatch always choose the closest ambulance?
> No. A vehicle 500 metres away across a flooded river is useless. Our multi-criteria dispatch algorithm evaluates road network travel time, route flood hazard penalties, vehicle patient capacity, Advanced Life Support capability match, and zone coverage preservation.

### 8. What happens if a road on an active route gets flooded while the ambulance is driving?
> The simulation engine checks active ambulance routes against newly blocked roads on every tick. If an intersection occurs, it automatically triggers a **Live Reroute**, calculates an alternate dry route, updates the driver's screen, and logs an alert.

### 9. How do you select which hospital to send a patient to?
> We enforce hard constraints: standard bed availability, ICU bed availability for critical patients, and verified trauma capability. Among qualifying hospitals with accessible road corridors, the system selects the facility with the lowest travel time and healthy capacity headroom.

### 10. What is a "Medical Coverage Gap"?
> When floodwaters cut off all access roads between a populated neighbourhood and regional hospitals while emergency calls rise, that neighbourhood becomes an isolated medical island. Our decision model detects this and recommends deploying a temporary 20-bed emergency field camp.

### 11. Can HC-05 be deployed in a real city emergency today?
> Not as a standalone replacement for official systems. It is an operational prototype and simulation testbed. Real deployment would require integrating official municipal 112 CAD feeds, live hospital EHR inventory, and formal civil protection validation.

### 12. Why did you use WebSockets?
> WebSockets provide a persistent, bi-directional channel between the backend and browser. This allows the backend to broadcast disaster progression, vehicle movements, and road status changes to all open screens every second without wasteful HTTP polling.

### 13. Did you use Google OR-Tools?
> OR-Tools is in our dependency specifications, but our core dispatch and hospital matching are implemented using **Multi-Criteria Decision Analysis (MCDA), constraint satisfaction, and NetworkX Dijkstra algorithms**. We chose this because it executes in sub-milliseconds and provides 100% explainability.

### 14. How did you prevent the map from lagging with 16,000 roads?
> We decoupled static geographic layers from dynamic state. All 15,976 static road lines and 3D buildings load once into MapLibre GPU memory on startup. WebSocket broadcasts only transmit the few dynamic roads that are currently flooded (<40 KB payload), achieving a 200x bandwidth reduction and maintaining 60 FPS.

### 15. What happens if there are no available ambulances?
> The system queues the incident, logs an alert in the event stream, and evaluates whether a temporary medical camp should be deployed nearby to stabilize patients locally.

### 16. Why did you choose Pune as the study city?
> Pune experiences recurring monsoon flash floods along the confluence of the Mutha and Mula rivers (such as the Khadakwasla dam releases), making it an ideal real-world urban testbed with documented floodplains and available open datasets.

### 17. How does the system handle clicking on a building instead of a road?
> It uses an `STRtree` spatial index to perform sub-millisecond point-to-segment projection. It keeps the clicked point as the visual map marker while snapping the routing coordinate onto the nearest road centerline.

### 18. Why do you have two dashboards instead of one?
> In emergency management, the coordinator and the ambulance driver have completely different jobs. The coordinator needs an eagle-eye view of all resources, hospitals, and floods. The driver needs high-contrast, uncluttered turn-by-turn directions, patient vitals, and clear action buttons.

### 19. What is "contrastive explainability"?
> Instead of just giving an optimal route, the system contrasts it with the alternative: *"Avoided direct route via Alka Talkies due to 75cm floodwater. Detoured via elevated Karve Road arterial."* This gives human operators confidence in the system's recommendations.

### 20. What was the hardest bug you solved during development?
> After importing real OpenStreetMap roads, the browser froze because MapLibre was re-rendering 16,000 road lines on every 1-second tick, and backend routes were accidentally embedding non-serializable Shapely geometry objects. We resolved both by making geometries GeoJSON-compliant and decoupling static layers from dynamic flood overlays.

### 21. How do you handle patients with different triage levels?
> Incidents are tagged as Low, Medium, High, or Critical. Critical patients require Advanced Life Support (ALS) ambulances with paramedics and are strictly routed to hospitals with verified trauma centers and open ICU beds.

### 22. What is your team's vision for future development?
> Integrating live municipal traffic sensor feeds, ingesting drone LiDAR micro-topography for centimeter-accurate water depth, and connecting to hospital EHR systems via standard HL7/FHIR healthcare protocols.

---

## Q. Simple Technical Glossary

- **GIS (Geographic Information System):** Computer software and data structures designed to capture, store, manipulate, and display geographic data (locations, lines, and polygons).
- **DEM (Digital Elevation Model):** A digital 3D grid representing the ground surface elevation (height above sea level) of a terrain.
- **OSM (OpenStreetMap):** A free, crowdsourced worldwide geographic database containing streets, buildings, rivers, and landmarks.
- **Road Graph:** A mathematical network where intersections are "nodes" and road streets are "edges" connecting them.
- **Road Segment:** An individual stretch of street between two intersections.
- **Map Matching (Snapping):** The process of taking a GPS coordinate or mouse click and projecting it onto the closest valid road line.
- **Route ETA:** Estimated Time of Arrival—the calculated travel duration based on distance, speed limits, and hazard penalties.
- **Flood Inundation Extent:** The geographic boundary or surface area covered by floodwaters.
- **Road Accessibility:** The operational status of a road for emergency vehicles (`OPEN`, `RESTRICTED`, `HIGH_RISK`, `BLOCKED`).
- **API (Application Programming Interface):** The communication bridge that allows the React frontend to request data from the FastAPI backend.
- **WebSocket:** A continuous, persistent two-way communication line that lets the server push live updates to the browser instantly.
- **Machine Learning (ML):** Computer algorithms that learn statistical patterns from historical data to make predictions on new data.
- **Optimization:** Mathematical algorithms that select the best possible decision (lowest cost, fastest time) while respecting strict limits (capacity, ICU beds).
- **Hospital Capacity:** The number of available general beds and intensive care unit (ICU) beds currently unoccupied.
- **Medical Coverage Gap:** A situation where an urban population has emergency demand but zero accessible routes to hospital care due to disasters.
