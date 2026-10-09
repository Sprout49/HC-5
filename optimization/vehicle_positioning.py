"""
Fleet Initial Staging Optimization using Google OR-Tools.
Determines optimal zone staging assignments for ambulances based on:
- Predicted emergency demand
- Zone risk level
- Population density
- Hospital coverage
"""

from typing import List, Dict, Any
from ortools.linear_solver import pywraplp

def optimize_ambulance_staging(ambulances: List[Dict[str, Any]], zones: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Assigns each available ambulance to a target zone to maximize coverage of high-demand/high-risk zones.
    Returns mapping: {ambulance_id: target_zone_id}
    """
    solver = pywraplp.Solver.CreateSolver('SCIP')
    if not solver:
        # Fallback greedy assignment
        sorted_zones = sorted(zones, key=lambda z: z.get("predicted_demand", 0) * (z.get("risk_score", 0.5) + 0.5), reverse=True)
        assignment = {}
        for idx, amb in enumerate(ambulances):
            zone = sorted_zones[idx % len(sorted_zones)]
            assignment[amb["ambulance_id"]] = zone["zone_id"]
        return assignment

    num_amb = len(ambulances)
    num_zones = len(zones)

    # Decision variables: x[i, j] = 1 if ambulance i is assigned to zone j
    x = {}
    for i in range(num_amb):
        for j in range(num_zones):
            x[i, j] = solver.BoolVar(f'x_{i}_{j}')

    # Constraint 1: Each ambulance assigned to exactly 1 zone
    for i in range(num_amb):
        solver.Add(solver.Sum([x[i, j] for j in range(num_zones)]) == 1)

    # Constraint 2: No zone gets more than max_per_zone (ensure 1 ambulance per zone for balanced geographic coverage)
    max_per_zone = 1 if num_amb <= num_zones else (num_amb // num_zones + 1)
    for j in range(num_zones):
        solver.Add(solver.Sum([x[i, j] for i in range(num_amb)]) <= max_per_zone)

    # Objective: Maximize priority score coverage
    objective = solver.Objective()
    for i in range(num_amb):
        for j in range(num_zones):
            z = zones[j]
            # Priority weight: demand * (1 + risk_score)
            demand = float(z.get("predicted_demand", 10))
            risk = float(z.get("risk_score", 0.2))
            weight = demand * (1.0 + risk * 2.0)
            objective.SetCoefficient(x[i, j], weight)

    objective.SetMaximization()
    status = solver.Solve()

    assignment = {}
    if status == pywraplp.Solver.OPTIMAL or status == pywraplp.Solver.FEASIBLE:
        for i in range(num_amb):
            for j in range(num_zones):
                if x[i, j].solution_value() > 0.5:
                    assignment[ambulances[i]["ambulance_id"]] = zones[j]["zone_id"]
                    break
    else:
        # Fallback
        for idx, amb in enumerate(ambulances):
            assignment[amb["ambulance_id"]] = zones[idx % num_zones]["zone_id"]

    return assignment
