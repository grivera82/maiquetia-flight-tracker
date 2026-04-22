/**
 * Maiquetia Flight Data Fetcher
 * Fetches arrivals and departures from AirLabs API
 * and saves them to daily JSON files.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const ENV_PATH = path.join(__dirname, '.env');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Parse .env file
function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

const env = loadEnv(ENV_PATH);

// Load configuration
let config;
try {
  const configRaw = fs.readFileSync(CONFIG_PATH, 'utf8');
  config = JSON.parse(configRaw);
} catch (err) {
  console.error('Error reading config.json:', err.message);
  process.exit(1);
}

// Merge API key from .env
config.api_key = env.AIRLABS_API_KEY || config.api_key;

if (!config.api_key || config.api_key === 'YOUR_AIRLABS_API_KEY_HERE') {
  console.error('Error: Please set your AirLabs API key in .env (AIRLABS_API_KEY=your_key)');
  process.exit(1);
}

const API_BASE = 'https://airlabs.co/api/v9/schedules';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

function getTodayDate() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

async function fetchFlights() {
  const arrivalsUrl = `${API_BASE}?arr_iata=${config.airport_iata}&api_key=${config.api_key}`;
  const departuresUrl = `${API_BASE}?dep_iata=${config.airport_iata}&api_key=${config.api_key}`;

  console.log(`[${getCurrentTimestamp()}] Fetching arrivals...`);
  const arrivalsData = await fetchUrl(arrivalsUrl);

  console.log(`[${getCurrentTimestamp()}] Fetching departures...`);
  const departuresData = await fetchUrl(departuresUrl);

  const flights = {
    meta: {
      airport_iata: config.airport_iata,
      airport_icao: config.airport_icao,
      airport_name: config.airport_name,
      city: config.city,
      country: config.country,
      date: getTodayDate(),
      fetched_at: getCurrentTimestamp(),
      arrivals_count: 0,
      departures_count: 0
    },
    arrivals: [],
    departures: []
  };

  if (arrivalsData && arrivalsData.response) {
    flights.arrivals = arrivalsData.response;
    flights.meta.arrivals_count = flights.arrivals.length;
  } else if (arrivalsData && arrivalsData.error) {
    console.error('AirLabs arrivals error:', arrivalsData.error);
  }

  if (departuresData && departuresData.response) {
    flights.departures = departuresData.response;
    flights.meta.departures_count = flights.departures.length;
  } else if (departuresData && departuresData.error) {
    console.error('AirLabs departures error:', departuresData.error);
  }

  return flights;
}

function saveFlights(flights) {
  const date = flights.meta.date;
  const filePath = path.join(DATA_DIR, `${date}.json`);

  // Read existing data if available to merge
  let existing = { arrivals: [], departures: [] };
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.warn('Could not read existing file, starting fresh.');
    }
  }

  // Merge flights by flight_iata + dep_time to avoid duplicates
  const mergeFlights = (newFlights, existingFlights) => {
    const map = new Map();
    for (const f of existingFlights) {
      const key = `${f.flight_iata || f.flight_icao || ''}_${f.dep_time || ''}_${f.arr_time || ''}`;
      map.set(key, f);
    }
    for (const f of newFlights) {
      const key = `${f.flight_iata || f.flight_icao || ''}_${f.dep_time || ''}_${f.arr_time || ''}`;
      map.set(key, f); // overwrite with latest
    }
    return Array.from(map.values());
  };

  const merged = {
    meta: flights.meta,
    arrivals: mergeFlights(flights.arrivals, existing.arrivals || []),
    departures: mergeFlights(flights.departures, existing.departures || [])
  };

  merged.meta.arrivals_count = merged.arrivals.length;
  merged.meta.departures_count = merged.departures.length;

  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  console.log(`[${getCurrentTimestamp()}] Saved ${merged.arrivals.length} arrivals, ${merged.departures.length} departures to ${filePath}`);

  // Also update latest.json symlink equivalent
  const latestPath = path.join(DATA_DIR, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(merged, null, 2));

  // Update history index
  updateHistoryIndex();
}

function updateHistoryIndex() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  const history = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
      const data = JSON.parse(raw);
      if (data.meta) {
        history.push({
          date: data.meta.date,
          arrivals_count: data.meta.arrivals_count || 0,
          departures_count: data.meta.departures_count || 0,
          total_count: (data.meta.arrivals_count || 0) + (data.meta.departures_count || 0)
        });
      }
    } catch (e) {
      console.warn(`Skipping corrupt file ${file}`);
    }
  }

  const historyPath = path.join(DATA_DIR, 'history.json');
  fs.writeFileSync(historyPath, JSON.stringify({ history }, null, 2));
  console.log(`[${getCurrentTimestamp()}] Updated history index with ${history.length} day(s)`);
}

async function main() {
  try {
    console.log(`[${getCurrentTimestamp()}] Starting flight fetch for ${config.airport_name} (${config.airport_iata})...`);
    const flights = await fetchFlights();
    saveFlights(flights);
    console.log(`[${getCurrentTimestamp()}] Done.`);
  } catch (err) {
    console.error(`[${getCurrentTimestamp()}] Error:`, err.message);
    process.exit(1);
  }
}

main();
