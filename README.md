# Maiquetia Flight Tracker

> Real-time flight tracking dashboard for **Simón Bolívar International Airport (CCS / SVMI)** — Maiquetía, Venezuela.

Track arrivals, departures, and historical flight statistics for Venezuela's primary international airport. Data refreshes automatically every 15 minutes via the AirLabs API.

---

## Features

- **Real-time Arrivals & Departures** — Live flight boards with flight numbers, airlines, times, terminals, gates, and status
- **Search** — Filter flights by flight number, airline, or city
- **Date Picker** — Browse past days from archived JSON data
- **History Tab** — Daily totals with summary stats (days tracked, total flights, averages)
- **Auto-refresh** — Frontend and backend both refresh every 15 minutes
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Daily Archives** — Each day's data is saved as a JSON file for historical analysis
- **Secure API Key Storage** — API key stored in `.env`, never exposed to the frontend

---

## Live Demo

[https://www.jgrivera.com/maiquetia/](https://www.jgrivera.com/maiquetia/)

---

## Screenshots

*(Add screenshots here)*

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (no frameworks) |
| **Backend Fetcher** | Node.js (`fetcher.js`) |
| **Data Storage** | JSON files on disk |
| **Scheduling** | Linux `crontab` |
| **Web Server** | Nginx |
| **Data Source** | [AirLabs API](https://airlabs.co/) (free tier) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Arrivals   │  │ Departures  │  │      History        │ │
│  │    Tab      │  │    Tab      │  │       Tab           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  Reads: data/latest.json        Reads: data/history.json    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nginx Web Server                       │
│           (serves static files + blocks .env)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────┐           ┌──────────────────────┐
│  index.html  │           │     data/*.json      │
│   app.js     │           │  (daily archives)    │
│  style.css   │           └──────────────────────┘
└──────────────┘                     ▲
                                     │
                              ┌──────┴──────┐
                              │  fetcher.js │
                              │  (Node.js)  │
                              └──────┬──────┘
                                     │
                              ┌──────┴──────┐
                              │  AirLabs API│
                              │  (CCS data) │
                              └─────────────┘
```

---

## File Structure

```
maiquetia/
├── .env                    # AirLabs API key (KEEP SECRET)
├── .htaccess               # Apache security rules (blocks sensitive files)
├── config.json             # Airport configuration (IATA, ICAO, name)
├── fetcher.js              # Node.js script — fetches & saves flight data
├── index.html              # Dashboard frontend
├── app.js                  # Frontend JavaScript logic
├── style.css               # Dashboard styles
├── package.json            # Project metadata
├── data/                   # Daily flight data archives
│   ├── latest.json         # Most recent fetch (frontend reads this)
│   ├── history.json        # Aggregated daily totals
│   └── YYYY-MM-DD.json     # Per-day archives (auto-created)
└── fetcher.log             # Cron job logs (auto-created)
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (for the fetcher script)
- A web server (Nginx, Apache, or Python `http.server`)
- Linux/macOS with `crontab` for scheduling

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/maiquetia-flight-tracker.git
cd maiquetia-flight-tracker
```

### 2. Get Your Free AirLabs API Key

1. Sign up at [https://airlabs.co/signup?package=free&cycle=monthly](https://airlabs.co/signup?package=free&cycle=monthly)
2. Copy your API key from the dashboard

### 3. Configure

Create a `.env` file:

```bash
cp .env.example .env
```

Add your API key:

```
AIRLABS_API_KEY=your_api_key_here
```

### 4. Test the Fetcher

```bash
node fetcher.js
```

Expected output:
```
[2026-04-22T22:45:18.971Z] Starting flight fetch for Simón Bolívar International Airport (CCS)...
[2026-04-22T22:45:18.973Z] Fetching arrivals...
[2026-04-22T22:45:19.438Z] Fetching departures...
[2026-04-22T22:45:19.572Z] Saved 27 arrivals, 20 departures to data/2026-04-22.json
[2026-04-22T22:45:19.572Z] Updated history index with 1 day(s)
[2026-04-22T22:45:19.572Z] Done.
```

### 5. Set Up Auto-Updates (Crontab)

Edit your crontab:

```bash
crontab -e
```

Add this line to run every 15 minutes:

```cron
*/15 * * * * cd /path/to/maiquetia-flight-tracker && /usr/bin/node fetcher.js >> fetcher.log 2>&1
```

> Replace `/usr/bin/node` with your actual Node.js path (`which node`) and `/path/to/maiquetia-flight-tracker` with your project directory.

### 6. Serve the Frontend

**Option A: Python (development)**
```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

**Option B: Nginx (production)**

Add to your Nginx config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/maiquetia-flight-tracker;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Security: block access to sensitive files
    location ~ /\. {
        deny all;
        return 404;
    }
    location ~* ^/(fetcher\.js|config\.json|package\.json)$ {
        deny all;
        return 404;
    }
}
```

---

## API Usage

The AirLabs free tier provides real-time airport schedules. Fetching every 15 minutes uses approximately:

- **~5,760 API calls/month** (2 calls every 15 minutes × 96 times/day × 30 days)
- This stays comfortably within most free tier limits

---

## Security

| Measure | Implementation |
|---|---|
| **API Key** | Stored in `.env`, never committed or served |
| **.env access** | Blocked by Nginx/Apache rules |
| **Backend scripts** | `fetcher.js` blocked from web access |
| **Config files** | `config.json` blocked from web access |

---

## Data Model

### Daily Archive (`data/YYYY-MM-DD.json`)

```json
{
  "meta": {
    "airport_iata": "CCS",
    "airport_icao": "SVMI",
    "airport_name": "Simón Bolívar International Airport",
    "city": "Maiquetía / Caracas",
    "country": "Venezuela",
    "date": "2026-04-22",
    "fetched_at": "2026-04-22T22:45:19.571Z",
    "arrivals_count": 27,
    "departures_count": 20
  },
  "arrivals": [ /* flight objects */ ],
  "departures": [ /* flight objects */ ]
}
```

### History Index (`data/history.json`)

```json
{
  "history": [
    {
      "date": "2026-04-22",
      "arrivals_count": 27,
      "departures_count": 20,
      "total_count": 47
    }
  ]
}
```

---

## Roadmap

- [ ] Add airline logos
- [ ] Add airport city names (not just IATA codes)
- [ ] Export data to CSV
- [ ] Add charts/graphs to History tab
- [ ] Support multiple airports
- [ ] Dockerize for easy deployment

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**Jose Gabriel Rivera Gagliano**

- Website: [https://www.jgrivera.com](https://www.jgrivera.com)
- GitHub: [@jgrivera](https://github.com/jgrivera)

Built with data from [AirLabs](https://airlabs.co/).
