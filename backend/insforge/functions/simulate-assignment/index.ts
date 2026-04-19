import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const AVG_SPEED_MPH = 55.0;
const COST_PER_MILE_OVERHEAD = 0.15;

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

function buildRouteGeojson(
  start: [number, number],
  waypoint: [number, number],
  end: [number, number]
): object {
  const jitter = () => (Math.random() - 0.5) * 2;
  const midLat = (start[0] + end[0]) / 2 + jitter() * 0.75;
  const midLng = (start[1] + end[1]) / 2 + jitter() * 0.75;
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [start[1], start[0]],
        [waypoint[1] + jitter() * 0.25, waypoint[0] + jitter() * 0.25],
        [midLng, midLat],
        [end[1], end[0]],
      ],
    },
    properties: {},
  };
}

export default async function(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { driver_id, pickup, destination } = await req.json();

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  });

  const { data: rows, error } = await client.database
    .from('drivers')
    .select()
    .eq('driver_id', driver_id);

  if (error || !rows || rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Driver not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const driver = rows[0];
  const driverCoords: [number, number] = [driver.location.lat, driver.location.lng];
  const pickupCoords = resolveCoords(pickup);
  const destCoords = resolveCoords(destination);

  const deadheadMiles = haversineMiles(...driverCoords, ...pickupCoords);
  const haulMiles = haversineMiles(...pickupCoords, ...destCoords);
  const totalMiles = deadheadMiles + haulMiles;
  const totalHours = totalMiles / AVG_SPEED_MPH;
  const costPerMile = driver.economics.cost_per_mile + COST_PER_MILE_OVERHEAD;
  const totalCost = totalMiles * costPerMile;
  const hosAfter = Math.max(0, driver.hos.drive_remaining_hrs - totalHours);

  const route = buildRouteGeojson(driverCoords, pickupCoords, destCoords);

  const aiResult = await client.ai.chat.completions.create({
    model: 'anthropic/claude-sonnet-4.5',
    maxTokens: 150,
    messages: [
      {
        role: 'system',
        content:
          'You are Sauron simulation narrator. Generate exactly one confident sentence describing ' +
          'the outcome of a simulated truck assignment. Include cost impact, ETA, and one operational note. ' +
          'No hedging language. Be specific and direct.',
      },
      {
        role: 'user',
        content:
          `Driver: ${driver.name}, currently in ${driver.location.city}, ${driver.location.state}\n` +
          `Assignment: ${pickup} → ${destination}\n` +
          `Drive time: ${totalHours.toFixed(1)}h, Miles: ${Math.round(totalMiles)}, ` +
          `Cost: $${Math.round(totalCost)} ($${costPerMile.toFixed(2)}/mi)\n` +
          `HOS after completion: ${hosAfter.toFixed(1)}h remaining\n` +
          'Generate one sentence simulation outcome.',
      },
    ],
  });

  const narrator = aiResult.choices[0].message.content?.trim() ?? '';

  return new Response(
    JSON.stringify({
      data: {
        driver_id: driver.driver_id,
        driver_name: driver.name,
        route,
        pickup_coords: { lat: pickupCoords[0], lng: pickupCoords[1] },
        destination_coords: { lat: destCoords[0], lng: destCoords[1] },
        estimated_miles: Math.round(totalMiles * 10) / 10,
        estimated_hours: Math.round(totalHours * 10) / 10,
        total_cost: Math.round(totalCost * 100) / 100,
        cost_per_mile: Math.round(costPerMile * 100) / 100,
        narrator_text: narrator,
        hos_remaining_after: Math.round(hosAfter * 10) / 10,
      },
      timestamp: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
