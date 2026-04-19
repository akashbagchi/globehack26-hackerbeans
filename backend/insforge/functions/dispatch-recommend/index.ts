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
    return `- ${d.name} (${d.driver_id}): ${d.status}, ${d.location.city} ${d.location.state}, HOS ${d.hos.drive_remaining_hrs}h remain, fuel ${d.vehicle.fuel_level_pct}%, $${d.economics.cost_per_mile}/mi, ${loadInfo}`;
  }).join('\n');
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

  const fleetText = fleetSummary(drivers);

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
          'Rank the top 3 most suitable available drivers. ' +
          'Consider: proximity to pickup, HOS remaining, cost per mile, current status. ' +
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
