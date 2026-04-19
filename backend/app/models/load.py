from pydantic import BaseModel, Field
from typing import Optional


class LoadRequest(BaseModel):
    pickup: str = Field(..., min_length=1, max_length=100)
    destination: str = Field(..., min_length=1, max_length=100)
    cargo: str = Field(..., min_length=1, max_length=200)
    weight_lbs: int = Field(..., gt=0, lt=150_000)


class Coordinate(BaseModel):
    lat: float
    lng: float


class RouteGeoJSON(BaseModel):
    type: str = "Feature"
    geometry: dict
    properties: dict


class SimulationRequest(BaseModel):
    driver_id: str
    pickup: str
    destination: str
    pickup_coords: Optional[Coordinate] = None
    destination_coords: Optional[Coordinate] = None


class SimulationResult(BaseModel):
    driver_id: str
    driver_name: str
    route: RouteGeoJSON
    estimated_miles: float
    estimated_hours: float
    total_cost: float
    cost_per_mile: float
    narrator_text: str
    hos_remaining_after: float
