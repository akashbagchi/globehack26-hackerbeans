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
    capacity_lbs: int
    cab_type: str
    trailer_type: str
    trailer_length_ft: int
    refrigerated: bool
    maintenance_ready: bool
    hazmat_permitted: bool


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


class ContractConstraintsData(BaseModel):
    max_deadhead_miles: int
    preferred_regions: list[str]
    excluded_cargo_types: list[str]


class AvailabilityWindowData(BaseModel):
    available_from: str
    available_until: str


class ReadinessData(BaseModel):
    state: str
    score: int
    blocker_reasons: list[str]
    available_at: Optional[str] = None


class Driver(BaseModel):
    driver_id: str
    name: str
    truck_number: str
    status: str  # driving | idle | off_duty
    location: LocationData
    hos: HOSData
    vehicle: VehicleData
    economics: EconomicsData
    certifications: list[str]
    endorsements: list[str]
    contract_constraints: ContractConstraintsData
    availability_window: AvailabilityWindowData
    readiness: ReadinessData
    current_load: Optional[LoadData] = None
