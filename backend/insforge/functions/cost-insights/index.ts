import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

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

  const avgCpm = drivers.reduce((sum: number, d: any) => sum + d.economics.cost_per_mile, 0) / drivers.length;

  const costText = drivers.map((d: any) => {
    const delta = d.economics.cost_per_mile - avgCpm;
    const sign = delta >= 0 ? '+' : '';
    return `- ${d.name}: $${d.economics.cost_per_mile}/mi (${sign}${delta.toFixed(2)} vs avg), ${d.economics.miles_today} miles today, idle cost $${d.economics.idle_cost_today}`;
  }).join('\n');

  const chartData = [...drivers]
    .sort((a: any, b: any) => a.economics.cost_per_mile - b.economics.cost_per_mile)
    .map((d: any) => ({
      name: d.name.split(' ')[0],
      full_name: d.name,
      driver_id: d.driver_id,
      cost_per_mile: d.economics.cost_per_mile,
      miles_today: d.economics.miles_today,
    }));

  const result = await client.ai.chat.completions.create({
    model: 'anthropic/claude-sonnet-4.5',
    maxTokens: 512,
    messages: [
      {
        role: 'system',
        content:
          'You are Sauron fleet intelligence. Analyze cost data and identify actionable insights. ' +
          'Return exactly 3 insight objects in JSON. Each insight must be specific with real names and numbers.',
      },
      {
        role: 'user',
        content:
          `Fleet cost data today:\n${costText}\nFleet average: $${avgCpm.toFixed(2)}/mile\n\n` +
          'Generate 3 cost intelligence insights with specific driver names and numbers. ' +
          'Return JSON: {"insights": [{"icon": "trending_up|alert_triangle|zap|dollar_sign", ' +
          '"title": "Short bold title", "detail": "One specific sentence with names/numbers.", ' +
          '"severity": "info|warning|critical"}]}',
      },
    ],
  });

  let raw = result.choices[0].message.content?.trim() ?? '';
  if (raw.startsWith('```')) {
    raw = raw.split('```')[1];
    if (raw.startsWith('json')) raw = raw.slice(4);
  }
  const insightsData = JSON.parse(raw.trim());

  return new Response(
    JSON.stringify({
      data: { chart_data: chartData, insights: insightsData.insights ?? [] },
      source: 'insforge',
      timestamp: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
