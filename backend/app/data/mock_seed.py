from datetime import datetime, timezone

_now = "2026-04-18T12:00:00Z"

MOCK_DRIVERS = [
    {
        "driver_id": "DRV001",
        "name": "Marcus Webb",
        "truck_number": "T-441",
        "status": "driving",
        "location": {
            "lat": 41.8781, "lng": -87.6298,
            "city": "Chicago", "state": "IL",
            "heading": 225, "speed_mph": 62,
        },
        "hos": {
            "drive_remaining_hrs": 7.5,
            "shift_remaining_hrs": 9.0,
            "cycle_remaining_hrs": 52.0,
            "last_rest_end": "2026-04-18T06:00:00Z",
        },
        "vehicle": {
            "vehicle_id": "VEH001", "make": "Freightliner", "model": "Cascadia",
            "year": 2022, "fuel_level_pct": 68, "odometer_miles": 142300, "mpg_avg": 7.2,
        },
        "economics": {
            "cost_per_mile": 1.87, "miles_today": 312,
            "revenue_today": 1540.00, "idle_cost_today": 28.50,
        },
        "current_load": {
            "load_id": "LD-8821", "origin": "Gary, IN",
            "destination": "St. Louis, MO", "cargo": "Auto Parts",
            "weight_lbs": 28000, "eta": "2026-04-18T18:30:00Z",
        },
    },
    {
        "driver_id": "DRV002",
        "name": "Sofia Reyes",
        "truck_number": "T-217",
        "status": "driving",
        "location": {
            "lat": 32.7767, "lng": -96.7970,
            "city": "Dallas", "state": "TX",
            "heading": 90, "speed_mph": 71,
        },
        "hos": {
            "drive_remaining_hrs": 5.0,
            "shift_remaining_hrs": 6.5,
            "cycle_remaining_hrs": 38.0,
            "last_rest_end": "2026-04-18T04:00:00Z",
        },
        "vehicle": {
            "vehicle_id": "VEH002", "make": "Kenworth", "model": "T680",
            "year": 2023, "fuel_level_pct": 45, "odometer_miles": 98500, "mpg_avg": 7.8,
        },
        "economics": {
            "cost_per_mile": 1.72, "miles_today": 410,
            "revenue_today": 2050.00, "idle_cost_today": 12.00,
        },
        "current_load": {
            "load_id": "LD-9012", "origin": "Fort Worth, TX",
            "destination": "Houston, TX", "cargo": "Electronics",
            "weight_lbs": 18000, "eta": "2026-04-18T15:45:00Z",
        },
    },
    {
        "driver_id": "DRV003",
        "name": "Jake Thornton",
        "truck_number": "T-389",
        "status": "idle",
        "location": {
            "lat": 39.7392, "lng": -104.9903,
            "city": "Denver", "state": "CO",
            "heading": 0, "speed_mph": 0,
        },
        "hos": {
            "drive_remaining_hrs": 10.0,
            "shift_remaining_hrs": 12.0,
            "cycle_remaining_hrs": 65.0,
            "last_rest_end": "2026-04-18T08:00:00Z",
        },
        "vehicle": {
            "vehicle_id": "VEH003", "make": "Peterbilt", "model": "579",
            "year": 2021, "fuel_level_pct": 92, "odometer_miles": 210000, "mpg_avg": 6.9,
        },
        "economics": {
            "cost_per_mile": 2.05, "miles_today": 0,
            "revenue_today": 0.00, "idle_cost_today": 54.00,
        },
        "current_load": None,
    },
    {
        "driver_id": "DRV004",
        "name": "Aaliyah Brooks",
        "truck_number": "T-502",
        "status": "driving",
        "location": {
            "lat": 33.7490, "lng": -84.3880,
            "city": "Atlanta", "state": "GA",
            "heading": 45, "speed_mph": 65,
        },
        "hos": {
            "drive_remaining_hrs": 3.0,
            "shift_remaining_hrs": 4.0,
            "cycle_remaining_hrs": 28.0,
            "last_rest_end": "2026-04-18T02:00:00Z",
        },
        "vehicle": {
            "vehicle_id": "VEH004", "make": "Volvo", "model": "VNL 860",
            "year": 2023, "fuel_level_pct": 31, "odometer_miles": 67800, "mpg_avg": 8.1,
        },
        "economics": {
            "cost_per_mile": 1.95, "miles_today": 520,
            "revenue_today": 2600.00, "idle_cost_today": 8.00,
        },
        "current_load": {
            "load_id": "LD-7733", "origin": "Charlotte, NC",
            "destination": "Miami, FL", "cargo": "Produce",
            "weight_lbs": 42000, "eta": "2026-04-19T06:00:00Z",
        },
    },
    {
        "driver_id": "DRV005",
        "name": "Dmitri Volkov",
        "truck_number": "T-118",
        "status": "idle",
        "location": {
            "lat": 47.6062, "lng": -122.3321,
            "city": "Seattle", "state": "WA",
            "heading": 0, "speed_mph": 0,
        },
        "hos": {
            "drive_remaining_hrs": 9.0,
            "shift_remaining_hrs": 11.0,
            "cycle_remaining_hrs": 60.0,
            "last_rest_end": "2026-04-18T07:30:00Z",
        },
        "vehicle": {
            "vehicle_id": "VEH005", "make": "Mack", "model": "Anthem",
            "year": 2020, "fuel_level_pct": 78, "odometer_miles": 185000, "mpg_avg": 6.5,
        },
        "economics": {
            "cost_per_mile": 2.12, "miles_today": 0,
            "revenue_today": 0.00, "idle_cost_today": 48.00,
        },
        "current_load": None,
    },
    {
        "driver_id": "DRV006",
        "name": "Carmen Ibáñez",
        "truck_number": "T-634",
        "status": "driving",
        "location": {
            "lat": 33.4484, "lng": -112.0740,
            "city": "Phoenix", "state": "AZ",
            "heading": 270, "speed_mph": 68,
        },
        "hos": {
            "drive_remaining_hrs": 6.5,
            "shift_remaining_hrs": 8.0,
            "cycle_remaining_hrs": 45.0,
            "last_rest_end": "2026-04-18T05:00:00Z",
        },
        "vehicle": {
            "vehicle_id": "VEH006", "make": "Freightliner", "model": "Cascadia",
            "year": 2022, "fuel_level_pct": 55, "odometer_miles": 124000, "mpg_avg": 7.4,
        },
        "economics": {
            "cost_per_mile": 1.65, "miles_today": 285,
            "revenue_today": 1425.00, "idle_cost_today": 15.00,
        },
        "current_load": {
            "load_id": "LD-6614", "origin": "Tucson, AZ",
            "destination": "Los Angeles, CA", "cargo": "Manufactured Goods",
            "weight_lbs": 35000, "eta": "2026-04-18T20:00:00Z",
        },
    },
    {
        "driver_id": "DRV007",
        "name": "Tyrese Coleman",
        "truck_number": "T-775",
        "status": "off_duty",
        "location": {
            "lat": 36.1627, "lng": -86.7816,
            "city": "Nashville", "state": "TN",
            "heading": 0, "speed_mph": 0,
        },
        "hos": {
            "drive_remaining_hrs": 1.5,
            "shift_remaining_hrs": 1.5,
            "cycle_remaining_hrs": 12.0,
            "last_rest_end": "2026-04-17T22:00:00Z",
        },
        "vehicle": {
            "vehicle_id": "VEH007", "make": "Kenworth", "model": "W900",
            "year": 2019, "fuel_level_pct": 20, "odometer_miles": 342000, "mpg_avg": 6.2,
        },
        "economics": {
            "cost_per_mile": 2.34, "miles_today": 125,
            "revenue_today": 875.00, "idle_cost_today": 62.00,
        },
        "current_load": None,
    },
    {
        "driver_id": "DRV008",
        "name": "Priya Nair",
        "truck_number": "T-290",
        "status": "driving",
        "location": {
            "lat": 39.9612, "lng": -82.9988,
            "city": "Columbus", "state": "OH",
            "heading": 90, "speed_mph": 58,
        },
        "hos": {
            "drive_remaining_hrs": 8.0,
            "shift_remaining_hrs": 10.0,
            "cycle_remaining_hrs": 55.0,
            "last_rest_end": "2026-04-18T05:30:00Z",
        },
        "vehicle": {
            "vehicle_id": "VEH008", "make": "Volvo", "model": "VNL 760",
            "year": 2022, "fuel_level_pct": 83, "odometer_miles": 89000, "mpg_avg": 7.9,
        },
        "economics": {
            "cost_per_mile": 1.78, "miles_today": 198,
            "revenue_today": 990.00, "idle_cost_today": 10.00,
        },
        "current_load": {
            "load_id": "LD-5501", "origin": "Cleveland, OH",
            "destination": "Pittsburgh, PA", "cargo": "Steel Coils",
            "weight_lbs": 44000, "eta": "2026-04-18T16:00:00Z",
        },
    },
]

PROFILE_ENRICHMENTS = {
    "DRV001": {
        "certifications": ["cdl_class_a", "auto_parts"],
        "endorsements": ["doubles_triples"],
        "contract_constraints": {
            "max_deadhead_miles": 420,
            "preferred_regions": ["Midwest", "Great Lakes"],
            "excluded_cargo_types": ["explosives"],
        },
        "availability_window": {
            "available_from": "2026-04-18T06:00:00Z",
            "available_until": "2026-04-18T20:00:00Z",
        },
        "readiness": {
            "state": "assigned",
            "score": 58,
            "blocker_reasons": ["Currently handling LD-8821"],
            "available_at": "2026-04-18T18:30:00Z",
        },
        "vehicle": {
            "capacity_lbs": 46000,
            "cab_type": "sleeper",
            "trailer_type": "dry_van",
            "trailer_length_ft": 53,
            "refrigerated": False,
            "maintenance_ready": True,
            "hazmat_permitted": False,
        },
    },
    "DRV002": {
        "certifications": ["cdl_class_a", "twic", "electronics_secure"],
        "endorsements": ["tanker"],
        "contract_constraints": {
            "max_deadhead_miles": 350,
            "preferred_regions": ["Texas Triangle", "South"],
            "excluded_cargo_types": ["explosives"],
        },
        "availability_window": {
            "available_from": "2026-04-18T04:00:00Z",
            "available_until": "2026-04-18T17:00:00Z",
        },
        "readiness": {
            "state": "assigned",
            "score": 61,
            "blocker_reasons": ["Active linehaul assignment"],
            "available_at": "2026-04-18T15:45:00Z",
        },
        "vehicle": {
            "capacity_lbs": 44000,
            "cab_type": "sleeper",
            "trailer_type": "dry_van",
            "trailer_length_ft": 53,
            "refrigerated": False,
            "maintenance_ready": True,
            "hazmat_permitted": False,
        },
    },
    "DRV003": {
        "certifications": ["cdl_class_a", "hazmat", "twic", "military"],
        "endorsements": ["hazmat", "tanker"],
        "contract_constraints": {
            "max_deadhead_miles": 500,
            "preferred_regions": ["Mountain West", "Plains"],
            "excluded_cargo_types": [],
        },
        "availability_window": {
            "available_from": "2026-04-18T08:00:00Z",
            "available_until": "2026-04-18T22:00:00Z",
        },
        "readiness": {
            "state": "ready",
            "score": 95,
            "blocker_reasons": [],
            "available_at": "2026-04-18T08:00:00Z",
        },
        "vehicle": {
            "capacity_lbs": 48000,
            "cab_type": "day_cab",
            "trailer_type": "flatbed",
            "trailer_length_ft": 48,
            "refrigerated": False,
            "maintenance_ready": True,
            "hazmat_permitted": True,
        },
    },
    "DRV004": {
        "certifications": ["cdl_class_a", "refrigerated", "perishable_handling"],
        "endorsements": ["refrigerated"],
        "contract_constraints": {
            "max_deadhead_miles": 250,
            "preferred_regions": ["Southeast"],
            "excluded_cargo_types": ["explosives"],
        },
        "availability_window": {
            "available_from": "2026-04-18T02:00:00Z",
            "available_until": "2026-04-19T08:00:00Z",
        },
        "readiness": {
            "state": "at_risk",
            "score": 46,
            "blocker_reasons": ["Low HOS margin", "Assigned refrigerated produce load"],
            "available_at": "2026-04-19T06:00:00Z",
        },
        "vehicle": {
            "capacity_lbs": 45000,
            "cab_type": "sleeper",
            "trailer_type": "reefer",
            "trailer_length_ft": 53,
            "refrigerated": True,
            "maintenance_ready": True,
            "hazmat_permitted": False,
        },
    },
    "DRV005": {
        "certifications": ["cdl_class_a", "refrigerated", "perishable_handling"],
        "endorsements": ["refrigerated"],
        "contract_constraints": {
            "max_deadhead_miles": 525,
            "preferred_regions": ["Pacific Northwest", "West Coast"],
            "excluded_cargo_types": ["explosives", "military"],
        },
        "availability_window": {
            "available_from": "2026-04-18T07:30:00Z",
            "available_until": "2026-04-18T23:00:00Z",
        },
        "readiness": {
            "state": "ready",
            "score": 91,
            "blocker_reasons": [],
            "available_at": "2026-04-18T07:30:00Z",
        },
        "vehicle": {
            "capacity_lbs": 43000,
            "cab_type": "sleeper",
            "trailer_type": "reefer",
            "trailer_length_ft": 53,
            "refrigerated": True,
            "maintenance_ready": True,
            "hazmat_permitted": False,
        },
    },
    "DRV006": {
        "certifications": ["cdl_class_a", "hazmat"],
        "endorsements": ["hazmat"],
        "contract_constraints": {
            "max_deadhead_miles": 300,
            "preferred_regions": ["Southwest"],
            "excluded_cargo_types": ["military"],
        },
        "availability_window": {
            "available_from": "2026-04-18T05:00:00Z",
            "available_until": "2026-04-18T21:00:00Z",
        },
        "readiness": {
            "state": "assigned",
            "score": 64,
            "blocker_reasons": ["Current westbound delivery in progress"],
            "available_at": "2026-04-18T20:00:00Z",
        },
        "vehicle": {
            "capacity_lbs": 47000,
            "cab_type": "sleeper",
            "trailer_type": "dry_van",
            "trailer_length_ft": 53,
            "refrigerated": False,
            "maintenance_ready": True,
            "hazmat_permitted": True,
        },
    },
    "DRV007": {
        "certifications": ["cdl_class_a", "military"],
        "endorsements": ["passenger"],
        "contract_constraints": {
            "max_deadhead_miles": 220,
            "preferred_regions": ["Mid-South"],
            "excluded_cargo_types": ["perishable", "refrigerated"],
        },
        "availability_window": {
            "available_from": "2026-04-18T12:00:00Z",
            "available_until": "2026-04-18T23:30:00Z",
        },
        "readiness": {
            "state": "blocked",
            "score": 22,
            "blocker_reasons": ["Off duty reset in progress", "Truck maintenance hold"],
            "available_at": "2026-04-18T12:00:00Z",
        },
        "vehicle": {
            "capacity_lbs": 42000,
            "cab_type": "day_cab",
            "trailer_type": "dry_van",
            "trailer_length_ft": 48,
            "refrigerated": False,
            "maintenance_ready": False,
            "hazmat_permitted": False,
        },
    },
    "DRV008": {
        "certifications": ["cdl_class_a", "twic", "heavy_haul"],
        "endorsements": ["tanker"],
        "contract_constraints": {
            "max_deadhead_miles": 360,
            "preferred_regions": ["Ohio Valley", "Northeast"],
            "excluded_cargo_types": [],
        },
        "availability_window": {
            "available_from": "2026-04-18T05:30:00Z",
            "available_until": "2026-04-18T18:30:00Z",
        },
        "readiness": {
            "state": "assigned",
            "score": 63,
            "blocker_reasons": ["In-transit steel consignment"],
            "available_at": "2026-04-18T16:00:00Z",
        },
        "vehicle": {
            "capacity_lbs": 52000,
            "cab_type": "sleeper",
            "trailer_type": "flatbed",
            "trailer_length_ft": 53,
            "refrigerated": False,
            "maintenance_ready": True,
            "hazmat_permitted": False,
        },
    },
}

for driver in MOCK_DRIVERS:
    enrichment = PROFILE_ENRICHMENTS[driver["driver_id"]]
    driver.update({key: value for key, value in enrichment.items() if key != "vehicle"})
    driver["vehicle"] = {**driver["vehicle"], **enrichment["vehicle"]}
