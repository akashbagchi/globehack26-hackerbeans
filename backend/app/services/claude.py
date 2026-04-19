import json
import logging
from typing import AsyncIterator, List
import anthropic
from fastapi import HTTPException
from app.config import settings
from app.models.driver import Driver
from app.models.ai import ChatMessage

logger = logging.getLogger(__name__)

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
MODEL = "claude-sonnet-4-6"


def _fleet_summary(drivers: List[Driver]) -> str:
    rows = []
    for d in drivers:
        load_info = f"en route {d.current_load.origin}→{d.current_load.destination}" if d.current_load else "no load"
        certs = ", ".join(sorted(set(d.certifications + d.endorsements))) or "standard"
        rows.append(
            f"- {d.name} ({d.driver_id}): {d.status}, {d.location.city} {d.location.state}, "
            f"HOS {d.hos.drive_remaining_hrs}h remain, fuel {d.vehicle.fuel_level_pct}%, "
            f"${d.economics.cost_per_mile}/mi, readiness {d.readiness.state} ({d.readiness.score}), "
            f"capacity {d.vehicle.capacity_lbs} lbs, certs [{certs}], {load_info}"
        )
    return "\n".join(rows)


async def get_dispatch_recommendations(
    drivers: List[Driver],
    pickup: str,
    destination: str,
    cargo: str,
    weight_lbs: int,
) -> dict:
    fleet_text = _fleet_summary(drivers)

    response = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": (
                    "You are Sauron, an AI dispatch intelligence for a commercial trucking fleet. "
                    "Analyze real-time driver data and make optimal assignment recommendations. "
                    "Always respond with valid JSON only. No prose outside the JSON structure."
                ),
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Current Fleet State:\n{fleet_text}",
                        "cache_control": {"type": "ephemeral"},
                    },
                    {
                        "type": "text",
                        "text": (
                            f"New load assignment needed:\n"
                            f"- Pickup: {pickup}\n"
                            f"- Destination: {destination}\n"
                            f"- Cargo: {cargo}, Weight: {weight_lbs} lbs\n\n"
                            "Rank the top 3 most suitable eligible drivers. "
                            "Consider: proximity to pickup, HOS remaining, cost per mile, readiness, and equipment fit. "
                            "Return JSON: "
                            '{"recommendations": [{"rank": 1, "driver_id": "...", "driver_name": "...", '
                            '"score": 94, "distance_to_pickup_miles": 45.0, "hos_remaining_hrs": 8.5, '
                            '"cost_per_mile": 1.87, "cost_delta_vs_avg": -0.12, '
                            '"reasoning": "One sentence why optimal."}], '
                            '"dispatch_note": "One sentence fleet observation."}'
                        ),
                    },
                ],
            }
        ],
    )

    try:
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        logger.error("Failed to parse dispatch recommendation response: %s", e)
        raise HTTPException(status_code=502, detail="AI service returned an unexpected response")


async def enrich_recommendations_with_ai(
    result: "DispatchRecommendation",
) -> "DispatchRecommendation":
    from app.models.ai import DispatchRecommendation

    if not result.recommendations:
        return result

    summary_lines = []
    for rec in result.recommendations:
        summary_lines.append(
            f"- Rank {rec.rank}: {rec.driver_name} ({rec.driver_id}), "
            f"score {rec.score}, {rec.distance_to_pickup_miles}mi deadhead, "
            f"HOS {rec.hos_remaining_hrs}h, ${rec.cost_per_mile}/mi "
            f"({rec.cost_delta_vs_avg:+.2f} vs avg). "
            f"Scoring notes: {rec.reasoning}"
        )
    summary = "\n".join(summary_lines)

    response = await client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=(
            "You are Sauron, an AI dispatch intelligence. You are given deterministic scoring results "
            "for driver-load matching. Rephrase each driver's scoring notes into a concise, natural-language "
            "sentence a dispatcher would find useful. Do not change ranks or scores. "
            "Return valid JSON only."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Scoring results:\n{summary}\n\n"
                    "Return JSON: {\"reasoning\": {\"<driver_id>\": \"One sentence.\", ...}}"
                ),
            }
        ],
    )

    try:
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw.strip())
        reasoning_map = data.get("reasoning", {})
    except (json.JSONDecodeError, IndexError, KeyError):
        logger.warning("AI enrichment failed, keeping deterministic reasoning")
        return result

    enriched = []
    for rec in result.recommendations:
        if rec.driver_id in reasoning_map:
            rec = rec.model_copy(update={"reasoning": reasoning_map[rec.driver_id]})
        enriched.append(rec)

    return DispatchRecommendation(
        recommendations=enriched,
        dispatch_note=result.dispatch_note,
    )


async def get_cost_insights(drivers: List[Driver]) -> dict:
    avg_cpm = sum(d.economics.cost_per_mile for d in drivers) / len(drivers)
    cost_rows = []
    for d in drivers:
        delta = d.economics.cost_per_mile - avg_cpm
        cost_rows.append(
            f"- {d.name}: ${d.economics.cost_per_mile}/mi ({'+' if delta >= 0 else ''}{delta:.2f} vs avg), "
            f"{d.economics.miles_today} miles today, idle cost ${d.economics.idle_cost_today}"
        )
    cost_text = "\n".join(cost_rows)
    fleet_avg_text = f"Fleet average: ${avg_cpm:.2f}/mile"

    chart_data = sorted(
        [
            {
                "name": d.name.split()[0],
                "full_name": d.name,
                "driver_id": d.driver_id,
                "cost_per_mile": d.economics.cost_per_mile,
                "miles_today": d.economics.miles_today,
            }
            for d in drivers
        ],
        key=lambda x: x["cost_per_mile"],
    )

    response = await client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=[
            {
                "type": "text",
                "text": (
                    "You are Sauron fleet intelligence. Analyze cost data and identify actionable insights. "
                    "Return exactly 3 insight objects in JSON. Each insight must be specific with real names and numbers."
                ),
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Fleet cost data today:\n{cost_text}\n{fleet_avg_text}",
                        "cache_control": {"type": "ephemeral"},
                    },
                    {
                        "type": "text",
                        "text": (
                            "Generate 3 cost intelligence insights with specific driver names and numbers. "
                            'Return JSON: {"insights": [{"icon": "trending_up|alert_triangle|zap|dollar_sign", '
                            '"title": "Short bold title", "detail": "One specific sentence with names/numbers.", '
                            '"severity": "info|warning|critical"}]}'
                        ),
                    },
                ],
            }
        ],
    )

    try:
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
        insights_data = json.loads(raw.strip())
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        logger.error("Failed to parse cost insights response: %s", e)
        raise HTTPException(status_code=502, detail="AI service returned an unexpected response")

    return {"chart_data": chart_data, "insights": insights_data.get("insights", [])}


async def get_simulation_narrator(
    driver_name: str,
    current_city: str,
    pickup: str,
    destination: str,
    estimated_hours: float,
    total_cost: float,
    cost_per_mile: float,
    miles: float,
    hos_remaining_after: float,
) -> str:
    response = await client.messages.create(
        model=MODEL,
        max_tokens=150,
        system=(
            "You are Sauron simulation narrator. Generate exactly one confident sentence describing "
            "the outcome of a simulated truck assignment. Include cost impact, ETA, and one operational note. "
            "No hedging language. Be specific and direct."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Driver: {driver_name}, currently in {current_city}\n"
                    f"Assignment: {pickup} → {destination}\n"
                    f"Drive time: {estimated_hours:.1f}h, Miles: {miles:.0f}, "
                    f"Cost: ${total_cost:.0f} (${cost_per_mile}/mi)\n"
                    f"HOS after completion: {hos_remaining_after:.1f}h remaining\n"
                    "Generate one sentence simulation outcome."
                ),
            }
        ],
    )
    return response.content[0].text.strip()


async def stream_chat(
    messages: List[ChatMessage],
    drivers: List[Driver],
) -> AsyncIterator[str]:
    fleet_text = _fleet_summary(drivers)
    from datetime import datetime, timezone
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    anthropic_messages = []
    for msg in messages:
        if msg.role == "user":
            anthropic_messages.append({"role": "user", "content": msg.content})
        else:
            anthropic_messages.append({"role": "assistant", "content": msg.content})

    if anthropic_messages and anthropic_messages[0]["role"] == "user":
        anthropic_messages[0] = {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": f"Live Fleet Snapshot (as of {timestamp}):\n{fleet_text}",
                    "cache_control": {"type": "ephemeral"},
                },
                {"type": "text", "text": anthropic_messages[0]["content"]},
            ],
        }

    async with client.messages.stream(
        model=MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": (
                    "You are Sauron, the AI brain of a real-time fleet management system. "
                    "You have full situational awareness of all drivers: location, HOS, fuel, current loads. "
                    "Answer dispatcher questions with precision. Use markdown: **bold driver names**, "
                    "bullet lists for rankings. Be concise — dispatchers are busy."
                ),
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=anthropic_messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
