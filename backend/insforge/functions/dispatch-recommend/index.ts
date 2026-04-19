import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function fleetSummary(drivers: any[]): string {
  return drivers.map(d => {
    const loadInfo = d.current_load
      ? `en route ${d.current_load.origin}→${d.current_load.destination}`
      : 'no load';
    const certs = [...new Set([...(d.certifications ?? []), ...(d.endorsements ?? [])])].join(', ') || 'standard';
    return `- ${d.name} (${d.driver_id}): ${d.status}, ${d.location.city} ${d.location.state}, HOS ${d.hos.drive_remaining_hrs}h remain, fuel ${d.vehicle.fuel_level_pct}%, $${d.economics.cost_per_mile}/mi, readiness ${d.readiness?.state ?? 'unknown'} (${d.readiness?.score ?? 0}), capacity ${d.vehicle.capacity_lbs} lbs, certs [${certs}], ${loadInfo}`;
  }).join('\n');
}

const AVG_SPEED_MPH = 55;

const CITY_COORDS: Record<string, [number, number]> = {
  'chicago': [41.8781, -87.6298], 'dallas': [32.7767, -96.7970],
  'denver': [39.7392, -104.9903], 'atlanta': [33.7490, -84.3880],
  'seattle': [47.6062, -122.3321], 'phoenix': [33.4484, -112.0740],
  'nashville': [36.1627, -86.7816], 'columbus': [39.9612, -82.9988],
  'new york': [40.7128, -74.0060], 'los angeles': [34.0522, -118.2437],
  'houston': [29.7604, -95.3698], 'miami': [25.7617, -80.1918],
  'st. louis': [38.6270, -90.1994], 'kansas city': [39.0997, -94.5786],
  'minneapolis': [44.9778, -93.2650], 'cleveland': [41.4993, -81.6944],
  'pittsburgh': [40.4406, -79.9959], 'charlotte': [35.2271, -80.8431],
  'memphis': [35.1495, -90.0490], 'detroit': [42.3314, -83.0458],
  'indianapolis': [39.7684, -86.1581], 'louisville': [38.2527, -85.7585],
  'oklahoma city': [35.4676, -97.5164], 'salt lake city': [40.7608, -111.8910],
  'portland': [45.5051, -122.6750], 'san francisco': [37.7749, -122.4194],
  'albuquerque': [35.0844, -106.6504], 'tucson': [32.2226, -110.9747],
  'fort worth': [32.7555, -97.3308], 'san antonio': [29.4241, -98.4936],
  'gary': [41.5934, -87.3467],
};

function resolveCoords(cityStr: string): [number, number] {
  const key = cityStr.toLowerCase().split(',')[0].trim();
  return CITY_COORDS[key] ?? [39.8283, -98.5795];
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function inferRequiredCertifications(cargo: string, weightLbs: number): string[] {
  const lower = cargo.toLowerCase();
  const required = new Set<string>();
  if (containsAny(lower, ['hazmat', 'hazard', 'flammable', 'chemical'])) required.add('hazmat');
  if (containsAny(lower, ['explosive', 'munitions'])) {
    required.add('hazmat');
    required.add('explosives');
  }
  if (containsAny(lower, ['military', 'defense', 'government'])) required.add('military');
  if (containsAny(lower, ['produce', 'perishable', 'refrigerated', 'frozen', 'pharma', 'vaccine'])) {
    required.add('refrigerated');
  }
  if (weightLbs >= 45000) required.add('heavy_haul');
  return [...required];
}

function evaluateEligibility(driver: any, pickup: string, destination: string, cargo: string, weightLbs: number) {
  const reasons = new Set<string>();
  const requiredCertifications = inferRequiredCertifications(cargo, weightLbs);
  const driverCoords: [number, number] = [driver.location.lat, driver.location.lng];
  const pickupCoords = resolveCoords(pickup);
  const destCoords = resolveCoords(destination);
  const deadheadMiles = haversineMiles(...driverCoords, ...pickupCoords);
  const haulMiles = haversineMiles(...pickupCoords, ...destCoords);
  const estimatedHours = (deadheadMiles + haulMiles) / AVG_SPEED_MPH;
  const credentials = new Set([...(driver.certifications ?? []), ...(driver.endorsements ?? [])]);
  const excludedCargoTypes = (driver.contract_constraints?.excluded_cargo_types ?? []).map((value: string) => value.toLowerCase());
  const cargoText = cargo.toLowerCase();

  if (driver.current_load) reasons.add('Driver already has an active load.');
  if (['off_duty', 'unavailable', 'breakdown'].includes(driver.status)) {
    reasons.add(`Driver status is ${String(driver.status).replace('_', ' ')}.`);
  }
  if (!['ready', 'limited'].includes(driver.readiness?.state ?? '')) {
    for (const blocker of driver.readiness?.blocker_reasons ?? ['Driver is not dispatch ready.']) {
      reasons.add(blocker);
    }
  }
  if (!driver.vehicle.maintenance_ready) reasons.add('Truck is not maintenance ready.');
  if (weightLbs > driver.vehicle.capacity_lbs) {
    reasons.add(`Truck capacity is ${driver.vehicle.capacity_lbs} lbs, below the requested load.`);
  }
  if (deadheadMiles > (driver.contract_constraints?.max_deadhead_miles ?? Number.POSITIVE_INFINITY)) {
    reasons.add(`Deadhead exceeds contract limit of ${driver.contract_constraints.max_deadhead_miles} miles.`);
  }
  if (driver.hos.drive_remaining_hrs < estimatedHours) {
    reasons.add(`Insufficient HOS for estimated ${estimatedHours.toFixed(1)}h assignment.`);
  }
  if (requiredCertifications.includes('refrigerated') && !driver.vehicle.refrigerated) {
    reasons.add('Load requires refrigerated equipment.');
  }
  if (requiredCertifications.includes('hazmat') && !driver.vehicle.hazmat_permitted) {
    reasons.add('Truck is not hazmat permitted.');
  }
  for (const required of requiredCertifications) {
    if (!credentials.has(required)) reasons.add(`Missing required certification: ${required}.`);
  }
  for (const blocked of excludedCargoTypes) {
    if (blocked && cargoText.includes(blocked)) reasons.add(`Contract excludes ${blocked} cargo.`);
  }

  return { eligible: reasons.size === 0, reasons: [...reasons], estimatedHours, deadheadMiles };
}

export default async function(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { pickup, destination, cargo, weight_lbs } = await req.json();

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  });

  const { data: drivers, error } = await client.database.from('drivers').select();
  if (error || !drivers) {
    return new Response(JSON.stringify({ error: 'Failed to fetch drivers' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const evaluations = drivers.map((driver: any) => ({
    driver,
    ...evaluateEligibility(driver, pickup, destination, cargo, weight_lbs),
  }));
  const eligibleDrivers = evaluations.filter((row: any) => row.eligible).map((row: any) => row.driver);
  if (!eligibleDrivers.length) {
    return new Response(
      JSON.stringify({
        data: {
          recommendations: [],
          dispatch_note: 'No eligible driver-truck pairs met the readiness, HOS, certification, and capacity checks.',
        },
        source: 'insforge',
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const fleetText = fleetSummary(eligibleDrivers);

  const result = await client.ai.chat.completions.create({
    model: 'anthropic/claude-sonnet-4.5',
    maxTokens: 1024,
    messages: [
      {
        role: 'system',
        content:
          'You are Sauron, an AI dispatch intelligence for a commercial trucking fleet. ' +
          'Analyze real-time driver data and make optimal assignment recommendations. ' +
          'Always respond with valid JSON only. No prose outside the JSON structure.',
      },
      {
        role: 'user',
        content:
          `Current Fleet State:\n${fleetText}\n\n` +
          `New load assignment needed:\n` +
          `- Pickup: ${pickup}\n` +
          `- Destination: ${destination}\n` +
          `- Cargo: ${cargo}, Weight: ${weight_lbs} lbs\n\n` +
          'Rank the top 3 most suitable eligible drivers. ' +
          'Consider: proximity to pickup, HOS remaining, cost per mile, readiness, and equipment fit. ' +
          'Return JSON: {"recommendations": [{"rank": 1, "driver_id": "...", "driver_name": "...", ' +
          '"score": 94, "distance_to_pickup_miles": 45.0, "hos_remaining_hrs": 8.5, ' +
          '"cost_per_mile": 1.87, "cost_delta_vs_avg": -0.12, ' +
          '"reasoning": "One sentence why optimal."}], ' +
          '"dispatch_note": "One sentence fleet observation."}',
      },
    ],
  });

  let raw = result.choices[0].message.content?.trim() ?? '';
  if (raw.startsWith('```')) {
    raw = raw.split('```')[1];
    if (raw.startsWith('json')) raw = raw.slice(4);
  }
  const parsed = JSON.parse(raw.trim());

  return new Response(
    JSON.stringify({ data: parsed, source: 'insforge', timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
