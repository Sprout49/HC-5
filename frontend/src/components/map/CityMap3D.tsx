import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
// @ts-ignore
import maplibreglWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useSimulation, API_BASE } from '../../context/SimulationContext';
import type { Ambulance, Hospital, Incident, Road, Zone, MedicalCamp } from '../../types/simulation';
import { Compass, Layers } from 'lucide-react';

maplibregl.setWorkerUrl(maplibreglWorker);

interface CityMap3DProps {
  isCreateMode?: boolean;
  onMapClickForEmergency?: (coords: [number, number]) => void;
  onSelectObject?: (type: 'road' | 'hospital' | 'ambulance' | 'zone' | 'incident' | 'camp', data: any) => void;
  focusAmbulanceId?: string | null;
  realGpsCoords?: [number, number] | null;
  renderTopRightControls?: (helpers: { is3D: boolean; toggle2D3D: () => void; resetCamera: () => void }) => React.ReactNode;
}

export const CityMap3D: React.FC<CityMap3DProps> = ({
  isCreateMode = false,
  onMapClickForEmergency,
  onSelectObject,
  focusAmbulanceId,
  realGpsCoords,
  renderTopRightControls,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { state } = useSimulation();

  const [is3D, setIs3D] = useState(true);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

  // Active refs to avoid stale closures in MapLibre event listeners
  const isCreateModeRef = useRef(isCreateMode);
  isCreateModeRef.current = isCreateMode;

  const onMapClickForEmergencyRef = useRef(onMapClickForEmergency);
  onMapClickForEmergencyRef.current = onMapClickForEmergency;

  const onSelectObjectRef = useRef(onSelectObject);
  onSelectObjectRef.current = onSelectObject;

  const PUNE_CENTER: [number, number] = [73.8567, 18.5204];

  // Update cursor dynamically when creation mode toggles
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = isCreateMode ? 'crosshair' : '';
  }, [isCreateMode]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Clean, modern light vector style using Carto Positron / OSM
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: PUNE_CENTER,
      zoom: 13.6,
      pitch: 58, // Isometric 3D angle
      bearing: -18,
    });

    mapRef.current = map;

    map.on('load', async () => {
      // 1. Waterways Base Layer (Mutha & Mula Rivers)
      try {
        const waterRes = await fetch(`${API_BASE}/gis/waterways`);
        const waterGeo = await waterRes.json();
        map.addSource('waterways-source', {
          type: 'geojson',
          data: waterGeo,
        });

        map.addLayer({
          id: 'waterways-casing',
          type: 'line',
          source: 'waterways-source',
          paint: {
            'line-color': '#0369a1',
            'line-width': 26,
            'line-opacity': 0.7,
            'line-blur': 4,
          },
        });

        map.addLayer({
          id: 'waterways-riverbed',
          type: 'line',
          source: 'waterways-source',
          paint: {
            'line-color': '#0284c7',
            'line-width': 18,
            'line-opacity': 0.85,
          },
        });
      } catch (err) {
        console.warn('Could not load waterways GeoJSON:', err);
      }

      // 2. Spatial Flood Inundation Polygon Surface (DEM-Derived)
      map.addSource('flood-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'flood-fill',
        type: 'fill',
        source: 'flood-source',
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.55,
          'fill-antialias': true,
        },
      });

      map.addLayer({
        id: 'flood-stroke',
        type: 'line',
        source: 'flood-source',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
          'line-opacity': 0.85,
        },
      });

      // 3. Add Sources for Zones
      map.addSource('zones-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'risk_level'],
            'LOW', '#22c55e',
            'MEDIUM', '#eab308',
            'HIGH', '#f97316',
            'CRITICAL', '#ef4444',
            '#94a3b8',
          ],
          'fill-opacity': 0.18,
        },
      });

      map.addLayer({
        id: 'zones-line',
        type: 'line',
        source: 'zones-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'risk_level'],
            'LOW', '#16a34a',
            'MEDIUM', '#ca8a04',
            'HIGH', '#ea580c',
            'CRITICAL', '#dc2626',
            '#64748b',
          ],
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });

      // 4. Base Roads Network Layer (Loaded once from static GIS endpoint)
      map.addSource('roads-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Road Casing (glow/outline)
      map.addLayer({
        id: 'roads-casing',
        type: 'line',
        source: 'roads-source',
        paint: {
          'line-color': '#ffffff',
          'line-width': 5,
          'line-opacity': 0.7,
        },
      });

      // Road Base Line Color (Emerald safe color for open network)
      map.addLayer({
        id: 'roads-line',
        type: 'line',
        source: 'roads-source',
        paint: {
          'line-color': '#16a34a',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });

      // 4b. Dynamic Flooded/Hazardous Roads Layer
      map.addSource('flooded-roads-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Flooded Street Inundation Overlay (highlighting water running on flooded roads)
      map.addLayer({
        id: 'roads-flooded-glow',
        type: 'line',
        source: 'flooded-roads-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'RESTRICTED', '#38bdf8',
            'HIGH_RISK', '#f97316',
            'BLOCKED', '#ef4444',
            '#38bdf8'
          ],
          'line-width': 10,
          'line-opacity': 0.6,
          'line-blur': 4,
        },
      });

      map.addLayer({
        id: 'roads-flooded-line',
        type: 'line',
        source: 'flooded-roads-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'RESTRICTED', '#eab308',
            'HIGH_RISK', '#ea580c',
            'BLOCKED', '#dc2626',
            '#ef4444'
          ],
          'line-width': 5,
          'line-opacity': 0.95,
        },
      });

      // 5. Active Routes Source & Layers
      map.addSource('routes-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Rerouted / Previous Route (Red/dashed)
      map.addLayer({
        id: 'routes-previous',
        type: 'line',
        source: 'routes-source',
        filter: ['==', ['get', 'type'], 'previous'],
        paint: {
          'line-color': '#ef4444',
          'line-width': 5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.65,
        },
      });

      // Active Primary Route (Glowing Blue)
      map.addLayer({
        id: 'routes-active-glow',
        type: 'line',
        source: 'routes-source',
        filter: ['==', ['get', 'type'], 'active'],
        paint: {
          'line-color': '#3b82f6',
          'line-width': 8,
          'line-opacity': 0.45,
          'line-blur': 3,
        },
      });

      map.addLayer({
        id: 'routes-active',
        type: 'line',
        source: 'routes-source',
        filter: ['==', ['get', 'type'], 'active'],
        paint: {
          'line-color': '#2563eb',
          'line-width': 4.5,
          'line-opacity': 0.95,
        },
      });

      // 6. Fetch and Render 3D Buildings Footprints on TOP of ground/flood layers
      // This ensures 3D building walls physically rise out of the streets and water corridors
      try {
        const bldRes = await fetch(`${API_BASE}/gis/buildings`);
        const bldGeo = await bldRes.json();

        map.addSource('buildings-source', {
          type: 'geojson',
          data: bldGeo,
        });

        map.addLayer({
          id: '3d-buildings',
          source: 'buildings-source',
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base_height'],
            'fill-extrusion-opacity': 0.92,
          },
        });
      } catch (err) {
        console.warn('Could not load buildings GeoJSON:', err);
      }

      // Load static road network once on initial map load
      try {
        const roadsRes = await fetch(`${API_BASE}/gis/roads`);
        const roadsGeo = await roadsRes.json();
        const staticRoadsSource = map.getSource('roads-source') as maplibregl.GeoJSONSource;
        if (staticRoadsSource) {
          staticRoadsSource.setData(roadsGeo);
        }
      } catch (err) {
        console.warn('Could not load static roads GeoJSON:', err);
      }

      // Click listener for interactive inspection or emergency creation
      map.on('click', (e: maplibregl.MapMouseEvent) => {
        if (isCreateModeRef.current && onMapClickForEmergencyRef.current) {
          onMapClickForEmergencyRef.current([e.lngLat.lng, e.lngLat.lat]);
          return;
        }

        // Check if road clicked (check dynamic flooded roads first, then base roads)
        const roadFeatures = map.queryRenderedFeatures(e.point, { layers: ['roads-flooded-line', 'roads-line'] });
        if (roadFeatures.length > 0 && onSelectObjectRef.current) {
          onSelectObjectRef.current('road', roadFeatures[0].properties);
          return;
        }

        // Check if zone clicked
        const zoneFeatures = map.queryRenderedFeatures(e.point, { layers: ['zones-fill'] });
        if (zoneFeatures.length > 0 && onSelectObjectRef.current) {
          onSelectObjectRef.current('zone', zoneFeatures[0].properties);
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Layers & Markers with Live Shared Simulation State
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !state) return;

    // 1. Update Zones GeoJSON
    const zonesSource = map.getSource('zones-source') as maplibregl.GeoJSONSource;
    if (zonesSource && state.zones) {
      zonesSource.setData({
        type: 'FeatureCollection',
        features: state.zones.map((z: Zone) => ({
          type: 'Feature',
          properties: z,
          geometry: { type: 'Polygon', coordinates: z.coordinates },
        })),
      });
    }

    // 2. Update Dynamic Flooded Roads GeoJSON (only non-OPEN roads from shared simulation state)
    const floodedSource = map.getSource('flooded-roads-source') as maplibregl.GeoJSONSource;
    if (floodedSource && state.roads) {
      floodedSource.setData({
        type: 'FeatureCollection',
        features: state.roads.map((r: Road) => ({
          type: 'Feature',
          properties: r,
          geometry: { type: 'LineString', coordinates: r.coordinates },
        })),
      });
    }

    // 3. Update Spatial Flood Inundation Surface (MultiPolygon from Backend)
    const floodSource = map.getSource('flood-source') as maplibregl.GeoJSONSource;
    if (floodSource) {
      if (state.flood_polygon && state.flood_polygon.features && state.flood_polygon.features.length > 0) {
        floodSource.setData(state.flood_polygon);
      } else {
        floodSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }

    // 4. Update Routes GeoJSON
    const routesSource = map.getSource('routes-source') as maplibregl.GeoJSONSource;
    if (routesSource) {
      const routeFeatures: any[] = [];
      state.ambulances.forEach((amb: Ambulance) => {
        if (amb.active_route && amb.active_route.route_coordinates) {
          routeFeatures.push({
            type: 'Feature',
            properties: { type: 'active', ambulance_id: amb.ambulance_id },
            geometry: { type: 'LineString', coordinates: amb.active_route.route_coordinates }
          });
        }
        if (amb.previous_route && amb.previous_route.route_coordinates) {
          routeFeatures.push({
            type: 'Feature',
            properties: { type: 'previous', ambulance_id: amb.ambulance_id },
            geometry: { type: 'LineString', coordinates: amb.previous_route.route_coordinates }
          });
        }
      });
      routesSource.setData({ type: 'FeatureCollection', features: routeFeatures });
    }

    // 5. Update HTML Markers (Hospitals, Ambulances, Incidents, Camps)
    // CRITICAL: Stable instances without transition on root element to prevent zoom/pan float bug!
    const currentMarkerKeys = new Set<string>();

    // Hospitals
    state.hospitals.forEach((h: Hospital) => {
      const key = `hosp-${h.hospital_id}`;
      currentMarkerKeys.add(key);

      if (!markersRef.current[key]) {
        const el = document.createElement('div');
        el.className = 'cursor-pointer group select-none';
        el.innerHTML = `
          <div class="flex items-center gap-1.5 bg-white/95 px-2 py-1 rounded-full border border-blue-200 shadow-md hover:scale-105 transition-transform">
            <span class="flex items-center justify-center w-5 h-5 bg-blue-600 text-white rounded-full text-xs font-bold">🏥</span>
            <span class="text-xs font-semibold text-slate-800">${h.name.split(' ')[0]}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${h.available_beds > 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${h.available_beds} beds
            </span>
          </div>
        `;
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectObjectRef.current?.('hospital', h);
        };

        markersRef.current[key] = new maplibregl.Marker({ element: el })
          .setLngLat(h.coordinates)
          .addTo(map);
      } else {
        markersRef.current[key].setLngLat(h.coordinates);
      }
    });

    // Ambulances
    state.ambulances.forEach((amb: Ambulance) => {
      const key = `amb-${amb.ambulance_id}`;
      currentMarkerKeys.add(key);

      const isLiveGpsActive = Boolean(focusAmbulanceId === amb.ambulance_id && realGpsCoords);
      const markerLocation: [number, number] = isLiveGpsActive ? realGpsCoords! : amb.current_location;

      const isTrapped = amb.status === 'TRAPPED_IN_FLOOD';
      const isRelocating = amb.status === 'RELOCATING_TO_SAFETY';
      const isResponding = amb.status.includes('EN_ROUTE') || amb.status === 'CALL_RECEIVED' || amb.status === 'AT_PATIENT';
      
      const statusColor = isLiveGpsActive ? 'bg-cyan-400' : isTrapped ? 'bg-red-600' : isRelocating ? 'bg-amber-400' : isResponding ? 'bg-amber-500' : 'bg-blue-600';
      const patients = amb.patients_onboard || 0;
      
      const label = isLiveGpsActive ? `${amb.ambulance_id} • 📡 LIVE GPS` :
                    isTrapped ? `${amb.ambulance_id} • 🆘 TRAPPED IN FLOOD` :
                    isRelocating ? `${amb.ambulance_id} • 🛡️ EVACUATING (${amb.eta_minutes.toFixed(1)}m)` :
                    amb.status === 'EN_ROUTE_TO_PATIENT' ? `${amb.ambulance_id} • SCENE (${amb.eta_minutes.toFixed(1)}m)` :
                    amb.status === 'EN_ROUTE_TO_HOSPITAL' ? (amb.diverted_hospital ? `${amb.ambulance_id} • 🚨 DIVERTED (${amb.eta_minutes.toFixed(1)}m)` : `${amb.ambulance_id} • HOSP (${amb.eta_minutes.toFixed(1)}m)`) :
                    amb.status === 'AT_PATIENT' ? `${amb.ambulance_id} • AT SCENE` :
                    amb.status === 'CALL_RECEIVED' ? `${amb.ambulance_id} • DISPATCHED` :
                    amb.ambulance_id;

      const pillClass = isLiveGpsActive ? 'bg-cyan-600 ring-4 ring-cyan-300 shadow-2xl animate-pulse' :
                        isTrapped ? 'bg-red-700 ring-4 ring-red-400 shadow-2xl animate-pulse' :
                        isRelocating ? 'bg-amber-600 ring-2 ring-amber-300 shadow-xl' :
                        isResponding ? 'bg-blue-700 ring-2 ring-amber-400 shadow-amber-500/20' :
                        'bg-slate-900 ring-1 ring-slate-700';

      const markerInnerHtml = `
        <div class="relative flex flex-col items-center group">
          <!-- Rich Hover Tooltip -->
          <div class="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-950/95 text-white p-2.5 rounded-xl shadow-2xl border border-slate-700/80 text-xs w-64 pointer-events-none z-50 backdrop-blur-md">
            <div class="flex items-center justify-between font-bold border-b border-slate-800 pb-1.5 mb-1.5">
              <span class="text-blue-400 font-extrabold flex items-center gap-1">
                <span>🚑</span>
                <span>${amb.ambulance_id}</span>
                <span class="text-[10px] text-slate-400 font-normal">(${amb.type})</span>
              </span>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-black ${isLiveGpsActive ? 'bg-cyan-500 text-slate-950' : isTrapped ? 'bg-red-600 text-white animate-bounce' : isResponding ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'}">
                ${isLiveGpsActive ? 'HARDWARE LIVE GPS' : amb.status.replace(/_/g, ' ')}
              </span>
            </div>
            
            <div class="space-y-1 text-[11px] text-slate-300">
              ${isLiveGpsActive ? `
              <div class="p-1.5 bg-cyan-950/80 border border-cyan-400/60 rounded-lg text-cyan-200 font-bold text-[10px] leading-tight">
                📡 LIVE HARDWARE GPS LOCK: Streaming real-time telemetry from operator device.
              </div>` : ''}
              ${isTrapped ? `
              <div class="p-1.5 bg-red-950/80 border border-red-500/60 rounded-lg text-red-200 font-bold text-[10px] leading-tight">
                🆘 MAYDAY: Vehicle immobilised by severe floodwaters! Engine stalled. Urgent boat rescue needed.
              </div>` : ''}
              ${isRelocating ? `
              <div class="p-1.5 bg-amber-950/80 border border-amber-500/60 rounded-lg text-amber-200 font-bold text-[10px] leading-tight">
                🛡️ Proactive safety evacuation to high-ground staging base away from rising flood.
              </div>` : ''}
              <div class="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                <span class="text-slate-400">Patients:</span>
                <span class="font-bold ${patients > 0 ? 'text-amber-400' : 'text-emerald-400'}">
                  👥 ${patients} / 2 ${patients > 0 ? '(Patient Onboard)' : '(Available)'}
                </span>
              </div>
              <div class="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                <span class="text-slate-400">Speed:</span>
                <span class="font-semibold text-slate-200">${isTrapped ? '0' : amb.speed_kmh || 45} km/h</span>
              </div>
              <div class="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                <span class="text-slate-400">Assigned Staging:</span>
                <span class="font-semibold text-slate-200">Zone ${amb.assigned_zone}</span>
              </div>
              ${amb.eta_minutes > 0 ? `
              <div class="flex justify-between items-center py-0.5 border-b border-slate-800/60 text-sky-300">
                <span class="font-semibold">Estimated Arrival:</span>
                <span class="font-black text-amber-400">${amb.eta_minutes.toFixed(1)} min</span>
              </div>` : ''}
              ${amb.active_route?.explanation ? `
              <div class="pt-1 text-[10px] text-sky-200 leading-snug">
                <span class="text-slate-400 font-medium">Route Decision:</span><br/>
                <span>🛡️ ${amb.active_route.explanation}</span>
              </div>` : ''}
            </div>
          </div>

          <!-- Ambulance Badge Pill -->
          <div class="flex items-center gap-1.5 ${pillClass} text-white px-2 py-1 rounded-lg shadow-xl text-xs font-bold transition-transform duration-200 group-hover:scale-105">
            <span>🚑</span>
            <span>${label}</span>
            <span class="px-1.5 py-0.2 text-[10px] rounded font-black ${patients > 0 ? 'bg-amber-400 text-slate-950 shadow-xs' : 'bg-slate-800 text-slate-300 border border-slate-700'}">
              👥 ${patients}/2
            </span>
            <span class="w-2 h-2 rounded-full ${statusColor} ${isResponding || isTrapped || isLiveGpsActive ? 'animate-ping' : ''}"></span>
          </div>
          <div class="w-1.5 h-2 bg-slate-900"></div>
        </div>
      `;

      if (!markersRef.current[key]) {
        const el = document.createElement('div');
        el.className = 'cursor-pointer select-none';
        el.id = `marker-${amb.ambulance_id}`;
        el.innerHTML = markerInnerHtml;
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectObjectRef.current?.('ambulance', amb);
        };

        markersRef.current[key] = new maplibregl.Marker({ element: el })
          .setLngLat(markerLocation)
          .addTo(map);
      } else {
        markersRef.current[key].setLngLat(markerLocation);
        const el = markersRef.current[key].getElement();
        el.innerHTML = markerInnerHtml;
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectObjectRef.current?.('ambulance', amb);
        };
      }
    });

    // Incidents
    state.incidents.forEach((inc: Incident) => {
      if (inc.status === 'RESOLVED') return;
      const key = `inc-${inc.incident_id}`;
      currentMarkerKeys.add(key);

      const isSubmerged = inc.status === 'UNREACHABLE_FLOODED';
      const isPredicted = inc.status === 'PREDICTED_FLOOD_SUBMERGENCE';
      const isTrappedAmb = inc.status === 'AMBULANCE_TRAPPED';
      const isCritical = inc.severity === 'CRITICAL';

      const bgColor = isSubmerged ? 'bg-purple-900 ring-2 ring-cyan-400 border border-cyan-300' :
                      isPredicted ? 'bg-rose-900 ring-2 ring-amber-400 border border-amber-300' :
                      isTrappedAmb ? 'bg-red-950 ring-2 ring-red-500 border border-red-400' :
                      isCritical ? 'bg-red-600' :
                      inc.severity === 'HIGH' ? 'bg-orange-500' : 'bg-amber-500';

      const icon = inc.source === 'whatsapp' ? '📱' :
                   inc.source === 'telegram' ? '✈️' :
                   inc.source === 'citizen_portal' ? '🌐' :
                   isSubmerged ? '🚤' : isPredicted ? '⚠️' : isTrappedAmb ? '🆘' : '⚠️';

      const badgeText = inc.source ? `${inc.incident_id} • ${inc.source.toUpperCase()} SOS` :
                        isSubmerged ? `${inc.incident_id} • SUBMERGED (BOAT RESCUE)` :
                        isPredicted ? `${inc.incident_id} • FLOOD CUTOFF RISK` :
                        isTrappedAmb ? `${inc.incident_id} • AMB TRAPPED` :
                        inc.incident_id;

      const markerCoords = (inc as any).display_location || inc.coordinates;

      const incidentInnerHtml = `
        <div class="relative flex flex-col items-center group">
          <!-- Rich Hover Tooltip -->
          <div class="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-950/95 text-white p-2.5 rounded-xl shadow-2xl border border-slate-700/80 text-xs w-64 pointer-events-none z-50 backdrop-blur-md">
            <div class="flex items-center justify-between font-bold border-b border-slate-800 pb-1.5 mb-1.5">
              <span class="text-red-400 font-extrabold">${inc.incident_id}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-black ${isSubmerged ? 'bg-purple-600 text-white' : 'bg-red-900 text-red-200'}">
                ${inc.status.replace(/_/g, ' ')}
              </span>
            </div>

            ${inc.source ? `
            <div class="p-1.5 bg-emerald-950/80 border border-emerald-500/60 rounded-lg text-emerald-200 text-[10px] space-y-0.5 mb-1.5">
              <div class="flex justify-between items-center font-bold">
                <span>${inc.source === 'whatsapp' ? '📱 WhatsApp SOS' : inc.source === 'telegram' ? '✈️ Telegram SOS' : '🌐 Citizen Portal'}</span>
                <span class="text-white">${inc.sender_name || 'Citizen'}</span>
              </div>
              ${inc.phone ? `<div class="text-[9px] text-emerald-300 font-mono">📞 ${inc.phone}</div>` : ''}
              ${inc.caller_notes ? `<div class="italic text-[9px] text-slate-200 border-t border-emerald-800/60 pt-0.5 mt-0.5">"${inc.caller_notes}"</div>` : ''}
            </div>` : ''}

            <div class="space-y-1 text-[11px] text-slate-300">
              ${inc.unreachable_reason ? `
              <div class="p-1.5 bg-red-950/80 border border-red-500/60 rounded-lg text-red-200 font-semibold text-[10px] leading-tight">
                ${inc.unreachable_reason}
              </div>` : ''}
              <div class="flex justify-between items-center py-0.5">
                <span class="text-slate-400">Severity:</span>
                <span class="font-bold text-amber-300">${inc.severity} (${inc.patient_count} Patients)</span>
              </div>
              <div class="flex justify-between items-center py-0.5">
                <span class="text-slate-400">Assigned Unit:</span>
                <span class="font-bold text-sky-300">${inc.assigned_ambulance_id || (isSubmerged ? 'None (Ground Aborted)' : 'Dispatching...')}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 ${bgColor} text-white px-2.5 py-1 rounded-full shadow-lg font-bold text-xs ${isCritical || isSubmerged ? 'pulse-critical' : ''}">
            <span>${icon}</span>
            <span>${badgeText}</span>
            <span class="bg-black/25 text-[10px] px-1.5 py-0.2 rounded-full">${inc.patient_count}P</span>
          </div>
        </div>
      `;

      if (!markersRef.current[key]) {
        const el = document.createElement('div');
        el.className = 'cursor-pointer select-none';
        el.innerHTML = incidentInnerHtml;
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectObjectRef.current?.('incident', inc);
        };

        markersRef.current[key] = new maplibregl.Marker({ element: el })
          .setLngLat(markerCoords)
          .addTo(map);
      } else {
        markersRef.current[key].setLngLat(markerCoords);
        const el = markersRef.current[key].getElement();
        el.innerHTML = incidentInnerHtml;
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectObjectRef.current?.('incident', inc);
        };
      }
    });

    // Medical Camps
    state.medical_camps.forEach((camp: MedicalCamp) => {
      const key = `camp-${camp.camp_id}`;
      currentMarkerKeys.add(key);

      if (!markersRef.current[key]) {
        const el = document.createElement('div');
        el.className = 'cursor-pointer select-none';
        el.innerHTML = `
          <div class="flex items-center gap-1.5 bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-lg text-xs font-bold border border-emerald-400">
            <span>🏕️</span>
            <span>${camp.camp_id}</span>
            <span class="bg-emerald-800 text-[10px] px-1 rounded">${camp.capacity} beds</span>
          </div>
        `;
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectObjectRef.current?.('camp', camp);
        };

        markersRef.current[key] = new maplibregl.Marker({ element: el })
          .setLngLat(camp.coordinates)
          .addTo(map);
      } else {
        markersRef.current[key].setLngLat(camp.coordinates);
      }
    });

    // Remove obsolete markers
    Object.keys(markersRef.current).forEach((k) => {
      if (!currentMarkerKeys.has(k)) {
        markersRef.current[k].remove();
        delete markersRef.current[k];
      }
    });

    // If focused on an ambulance (e.g. Ambulance view), follow vehicle smoothly
    // Follow real device GPS if streaming, otherwise follow focused simulated ambulance
    if (realGpsCoords) {
      map.easeTo({
        center: realGpsCoords,
        zoom: 15.5,
        duration: 800,
      });
    } else if (focusAmbulanceId) {
      const targetAmb = state.ambulances.find((a) => a.ambulance_id === focusAmbulanceId);
      if (targetAmb) {
        map.easeTo({
          center: targetAmb.current_location,
          duration: 800,
        });
      }
    }
  }, [state, focusAmbulanceId, isCreateMode, realGpsCoords]);

  const toggle2D3D = () => {
    const map = mapRef.current;
    if (!map) return;
    if (is3D) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      setIs3D(false);
    } else {
      map.easeTo({ pitch: 58, bearing: -18, duration: 1000 });
      setIs3D(true);
    }
  };

  const resetCamera = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: PUNE_CENTER,
      zoom: 13.6,
      pitch: 58,
      bearing: -18,
      duration: 1200,
    });
    setIs3D(true);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Camera Controls Overlay */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-40 pointer-events-auto">
        {renderTopRightControls ? (
          renderTopRightControls({ is3D, toggle2D3D, resetCamera })
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={toggle2D3D}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow hover:bg-white transition-colors cursor-pointer"
              title="Toggle 2D / 3D Isometric View"
            >
              <Layers className="w-4 h-4 text-blue-600" />
              <span>{is3D ? '3D Isometric' : '2D Top-Down'}</span>
            </button>

            <button
              onClick={resetCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow hover:bg-white transition-colors cursor-pointer"
              title="Reset Camera View to Pune Center"
            >
              <Compass className="w-4 h-4 text-slate-600" />
              <span>Reset Camera</span>
            </button>
          </div>
        )}
      </div>

      {/* Creation Mode Banner if active */}
      {isCreateMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-white font-semibold text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span>📍</span>
          <span>Click anywhere on the 3D map to report an emergency incident</span>
        </div>
      )}
    </div>
  );
};