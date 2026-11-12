// Weather Dashboard
// Uses the free Open-Meteo APIs (no API key needed):
//   Geocoding: https://open-meteo.com/en/docs/geocoding-api
//   Forecast:  https://open-meteo.com/en/docs

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const HISTORY_KEY = 'weather-dashboard-history';
const MAX_HISTORY = 8;

const els = {
  form: document.getElementById('search-form'),
  input: document.getElementById('city-input'),
  error: document.getElementById('form-error'),
  history: document.getElementById('history-list'),
  clear: document.getElementById('clear-history'),
  empty: document.getElementById('empty-state'),
  loading: document.getElementById('loading'),
  weather: document.getElementById('weather'),
  city: document.getElementById('city-name'),
  date: document.getElementById('current-date'),
  icon: document.getElementById('current-icon'),
  temp: document.getElementById('current-temp'),
  desc: document.getElementById('current-desc'),
  feels: document.getElementById('feels-like'),
  humidity: document.getElementById('humidity'),
  wind: document.getElementById('wind'),
  uv: document.getElementById('uv'),
  forecast: document.getElementById('forecast'),
};

// WMO weather codes -> label + icon
const WEATHER_CODES = {
  0: ['Clear sky', '☀️'],
  1: ['Mainly clear', '🌤️'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'],
  48: ['Freezing fog', '🌫️'],
  51: ['Light drizzle', '🌦️'],
  53: ['Drizzle', '🌦️'],
  55: ['Heavy drizzle', '🌧️'],
  61: ['Light rain', '🌦️'],
  63: ['Rain', '🌧️'],
  65: ['Heavy rain', '🌧️'],
  71: ['Light snow', '🌨️'],
  73: ['Snow', '🌨️'],
  75: ['Heavy snow', '❄️'],
  80: ['Rain showers', '🌦️'],
  81: ['Rain showers', '🌧️'],
  82: ['Violent showers', '⛈️'],
  95: ['Thunderstorm', '⛈️'],
  96: ['Thunderstorm with hail', '⛈️'],
  99: ['Thunderstorm with hail', '⛈️'],
};

const describe = (code) => WEATHER_CODES[code] || ['Unknown', '🌡️'];

// ---------- Search history (localStorage) ----------
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: history just won't persist */
  }
}

function addToHistory(place) {
  const list = loadHistory().filter((p) => p.label !== place.label);
  list.unshift(place);
  saveHistory(list.slice(0, MAX_HISTORY));
  renderHistory(place.label);
}

function renderHistory(activeLabel) {
  const list = loadHistory();
  els.history.innerHTML = '';
  list.forEach((place) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = place.label;
    if (place.label === activeLabel) btn.classList.add('active');
    btn.addEventListener('click', () => showWeather(place));
    li.appendChild(btn);
    els.history.appendChild(li);
  });
  els.clear.hidden = list.length === 0;
}

// ---------- API ----------
async function geocode(city) {
  const url = `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not reach the location service.');
  const data = await res.json();
  if (!data.results || !data.results.length) throw new Error(`No city found for "${city}".`);
  const r = data.results[0];
  const region = [r.admin1, r.country_code].filter(Boolean).join(', ');
  return {
    label: region ? `${r.name}, ${region}` : r.name,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone || 'auto',
  };
}

async function getForecast(place) {
  const params = new URLSearchParams({
    latitude: place.lat,
    longitude: place.lon,
    timezone: place.timezone,
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,relative_humidity_2m_mean,uv_index_max',
    forecast_days: 6,
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error('Could not load the forecast. Please try again.');
  return res.json();
}

// ---------- Rendering ----------
function uvLevel(uv) {
  if (uv < 3) return 'low';
  if (uv < 6) return 'moderate';
  if (uv < 8) return 'high';
  return 'severe';
}

function formatDate(iso, opts) {
  // Daily dates come as YYYY-MM-DD; parse as local noon to avoid timezone shifts
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('en-US', opts);
}

function setView(view) {
  els.empty.hidden = view !== 'empty';
  els.loading.hidden = view !== 'loading';
  els.weather.hidden = view !== 'weather';
}

function render(place, data) {
  const c = data.current;
  const [label, icon] = describe(c.weather_code);

  els.city.textContent = place.label;
  els.date.textContent = formatDate(c.time, { weekday: 'long', month: 'long', day: 'numeric' });
  els.icon.textContent = icon;
  els.temp.textContent = `${Math.round(c.temperature_2m)}°`;
  els.desc.textContent = label;
  els.feels.textContent = `${Math.round(c.apparent_temperature)}°F`;
  els.humidity.textContent = `${Math.round(c.relative_humidity_2m)}%`;
  els.wind.textContent = `${Math.round(c.wind_speed_10m)} mph`;

  const uv = Number(c.uv_index ?? data.daily.uv_index_max[0] ?? 0);
  els.uv.textContent = uv.toFixed(1);
  els.uv.className = `uv ${uvLevel(uv)}`;
  els.uv.title = `UV is ${uvLevel(uv)}`;

  // Next 5 days (skip today)
  const d = data.daily;
  els.forecast.innerHTML = '';
  for (let i = 1; i <= 5 && i < d.time.length; i++) {
    const [dayLabel, dayIcon] = describe(d.weather_code[i]);
    const card = document.createElement('article');
    card.className = 'day card';
    card.innerHTML = `
      <h3>${formatDate(d.time[i], { weekday: 'short' })}</h3>
      <p class="date">${formatDate(d.time[i], { month: 'short', day: 'numeric' })}</p>
      <div class="icon" role="img" aria-label="${dayLabel}">${dayIcon}</div>
      <p class="temps">${Math.round(d.temperature_2m_max[i])}° <span>/ ${Math.round(d.temperature_2m_min[i])}°</span></p>
      <p class="meta">Wind ${Math.round(d.wind_speed_10m_max[i])} mph<br />Humidity ${Math.round(d.relative_humidity_2m_mean[i])}%</p>
    `;
    els.forecast.appendChild(card);
  }

  setView('weather');
}

async function showWeather(place) {
  els.error.textContent = '';
  setView('loading');
  try {
    const data = await getForecast(place);
    render(place, data);
    addToHistory(place);
  } catch (err) {
    els.error.textContent = err.message;
    setView('empty');
  }
}

// ---------- Events ----------
els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = els.input.value.trim();
  if (!city) return;
  els.error.textContent = '';
  setView('loading');
  try {
    const place = await geocode(city);
    els.input.value = '';
    await showWeather(place);
  } catch (err) {
    els.error.textContent = err.message;
    setView(els.city.textContent ? 'weather' : 'empty');
  }
});

els.clear.addEventListener('click', () => {
  saveHistory([]);
  renderHistory();
});

// ---------- Init ----------
renderHistory();
const last = loadHistory()[0];
if (last) showWeather(last);
