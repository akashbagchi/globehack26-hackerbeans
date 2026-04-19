from pydantic import BaseModel
from typing import Optional


class LocationData(BaseModel):
    lat: float
    lng: float
    city: str
    state: str
    heading: int
    speed_mph: float


class HOSData(BaseModel):
    drive_remaining_hrs: float
    shift_remaining_hrs: float
    cycle_remaining_hrs: float
    last_rest_end: str


class VehicleData(BaseModel):
    vehicle_id: str
    make: str
    model: str
    year: int
    fuel_level_pct: int
    odometer_miles: int
    mpg_avg: float


class EconomicsData(BaseModel):
    cost_per_mile: float
    miles_today: int
    revenue_today: float
    idle_cost_today: float


class LoadData(BaseModel):
    load_id: str
    origin: str
    destination: str
    cargo: str
    weight_lbs: int
    eta: str


class Driver(BaseModel):
    driver_id: str
    name: str
    truck_number: str
    status: str  # driving | idle | off_duty
    location: LocationData
    hos: HOSData
    vehicle: VehicleData
    economics: EconomicsData
    current_load: Optional[LoadData] = None
