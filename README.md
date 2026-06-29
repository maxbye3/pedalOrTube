# Bike + Metro DC

A multimodal journey planner for Washington, DC that intelligently combines cycling with Metro transit.

The defining feature is a **Bike Preference Slider** that lets you decide how much of your journey you want to bike, while the app automatically determines the optimal Metro stations and route.

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Main app page
│   ├── globals.css           # Global styles (Tailwind + MapLibre)
│   └── api/
│       ├── geocode/          # Photon geocoding proxy
│       ├── route/            # OTP routing + JourneyCalculator
│       ├── weather/          # NWS weather proxy
│       └── bikeshare/        # Capital Bikeshare GBFS proxy
├── components/
│   ├── Map.tsx               # MapLibre GL JS map (browser-only)
│   ├── MapWrapper.tsx        # Dynamic import wrapper (no SSR)
│   ├── SearchPanel.tsx       # From/To inputs + search button
│   ├── Autocomplete.tsx      # Relevance-ranked autocomplete
│   ├── BikeSlider.tsx        # 0–100% bike preference slider
│   ├── JourneySummary.tsx    # Route details display
│   └── WeatherWidget.tsx     # NWS weather warnings
├── services/
│   ├── RoutingService.ts     # OTP2 GraphQL client
│   ├── JourneyCalculator.ts  # Slider ranking + candidate logic
│   ├── GeocodingService.ts   # Photon geocoding
│   ├── WeatherService.ts     # NWS API
│   ├── BikeShareService.ts   # Capital Bikeshare GBFS
│   ├── ElevationService.ts   # USGS 3DEP elevation
│   ├── HistoryService.ts     # localStorage ride history (200 cap)
│   ├── SavedLocationsService.ts  # localStorage saved places
│   └── AppSettingsService.ts # localStorage settings
├── types/
│   └── index.ts              # All shared TypeScript types
└── lib/
    └── utils.ts              # Helpers (distance, format, polyline decode)
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### 3. Set up OpenTripPlanner (OTP2)

OTP is the routing engine. It must be running locally (or at a configured URL).

The app uses the **GTFS GraphQL API** at `http://localhost:8080/otp/gtfs/v1`. You can explore queries interactively at `http://localhost:8080/graphiql` once OTP is running.

#### 3a. Get a free WMATA API key

WMATA requires a free API key to download their GTFS schedule data.

1. Register at **https://developer.wmata.com**
2. Subscribe to the **Default Tier** (free, no credit card)
3. Copy your **Primary Key**

#### 3b. Download data files

```bash
mkdir otp-data

# DC street map from OpenStreetMap (~16 MB)
curl -L https://download.geofabrik.de/north-america/us/district-of-columbia-latest.osm.pbf \
  -o otp-data/dc.osm.pbf

# WMATA Rail GTFS (Metro lines)
curl -H "api_key: YOUR_API_KEY" \
  https://api.wmata.com/gtfs/rail-gtfs-static.zip \
  -o otp-data/wmata-rail.gtfs.zip

# WMATA Bus GTFS (optional — only needed if you enable Metrobus in the app)
curl -H "api_key: YOUR_API_KEY" \
  https://api.wmata.com/gtfs/bus-gtfs-static.zip \
  -o otp-data/wmata-bus.gtfs.zip
```

#### 3c. Start OTP with Docker

```bash
docker run --rm \
  -e JAVA_TOOL_OPTIONS='-Xmx4g' \
  -v "$(pwd)/otp-data:/var/opentripplanner" \
  -p 8080:8080 \
  opentripplanner/opentripplanner:latest \
  --build --serve
```

The first run builds a routing graph from the downloaded files. **This takes 2–4 minutes.**
You'll see `Started OpenTripPlanner...` when it's ready.

> **Note:** The OTP image is published on Docker Hub (`opentripplanner/opentripplanner`), not GitHub Container Registry. If you previously used `ghcr.io/opentripplanner/opentripplanner`, switch to the Docker Hub reference above.

Verify it's working: open http://localhost:8080/otp/gtfs/v1 — you should see a GraphQL response.

OTP will be available at `http://localhost:8080`.

### 4. Set up geocoding (Photon)

**Option A — use Komoot's public Photon instance** (easiest, rate-limited):
Leave `NEXT_PUBLIC_PHOTON_URL` unset — the app defaults to `https://photon.komoot.io`.

**Option B — self-host Photon** (recommended for production):
```bash
docker run --rm -p 2322:2322 \
  -v photon-data:/photon/photon_data \
  komoot/photon:latest
```
Then set `NEXT_PUBLIC_PHOTON_URL=http://localhost:2322`.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. (Optional) Run the app with Docker

Build and start the Next.js app in a container:

```bash
docker build -t metro-bike-dc .
docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_OTP_URL=http://host.docker.internal:8080 \
  metro-bike-dc
```

> `host.docker.internal` lets the container reach OTP running on your host machine.
> On Linux you may need `--add-host=host.docker.internal:host-gateway` instead.

---

## Data Sources (all free)

| Data | Source | Usage |
|------|--------|-------|
| Street maps | OpenStreetMap / OpenFreeMap | Map tiles, bike routing |
| Transit | WMATA GTFS | Metro/bus routing via OTP |
| Geocoding | Photon (Komoot) | Address autocomplete |
| Elevation | USGS 3DEP | Elevation profiles |
| Bike lanes | DC Open Data | Bike lane quality score |
| Crash data | DC Open Data | Safety warnings |
| Weather | National Weather Service | Cycling weather warnings |
| Bike share | Capital Bikeshare GBFS | Station availability |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_OTP_URL` | `http://localhost:8080` | OpenTripPlanner base URL |
| `NEXT_PUBLIC_PHOTON_URL` | `https://photon.komoot.io` | Photon geocoding base URL |

---

## How the Bike Preference Slider Works

1. **Search runs once** — when you press Find Route, the app queries OTP for:
   - A pure bike route
   - Up to 5 bike+Metro itineraries
   - (Optional) Up to 3 bike+bus itineraries
   All queries run in parallel.

2. **Discard rules** filter out trivial transit hops:
   - Metro: discard if ≤ 1 stop (i.e. boarding and alighting at adjacent stations)
   - Bus: discard if < 4 stops

3. **Slider re-ranks instantly** — moving the slider sorts the already-computed
   candidate list by how close each itinerary's bike percentage is to your
   slider value. No new network requests.

4. **No-candidate fallback** — if no transit option clears the discard bar,
   the app shows the bike-only route with an explanatory message.

---

## MVP Scope

**Phase 1 (current):**
- From/To search with geocoding autocomplete
- Bike Preference Slider with live re-ranking
- Journey summary (time, distance, transfers, elevation, calories, CO₂)
- Interactive MapLibre map with per-mode colored route segments
- Saved locations + ride history (localStorage)
- Weather warnings (NWS)

**Phase 2 (planned):**
- Live Metro arrivals (WMATA GTFS-RT)
- Capital Bikeshare integration
- Full elevation profile graph
- Bike lane quality score display
- Incline-aware station split

**Phase 3 (future):**
- Multiple cities
- User accounts + cloud sync
- Apple Watch / Wear OS
