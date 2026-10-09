# HC-05 — 5-Minute Team Quick Reference Guide

> **Cheat sheet for the presenting teammate!**  
> Read this sheet 10 minutes before presenting to the judges. It gives you the core facts, demo steps, and answers to tough questions in compact bullet points.

---

## 1. Project Definition (In One Sentence)
**HC-05** is an intelligent disaster emergency simulation system for Pune that combines real OpenStreetMap roads, terrain elevation, and flood progression to dispatch ambulances along flood-safe routes, match patients to hospitals with open ICU beds, and deploy temporary field camps to isolated zones.

---

## 2. Problem & Solution
- **The Problem:** During urban monsoon floods, streets submerge rapidly. Consumer navigation apps blindly direct ambulances into deep water, dispatchers choose the geographically nearest vehicle rather than the flood-safe one, and patients get routed to hospitals that have zero ICU beds or no power.
- **Our Solution:** A single connected simulation engine with two real-time dashboards (Admin Command Center & Ambulance In-Vehicle Terminal). It dynamically blocks flooded roads, calculates road-following safe routes, evaluates multi-criteria dispatch, enforces hospital ICU limits, and detects isolated medical gaps.

---

## 3. The 30-Second Elevator Pitch
> *"Judges, when severe monsoon rains flood urban streets, standard GPS navigation fails because it doesn't know which roads are underwater. HC-05 is a climate-aware emergency response network for Pune. We combine 16,000 real OpenStreetMap road segments and satellite elevation data to simulate rising floodwaters, dispatch the best-equipped ambulance along flood-safe streets, route patients to hospitals with available ICU beds, and deploy temporary field camps to cut-off neighbourhoods. Everything is synchronized live between an administrator command dashboard and an ambulance in-cab terminal."*

---

## 4. Dual Dashboards: Who Uses What?
1. **Administrator Dashboard (`/admin`):**
   - **User:** Emergency management coordinators and civil defense leadership.
   - **What they do:** Monitor 3D city map, watch floodwaters expand, start/pause/step simulation, trigger scenarios (Normal, Moderate, Severe), click map to report emergencies, inspect hospital loads, and deploy temporary field camps.
2. **Ambulance In-Vehicle Dashboard (`/ambulance`):**
   - **User:** Paramedics and ambulance drivers inside the vehicle cab.
   - **What they do:** Select vehicle (`AMB-01` to `AMB-04`), view assigned call details, tap **[Accept Call]**, follow turn-by-turn flood-safe directions, tap **[Confirm Patient Pickup]**, and follow safe navigation to the selected ICU-ready hospital.

---

## 5. Technology Stack Summary
| Domain | Main Technologies | Purpose in Project |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite, MapLibre GL JS, Tailwind CSS | High-performance reactive UI; renders 15,976 roads and 3D buildings at 60 FPS. |
| **Backend** | Python 3.11, FastAPI, Uvicorn, WebSockets, Pydantic | Asynchronous simulation engine; broadcasts live state every second. |
| **GIS & Routing** | NetworkX, Shapely, STRtree spatial indexing | Topological graph routing; sub-millisecond road snapping; subsegment slicing. |
| **Machine Learning** | scikit-learn, NumPy, Pandas, Joblib | 3 trained models: Demand prediction ($R^2=0.969$), Risk scoring ($84.4\%$), Road accessibility. |
| **Optimization** | Multi-Criteria Decision Analysis (MCDA), Dijkstra | Evaluates ETA, hazard penalties, medical capability, and capacity. *(Note: OR-Tools is NOT used).* |

---

## 6. Real Static Geography vs. Simulated Dynamic State
- **REAL & STATIC (Ground Truth):**
  - **15,976 OpenStreetMap road segments** with real topology, lengths, speed limits, and bridges.
  - **119 OSM river channels** (Mutha & Mula river network).
  - **1,500 real 3D building footprints** with extruded heights.
  - **8 real Pune hospital locations** (Sassoon, KEM, Ruby Hall, Deenanath, etc.).
  - **NASA SRTM 35×45 digital elevation model (DEM)** (535.9m to 671.4m MSL).
  - **8 UN OCHA / HDX administrative zones** with census population baselines.
- **SIMULATED & DYNAMIC (Scenario-Driven):**
  - Water level rise curve (0.0m to 4.2m).
  - Spatial flood polygon expanding over low-elevation terrain cells.
  - Road inundation and blockage status.
  - Emergency call arrivals and severity ratings.
  - Ambulance GPS movement along road polylines.
  - Hospital bed and ICU deductions upon patient admission.
  - 20-bed temporary medical camp triage deployment.

---

## 7. Key Innovations to Highlight
1. **True Road-Aligned Routing (Zero Straight Lines):** Ambulances never fly across buildings; routes follow physical street curves with 100% geometric validation.
2. **Terrain-Aware Flood Hydraulics:** Flooding is derived from actual satellite elevation; elevated bridges stay open while low riverbanks submerge.
3. **Contrastive Route Rationale:** System explains *why* a route was selected (e.g., *"Avoided Alka Talkies due to 75cm floodwater; detoured via elevated Karve Road"*).
4. **Full Care-Chain Integration:** Connects flood prediction $\rightarrow$ ambulance dispatch $\rightarrow$ safe routing $\rightarrow$ ICU hospital eligibility $\rightarrow$ field camp deployment.
5. **Decoupled 60 FPS Performance:** 16,000 static roads load once on startup; WebSockets send only small hazard updates (<40 KB), preventing browser lockup.

---

## 8. Honest Limitations (Acknowledge If Asked)
1. **Flood Physics:** We use an elevation-based stage approximation, not a full 2D Saint-Venant fluid dynamics simulation.
2. **Simulated Fleets & Hospital Telemetry:** Ambulance GPS movement and live bed numbers are simulated on top of real GIS data because official government CAD and hospital EHR feeds are private.
3. **Coarse Elevation Grid:** Public SRTM satellite radar has ~150m grid resolution, which cannot detect 15cm road curbs.

---

## 9. Live Demo Step-by-Step Checklist (2.5 Minutes)
1. **Initial View (`/admin`):**
   - Point to Pune 3D map: *"16,000 real OpenStreetMap road segments, 1,500 3D buildings, NASA elevation data."*
2. **Click [LOAD DEMO SCENARIO]:**
   - Show 4 staged ambulances across Pune.
   - Show expanding river floodwaters and emergency incident `INC-101`.
   - Explain dispatch: *"AMB-02 on dry ground is automatically chosen over AMB-01 across the flooded river."*
3. **Switch to Ambulance View (`/ambulance`):**
   - Show AMB-02's in-cab terminal.
   - Point to turn-by-turn route, ETA (1.3 mins), and contrastive plain-English explanation.
4. **Advance Workflow:**
   - Click **[ACCEPT CALL]**, then **[CONFIRM PATIENT PICKUP]**.
   - Show automatic hospital evaluation: *"System checks open ICU beds and routes to KEM Hospital."*
   - Click **[START ROUTE TO HOSPITAL]**.
5. **Switch Back to Admin:**
   - Click **[Report Incident]**, click the map, submit modal: *"Coordinates snap to the road network in under 1 millisecond."*

---

## 10. 10 Tough Judge Questions & Quick Answers

1. **How is this different from Google Maps?**  
   *Answer:* Google Maps uses crowd-sourced traffic and does not model physical flood depth, vehicle wading limits, hospital ICU bed constraints, or medical coverage gaps.

2. **How do you guarantee routes don't cut through buildings?**  
   *Answer:* We use NetworkX graph routing combined with Shapely subsegment slicing. Our automated GIS validation test proves a 100% buffer match with OpenStreetMap road corridors.

3. **Did you use Google OR-Tools?**  
   *Answer:* No. OR-Tools was in our initial dependencies, but we implemented optimization using Multi-Criteria Decision Analysis (MCDA), constraint filtering, and NetworkX Dijkstra algorithms for sub-millisecond speed and 100% explainability.

4. **Why did you use Machine Learning instead of just rules?**  
   *Answer:* We use ML where relationships are non-linear and complex: predicting emergency call volume across zones ($R^2=0.969$) and multi-factor zone risk ($84.4\%$ accuracy). However, safety-critical road closures use deterministic physical depth rules ($\ge 0.50$m), not ML alone.

5. **How accurate is your flood model?**  
   *Answer:* It is an operational 1D stage-elevation urban approximation based on satellite digital elevation models (DEM), not a full 2D hydrodynamic fluid simulation. It accurately identifies low-elevation riverbanks and depressions.

6. **What is a Medical Coverage Gap?**  
   *Answer:* When floodwaters isolate an urban sector from all hospitals while local emergency calls surge, the system flags a gap and recommends deploying a temporary 20-bed triage field camp.

7. **How do you handle a road becoming flooded mid-trip?**  
   *Answer:* On every simulation tick, active routes are checked against newly blocked roads. If an intersection occurs, the engine triggers a live reroute along dry roads and alerts the driver.

8. **What was the hardest technical challenge you solved?**  
   *Answer:* Decoupling the rendering pipeline. Rendering 16,000 real roads on every second locked the browser main thread. We separated static roads into a one-time GPU upload and broadcast only dynamic flood overlays (<40 KB) over WebSockets, maintaining 60 FPS.

9. **Can this be used in a real disaster today?**  
   *Answer:* As an operational simulation and planning testbed, yes. For real-world field deployment, it would require connecting to municipal 112 CAD feeds and live hospital EHR telemetry.

10. **What is your next technical milestone?**  
    *Answer:* Ingesting live municipal traffic sensor feeds, drone LiDAR micro-topography for centimeter-accurate curb depths, and connecting to hospital EHR systems via standard HL7/FHIR healthcare protocols.
