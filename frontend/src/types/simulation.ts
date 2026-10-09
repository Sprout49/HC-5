export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RoadStatus = 'OPEN' | 'RESTRICTED' | 'HIGH_RISK' | 'BLOCKED';
export type AmbulanceStatus = 
  | 'AVAILABLE' 
  | 'CALL_RECEIVED' 
  | 'ACCEPTED' 
  | 'EN_ROUTE_TO_PATIENT' 
  | 'AT_PATIENT' 
  | 'PATIENT_PICKED_UP' 
  | 'EN_ROUTE_TO_HOSPITAL' 
  | 'AT_HOSPITAL' 
  | 'COMPLETED' 
  | 'BLOCKED_NO_ROUTE'
  | 'TRAPPED_IN_FLOOD'
  | 'RELOCATING_TO_SAFETY'
  | 'BLOCKED_NO_HOSPITAL';

export interface Zone {
  zone_id: string;
  name: string;
  population: number;
  area_km2: number;
  elevation_base_m: number;
  river_proximity_m: number;
  vulnerability_score: number;
  medical_coverage_score: number;
  risk_level: SeverityLevel;
  risk_score: number;
  predicted_demand: number;
  coordinates: number[][][];
}

export interface Road {
  road_id: string;
  name: string;
  from_node: string;
  to_node: string;
  road_class: string;
  elevation_m: number;
  speed_limit_kmh: number;
  length_m: number;
  flood_depth: number;
  flooded_portion_pct: number;
  status: RoadStatus;
  reason: string;
  coordinates: number[][];
}

export interface Hospital {
  hospital_id: string;
  name: string;
  zone_id: string;
  type: string;
  total_beds: number;
  available_beds: number;
  total_icu: number;
  available_icu: number;
  has_trauma_center: boolean;
  specialties: string[];
  elevation_m: number;
  capacity_utilization: number;
  status: string;
  coordinates: [number, number];
}

export interface RouteInfo {
  route_coordinates: number[][];
  path_nodes: string[];
  road_ids: string[];
  distance_km: number;
  duration_min: number;
  risk_rating: 'LOW' | 'MODERATE' | 'HIGH';
  contains_restricted: boolean;
  explanation: string;
}

export interface Ambulance {
  ambulance_id: string;
  callsign: string;
  type: 'ALS' | 'BLS' | 'CC';
  status: AmbulanceStatus;
  assigned_zone: string;
  current_location: [number, number];
  target_location: [number, number] | null;
  current_incident_id: string | null;
  target_hospital_id?: string | null;
  target_hospital_name?: string | null;
  active_route: RouteInfo | null;
  previous_route: RouteInfo | null;
  hospital_route?: RouteInfo | null;
  route_progress: number;
  speed_kmh: number;
  eta_minutes: number;
  patients_onboard?: number;
  patient_capacity?: number;
  is_trapped?: boolean;
  safe_staging_name?: string;
  diverted_hospital?: boolean;
  password?: string;
}

export interface Incident {
  incident_id: string;
  coordinates: [number, number];
  zone_id: string;
  severity: SeverityLevel;
  patient_count: number;
  status: 'PENDING_DISPATCH' | 'DISPATCHED' | 'PICKED_UP' | 'RESOLVED' | 'UNREACHABLE_FLOODED' | 'PREDICTED_FLOOD_SUBMERGENCE' | 'AMBULANCE_TRAPPED';
  created_time: number;
  assigned_ambulance_id: string | null;
  target_hospital_id: string | null;
  is_unreachable?: boolean;
  unreachable_reason?: string;
  flood_risk_warning?: string;
}

export interface MedicalCamp {
  camp_id: string;
  zone_id: string;
  zone_name: string;
  coordinates: [number, number];
  capacity: number;
  available_beds: number;
  status: string;
  type: string;
}

export interface Recommendation {
  recommendation_id: string;
  type: string;
  zone_id: string;
  zone_name: string;
  coordinates: [number, number];
  capacity: number;
  reason: string;
  action_label: string;
}

export interface SimEvent {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'critical';
}

export interface NetworkStats {
  open_roads: number;
  restricted_roads: number;
  high_risk_roads: number;
  blocked_roads: number;
  total_demand: number;
}

export interface SimulationState {
  simulation_time_str: string;
  simulation_time_minutes: number;
  is_running: boolean;
  sim_speed: number;
  scenario_name: string;
  water_rise_m: number;
  flood_polygon?: any;
  network_stats: NetworkStats;
  zones: Zone[];
  roads: Road[];
  hospitals: Hospital[];
  ambulances: Ambulance[];
  incidents: Incident[];
  medical_camps: MedicalCamp[];
  recommendations: Recommendation[];
  events: SimEvent[];
}
