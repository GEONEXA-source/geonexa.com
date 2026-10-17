// GeoNEXA AI — daily 6:00 AM (Rwanda time) weather email.
// Triggered by pg_cron (see ../../daily-weather-email.sql). Sends through the
// same Gmail account used for Supabase auth emails.
//
// Secrets to set (Edge Functions → Secrets):
//   GMAIL_USER          e.g. geosageairw@gmail.com
//   GMAIL_APP_PASSWORD  16-character Gmail App Password (no spaces)
//   CRON_SECRET         any long random string; same value goes in the SQL schedule
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Deploy with "Verify JWT" OFF — requests are protected by CRON_SECRET instead.
//
// Test one address:  POST {"only_email":"you@gmail.com"}  (header x-cron-secret required)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const KIGALI = { lat: -1.9441, lng: 30.0619, name: "Kigali" };
const MAX_PER_RUN = 450; // Gmail allows ~500 emails per day

const WEATHER_CODES: Record<number, [string, string]> = {
  0: ["Clear sky", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
  80: ["Light showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm with hail", "⛈️"], 99: ["Severe thunderstorm with hail", "⛈️"],
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function uvLabel(uv: number) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function clock(iso: string) {
  return String(iso || "").split("T")[1]?.slice(0, 5) || "—";
}

async function geocode(place: string) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&country_code=RW&language=en`;
    const res = await fetch(url);
    const json = await res.json();
    const hit = json?.results?.[0];
    if (hit) return { lat: hit.latitude, lng: hit.longitude, name: hit.name || place };
  } catch (_) { /* fall through */ }
  return KIGALI;
}

async function getWeather(lat: number, lng: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=Africa%2FKigali&forecast_days=1` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather " + res.status);
  return await res.json();
}

function buildMessage(firstName: string, placeName: string, w: any) {
  const d = w.daily;
  const code = d.weather_code?.[0] ?? 0;
  const [cond, icon] = WEATHER_CODES[code] || ["Mixed conditions", "🌡️"];
  const hi = Math.round(d.temperature_2m_max[0]);
  const lo = Math.round(d.temperature_2m_min[0]);
  const rainChance = Math.round(d.precipitation_probability_max?.[0] ?? 0);
  const rainMm = Number(d.precipitation_sum?.[0] ?? 0).toFixed(1);
  const wind = Math.round(d.wind_speed_10m_max?.[0] ?? 0);
  const uv = Number(d.uv_index_max?.[0] ?? 0);
  const humidity = Math.round(w.current?.relative_humidity_2m ?? 0);
  const nowTemp = Math.round(w.current?.temperature_2m ?? hi);
  const rise = clock(d.sunrise?.[0]);
  const set = clock(d.sunset?.[0]);

  const tips: string[] = [];
  if (rainChance >= 60 || code >= 95) tips.push("Carry an umbrella or raincoat — rain is likely today.");
  else if (rainChance >= 30) tips.push("A shower is possible — keep an umbrella handy.");
  if (code >= 95) tips.push("Thunderstorms are possible — avoid open fields and hilltops if you are doing field work.");
  if (uv >= 6) tips.push("UV is strong around midday — wear a hat and sunscreen.");
  if (hi >= 30) tips.push("It will be hot — drink plenty of water.");
  if (lo <= 10) tips.push("Cool morning and evening — bring a jacket.");
  if (!tips.length) tips.push("Good conditions for field work and travel today.");

  const subject = `${icon} Good morning ${firstName} — today's weather in ${placeName}: ${cond}, ${hi}°C`;

  const rows: [string, string][] = [
    ["Conditions", `${icon} ${cond}`],
    ["Right now", `${nowTemp}°C`],
    ["High / Low", `${hi}°C / ${lo}°C`],
    ["Rain", `${rainChance}% chance · ${rainMm} mm expected`],
    ["Wind", `up to ${wind} km/h`],
    ["Humidity", `${humidity}%`],
    ["UV index", `${uv.toFixed(0)} (${uvLabel(uv)})`],
    ["Sunrise / Sunset", `${rise} / ${set}`],
  ];

  const text =
    `Good morning, ${firstName}!\n\nToday's weather in ${placeName} looks like this:\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nTips:\n- ${tips.join("\n- ")}\n\n` +
    `— GeoNEXA AI\nTurn this email off anytime: Settings → Notifications.`;

  const html = `<!doctype html><html><body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#10202b;">
<div style="max-width:520px;margin:0 auto;padding:20px;">
  <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e1e8ee;">
    <div style="background:linear-gradient(135deg,#0d9488,#22e0ab);padding:22px 24px;color:#06120e;">
      <div style="font-size:12px;letter-spacing:.08em;font-weight:700;opacity:.8;">GEONEXA AI · DAILY WEATHER</div>
      <div style="font-size:24px;font-weight:800;margin-top:6px;">Good morning, ${esc(firstName)}! ${icon}</div>
      <div style="font-size:14px;margin-top:6px;">Today's weather in <b>${esc(placeName)}</b> looks like this:</div>
    </div>
    <div style="padding:8px 24px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        ${rows.map(([k, v]) => `<tr><td style="padding:10px 0;color:#5b6b78;border-bottom:1px solid #eef2f5;">${esc(k)}</td><td style="padding:10px 0;text-align:right;font-weight:700;border-bottom:1px solid #eef2f5;">${esc(v)}</td></tr>`).join("")}
      </table>
    </div>
    <div style="margin:14px 24px 20px;padding:14px 16px;background:#f0fbf7;border-radius:12px;font-size:13px;line-height:1.6;">
      <b>Today's tips</b><br>${tips.map((t) => "• " + esc(t)).join("<br>")}
    </div>
  </div>
  <p style="font-size:11px;color:#7a8894;text-align:center;margin:14px 0 0;">
    You get this because daily weather emails are on for your GeoNEXA account.<br>
    Turn it off anytime in Settings → Notifications.
  </p>
</div></body></html>`;

  return { subject, text, html };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const onlyEmail = body?.only_email ? String(body.only_email).toLowerCase() : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: recipients, error } = await supabase.rpc("get_weather_email_recipients");
  if (error) return new Response("recipients error: " + error.message, { status: 500 });

  let list: { email: string; full_name: string | null; place: string }[] = recipients || [];
  if (onlyEmail) list = list.filter((r) => r.email.toLowerCase() === onlyEmail);
  list = list.slice(0, MAX_PER_RUN);

  // One geocode + one forecast per distinct place, not per user.
  const weatherByPlace = new Map<string, { name: string; data: any } | null>();
  for (const place of new Set(list.map((r) => r.place))) {
    try {
      const g = await geocode(place);
      weatherByPlace.set(place, { name: g.name, data: await getWeather(g.lat, g.lng) });
    } catch (_) {
      weatherByPlace.set(place, null);
    }
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: Deno.env.get("GMAIL_USER")!, password: Deno.env.get("GMAIL_APP_PASSWORD")! },
    },
  });

  let sent = 0, failed = 0, skipped = 0;
  const errors: string[] = [];
  for (const r of list) {
    const w = weatherByPlace.get(r.place);
    if (!w) { skipped++; continue; }
    const first = (r.full_name || "").trim().split(/\s+/)[0] || "there";
    const { subject, text, html } = buildMessage(first, w.name, w.data);
    try {
      await client.send({
        from: `GeoNEXA AI <${Deno.env.get("GMAIL_USER")}>`,
        to: r.email,
        subject,
        content: text,
        html,
      });
      sent++;
    } catch (e) {
      failed++;
      if (errors.length < 5) errors.push(String((e as Error).message || e).slice(0, 160));
    }
  }
  try { await client.close(); } catch (_) { /* ignore */ }

  return new Response(JSON.stringify({ total: list.length, sent, failed, skipped, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});
