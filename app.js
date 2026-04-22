/**
 * Maiquetia Flight Tracker - Frontend App
 */

(function() {
  'use strict';

  // DOM Elements
  const clockEl = document.getElementById('clock');
  const currentDateEl = document.getElementById('currentDate');
  const datePicker = document.getElementById('datePicker');
  const arrCountEl = document.getElementById('arrCount');
  const depCountEl = document.getElementById('depCount');
  const totalCountEl = document.getElementById('totalCount');
  const lastUpdatedEl = document.getElementById('lastUpdated');
  const searchInput = document.getElementById('searchInput');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const arrivalsBody = document.getElementById('arrivalsBody');
  const departuresBody = document.getElementById('departuresBody');
  const historyBody = document.getElementById('historyBody');
  const historySummary = document.getElementById('historySummary');

  let currentData = null;
  let historyData = null;
  let currentTab = 'arrivals';
  let autoRefreshInterval = null;

  // Initialize
  function init() {
    updateClock();
    setInterval(updateClock, 1000);

    // Set date picker to today
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
    datePicker.max = today;

    // Event listeners
    datePicker.addEventListener('change', handleDateChange);
    searchInput.addEventListener('input', handleSearch);

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Load today's data
    loadData(today);

    // Auto-refresh every 15 minutes
    autoRefreshInterval = setInterval(() => {
      loadData(datePicker.value);
    }, 15 * 60 * 1000);

    // Update year in footer
    document.getElementById('year').textContent = new Date().getFullYear();
  }

  // Clock
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    currentDateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Tab switching
  function switchTab(tab) {
    currentTab = tab;
    tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    tabContents.forEach(content => content.classList.toggle('active', content.id === tab));

    if (tab === 'history') {
      loadHistory();
    } else {
      renderTables();
    }
  }

  // Date change
  function handleDateChange() {
    loadData(datePicker.value);
  }

  // Search
  function handleSearch() {
    renderTables();
  }

  // Load data from JSON file
  async function loadData(date) {
    const fileName = date === new Date().toISOString().split('T')[0] ? 'latest' : date;
    const url = `data/${fileName}.json?t=${Date.now()}`; // cache-bust

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          showEmptyState('No data available for this date yet.');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      currentData = await response.json();
      updateStats();
      renderTables();
      updateLastUpdated();
    } catch (err) {
      console.error('Error loading data:', err);
      showErrorState('Failed to load flight data. Please try again later.');
    }
  }

  // Update stats
  function updateStats() {
    if (!currentData) return;
    const arr = currentData.arrivals || [];
    const dep = currentData.departures || [];
    arrCountEl.textContent = arr.length;
    depCountEl.textContent = dep.length;
    totalCountEl.textContent = arr.length + dep.length;
  }

  // Update last updated time
  function updateLastUpdated() {
    if (currentData && currentData.meta && currentData.meta.fetched_at) {
      const fetched = new Date(currentData.meta.fetched_at);
      lastUpdatedEl.textContent = 'Last updated: ' + fetched.toLocaleTimeString('en-US', { hour12: false });
    } else {
      lastUpdatedEl.textContent = 'Last updated: --';
    }
  }

  // Get search filter
  function getFilter() {
    return searchInput.value.trim().toLowerCase();
  }

  // Filter flights
  function filterFlights(flights) {
    const filter = getFilter();
    if (!filter) return flights;

    return flights.filter(f => {
      const searchStr = [
        f.flight_iata,
        f.flight_icao,
        f.flight_number,
        f.airline_iata,
        f.airline_icao,
        f.dep_iata,
        f.dep_icao,
        f.arr_iata,
        f.arr_icao,
        f.status
      ].join(' ').toLowerCase();
      return searchStr.includes(filter);
    });
  }

  // Format time
  function formatTime(timeStr) {
    if (!timeStr) return '--:--';
    // timeStr is like "2021-07-14 19:53"
    const parts = timeStr.split(' ');
    if (parts.length === 2) {
      return parts[1];
    }
    return timeStr;
  }

  // Format status for CSS class
  function getStatusClass(status) {
    if (!status) return 'status-unknown';
    const s = status.toLowerCase().replace(/\s+/g, '-');
    const validStatuses = [
      'scheduled', 'active', 'en-route', 'landed', 'delayed',
      'cancelled', 'diverted', 'redirected', 'incident', 'unknown', 'unkknown'
    ];
    if (validStatuses.includes(s)) {
      return `status-${s}`;
    }
    return 'status-unknown';
  }

  // Format status label
  function formatStatus(status) {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  // Get airline name (best effort)
  function getAirlineName(flight) {
    if (flight.airline_name) return flight.airline_name;
    // Map common IATA codes to names for CCS
    const airlines = {
      'TK': 'Turkish Airlines',
      'RUC': 'Rutaca',
      'VNE': 'Venezolana',
      'QL': 'LASER Airlines',
      '9V': 'Avior Airlines',
      'P5': 'Wingo',
      'V0': 'Conviasa',
      'AV': 'Avianca',
      'ETR': 'Estelar',
      'CM': 'Copa Airlines',
      'IB': 'Iberia',
      'TP': 'TAP Air Portugal',
      'AF': 'Air France',
      'UX': 'Air Europa',
      'AA': 'American Airlines',
      'DL': 'Delta Air Lines',
      'UA': 'United Airlines',
      'LH': 'Lufthansa',
      'BA': 'British Airways',
      'AZ': 'ITA Airways',
      'LX': 'SWISS',
      'KL': 'KLM'
    };
    return airlines[flight.airline_iata] || flight.airline_iata || flight.airline_icao || 'Unknown';
  }

  // Get airport/city name
  function getAirportName(code, isArrivalTable) {
    // For arrivals table, we show origin (departure airport)
    // For departures table, we show destination (arrival airport)
    // This function can be expanded with a full airport database
    return code || 'Unknown';
  }

  // Render time cell with estimated/actual
  function renderTimeCell(flight, type) {
    // type is 'arr' for arrivals, 'dep' for departures
    const scheduled = type === 'arr' ? flight.arr_time : flight.dep_time;
    const estimated = type === 'arr' ? flight.arr_estimated : flight.dep_estimated;
    const actual = type === 'arr' ? flight.arr_actual : flight.dep_actual;

    const scheduledTime = formatTime(scheduled);
    const displayTime = formatTime(actual || estimated || scheduled);
    const hasChanged = (actual || estimated) && (actual || estimated) !== scheduled;

    let html = `<span class="time-cell">`;
    html += `<span class="${hasChanged ? 'scheduled' : ''}">${scheduledTime}</span>`;
    if (hasChanged) {
      html += `<span class="estimated">${formatTime(actual || estimated)}</span>`;
    }
    html += `</span>`;
    return html;
  }

  // Render a single flight row
  function renderFlightRow(flight, type) {
    const isArrival = type === 'arrivals';
    const otherAirport = isArrival ? flight.dep_iata : flight.arr_iata;
    const otherAirportIcao = isArrival ? flight.dep_icao : flight.arr_icao;

    return `
      <tr>
        <td>${renderTimeCell(flight, isArrival ? 'arr' : 'dep')}</td>
        <td><span class="flight-num">${flight.flight_iata || flight.flight_icao || flight.flight_number || 'N/A'}</span></td>
        <td>
          <div class="airline-name">
            <span class="airline-text">${getAirlineName(flight)}</span>
          </div>
        </td>
        <td>
          <span class="city-name">${otherAirport || 'Unknown'}</span>
          ${otherAirportIcao ? `<span class="city-code">(${otherAirportIcao})</span>` : ''}
        </td>
        <td class="terminal">${isArrival ? (flight.arr_terminal || '-') : (flight.dep_terminal || '-')}</td>
        <td class="gate">${isArrival ? (flight.arr_gate || '-') : (flight.dep_gate || '-')}</td>
        <td><span class="status ${getStatusClass(flight.status)}">${formatStatus(flight.status)}</span></td>
      </tr>
    `;
  }

  // Sort flights by time
  function sortFlights(flights, type) {
    return flights.slice().sort((a, b) => {
      const timeA = type === 'arrivals' ? (a.arr_time_ts || 0) : (a.dep_time_ts || 0);
      const timeB = type === 'arrivals' ? (b.arr_time_ts || 0) : (b.dep_time_ts || 0);
      return timeA - timeB;
    });
  }

  // Render tables
  function renderTables() {
    if (!currentData) return;

    const filter = getFilter();

    // Arrivals
    let arrivals = currentData.arrivals || [];
    arrivals = sortFlights(arrivals, 'arrivals');
    arrivals = filterFlights(arrivals);

    if (arrivals.length === 0) {
      arrivalsBody.innerHTML = `<tr><td colspan="7" class="empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
        <div>${filter ? 'No arrivals match your search.' : 'No arrival data available.'}</div>
      </td></tr>`;
    } else {
      arrivalsBody.innerHTML = arrivals.map(f => renderFlightRow(f, 'arrivals')).join('');
    }

    // Departures
    let departures = currentData.departures || [];
    departures = sortFlights(departures, 'departures');
    departures = filterFlights(departures);

    if (departures.length === 0) {
      departuresBody.innerHTML = `<tr><td colspan="7" class="empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
        <div>${filter ? 'No departures match your search.' : 'No departure data available.'}</div>
      </td></tr>`;
    } else {
      departuresBody.innerHTML = departures.map(f => renderFlightRow(f, 'departures')).join('');
    }
  }

  // Load history data
  async function loadHistory() {
    console.log('[History] Loading history data...');
    const url = `data/history.json?t=${Date.now()}`;
    try {
      const response = await fetch(url);
      console.log('[History] Response status:', response.status);
      if (!response.ok) {
        if (response.status === 404) {
          historyBody.innerHTML = `<tr><td colspan="4" class="empty">No history data available yet.</td></tr>`;
          historySummary.innerHTML = '';
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log('[History] Data received:', data);
      historyData = data.history || [];
      console.log('[History] History entries:', historyData.length);
      renderHistory();
    } catch (err) {
      console.error('[History] Error loading history:', err);
      historyBody.innerHTML = `<tr><td colspan="4" class="empty">Failed to load history data.</td></tr>`;
      historySummary.innerHTML = '';
    }
  }

  // Render history table
  function renderHistory() {
    console.log('[History] Rendering history...', historyData);
    if (!historyBody || !historySummary) {
      console.error('[History] DOM elements not found');
      return;
    }
    if (!historyData || historyData.length === 0) {
      historyBody.innerHTML = `<tr><td colspan="4" class="empty">No history data available yet.</td></tr>`;
      historySummary.innerHTML = '';
      return;
    }

    // Sort by date descending (newest first)
    const sorted = historyData.slice().sort((a, b) => b.date.localeCompare(a.date));

    // Calculate totals
    const totalArr = sorted.reduce((sum, d) => sum + (d.arrivals_count || 0), 0);
    const totalDep = sorted.reduce((sum, d) => sum + (d.departures_count || 0), 0);
    const totalFlights = totalArr + totalDep;
    const avgPerDay = Math.round(totalFlights / sorted.length);

    historySummary.innerHTML = `
      <div class="history-cards">
        <div class="history-card">
          <div class="history-card-label">Days Tracked</div>
          <div class="history-card-value">${sorted.length}</div>
        </div>
        <div class="history-card">
          <div class="history-card-label">Total Arrivals</div>
          <div class="history-card-value">${totalArr.toLocaleString()}</div>
        </div>
        <div class="history-card">
          <div class="history-card-label">Total Departures</div>
          <div class="history-card-value">${totalDep.toLocaleString()}</div>
        </div>
        <div class="history-card">
          <div class="history-card-label">Total Flights</div>
          <div class="history-card-value">${totalFlights.toLocaleString()}</div>
        </div>
        <div class="history-card">
          <div class="history-card-label">Avg / Day</div>
          <div class="history-card-value">${avgPerDay}</div>
        </div>
      </div>
    `;

    historyBody.innerHTML = sorted.map(day => `
      <tr>
        <td><strong>${formatDate(day.date)}</strong></td>
        <td>${day.arrivals_count || 0}</td>
        <td>${day.departures_count || 0}</td>
        <td><strong>${day.total_count || 0}</strong></td>
      </tr>
    `).join('');
  }

  // Format date nicely
  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Show empty state
  function showEmptyState(message) {
    currentData = null;
    arrCountEl.textContent = '0';
    depCountEl.textContent = '0';
    totalCountEl.textContent = '0';
    lastUpdatedEl.textContent = 'Last updated: --';

    const html = `<tr><td colspan="7" class="empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      <div>${message}</div>
    </td></tr>`;

    arrivalsBody.innerHTML = html;
    departuresBody.innerHTML = html;
  }

  // Show error state
  function showErrorState(message) {
    showEmptyState(message);
  }

  // Start
  init();
})();
