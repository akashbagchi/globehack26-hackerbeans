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
