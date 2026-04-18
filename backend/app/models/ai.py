from pydantic import BaseModel
from typing import List, Optional


class DriverRecommendation(BaseModel):
    rank: int
    driver_id: str
    driver_name: str
    score: int
    distance_to_pickup_miles: float
    hos_remaining_hrs: float
    cost_per_mile: float
    cost_delta_vs_avg: float
    reasoning: str


class DispatchRecommendation(BaseModel):
    recommendations: List[DriverRecommendation]
    dispatch_note: str


class InsightCard(BaseModel):
    icon: str  # trending_up | alert_triangle | zap | dollar_sign
    title: str
    detail: str
    severity: str  # info | warning | critical


class CostInsights(BaseModel):
    chart_data: List[dict]
    insights: List[InsightCard]


class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
