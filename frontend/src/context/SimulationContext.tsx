import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { SimulationState, SeverityLevel } from '../types/simulation';

interface SimulationContextType {
  state: SimulationState | null;
  connected: boolean;
  startSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  stepSimulation: () => Promise<void>;
  resetSimulation: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setScenario: (scenario: string) => Promise<void>;
  loadDemoScenario: () => Promise<void>;
  positionFleet: () => Promise<void>;
  createIncident: (lon: number, lat: number, severity: SeverityLevel, patientCount: number) => Promise<void>;
  acceptCall: (ambulanceId: string) => Promise<void>;
  pickupPatient: (ambulanceId: string) => Promise<void>;
  startHospitalRoute: (ambulanceId: string) => Promise<void>;
  deployMedicalCamp: (zoneId: string) => Promise<void>;
}

const SimulationContext = createContext<SimulationContextType | null>(null);

const API_BASE = 'http://127.0.0.1:8000/api';
const WS_URL = 'ws://127.0.0.1:8000/ws/simulation';

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SimulationState | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connectWs = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setState(data);
        } catch (err) {
          console.error('Error parsing simulation WS state:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
    }
  }, []);

  useEffect(() => {
    // Initial fetch of simulation state
    fetch(`${API_BASE}/simulation/state`)
      .then((res) => res.json())
      .then((data) => setState(data))
      .catch((err) => console.warn('Could not fetch initial state via REST:', err));

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWs]);

  const startSimulation = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/start`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data) setState(data);
      }
    } catch (err) {
      console.error('Failed to start simulation:', err);
    }
  };

  const pauseSimulation = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/pause`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data) setState(data);
      }
    } catch (err) {
      console.error('Failed to pause simulation:', err);
    }
  };

  const stepSimulation = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/step`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data) setState(data);
      }
    } catch (err) {
      console.error('Failed to step simulation:', err);
    }
  };

  const resetSimulation = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/reset`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data) setState(data);
      }
    } catch (err) {
      console.error('Failed to reset simulation:', err);
    }
  };

  const setSpeed = async (speed: number) => {
    try {
      const res = await fetch(`${API_BASE}/simulation/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data) setState(data);
      }
    } catch (err) {
      console.error('Failed to set simulation speed:', err);
    }
  };

  const setScenario = async (scenario: string) => {
    try {
      const res = await fetch(`${API_BASE}/simulation/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data) setState(data);
      }
    } catch (err) {
      console.error('Failed to set scenario:', err);
    }
  };

  const loadDemoScenario = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/load_demo`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data) setState(data);
      } else {
        const errText = await res.text();
        console.error('Failed to load demo scenario:', errText);
      }
    } catch (err) {
      console.error('Failed to load demo scenario:', err);
    }
  };

  const positionFleet = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/position_fleet`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data) setState(data);
      }
    } catch (err) {
      console.error('Failed to position fleet:', err);
    }
  };

  const createIncident = async (lon: number, lat: number, severity: SeverityLevel, patientCount: number) => {
    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lon, lat, severity, patient_count: patientCount }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setState(data.state);
        } else {
          const sRes = await fetch(`${API_BASE}/simulation/state`);
          if (sRes.ok) setState(await sRes.json());
        }
      } else {
        console.error('Failed to create incident:', await res.text());
      }
    } catch (err) {
      console.error('Failed to create incident:', err);
    }
  };

  const acceptCall = async (ambulanceId: string) => {
    try {
      const res = await fetch(`${API_BASE}/ambulance/${ambulanceId}/accept`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
    }
  };

  const pickupPatient = async (ambulanceId: string) => {
    try {
      const res = await fetch(`${API_BASE}/ambulance/${ambulanceId}/pickup`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch (err) {
      console.error('Failed to pickup patient:', err);
    }
  };

  const startHospitalRoute = async (ambulanceId: string) => {
    try {
      const res = await fetch(`${API_BASE}/ambulance/${ambulanceId}/start_hospital_route`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch (err) {
      console.error('Failed to start hospital route:', err);
    }
  };

  const deployMedicalCamp = async (zoneId: string) => {
    try {
      const res = await fetch(`${API_BASE}/resources/deploy_camp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch (err) {
      console.error('Failed to deploy medical camp:', err);
    }
  };

  return (
    <SimulationContext.Provider
      value={{
        state,
        connected,
        startSimulation,
        pauseSimulation,
        stepSimulation,
        resetSimulation,
        setSpeed,
        setScenario,
        loadDemoScenario,
        positionFleet,
        createIncident,
        acceptCall,
        pickupPatient,
        startHospitalRoute,
        deployMedicalCamp,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};
