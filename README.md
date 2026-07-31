# PixooController_v2

A web application for managing what is displayed on a Divoom Pixoo64 (a 64x64 pixel dot-matrix display) from a browser.

Display content is defined in units called **Scenes**, each combining a background image with date, day-of-week, temperature, and time overlays. A per-day-of-week **Schedule** (in 10-minute increments) determines which scene is pushed to the Pixoo64 automatically.

## Key Features

- **Scene management**: configure a background (64x64, multiple images) plus which elements (date / day of week / temperature / time) to show, along with their position, color, and font
- **Background image loop**: multiple background images are cycled like a GIF at a configurable interval
- **Schedule management**: assign a scene to each day of the week, in 10-minute increments
- **Automatic reflection**: the app pushes the scheduled scene to the Pixoo64 automatically once the corresponding time slot begins

## Assumptions & Constraints

- Only a single Pixoo64 device is managed
- No authentication (assumes personal use on a local home network only)
- Background images are prepared by the user at 64x64 already and uploaded as-is (no server-side resizing)

## Tech Stack

Everything runs in containers.

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 + shadcn/ui (Tailwind v4) |
| Backend | NestJS 11 |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL 17 |

## Project Structure

```
.
├── docker-compose.yml     # web / api / db
├── .env.example           # compose settings (credentials, host ports)
└── apps/
    ├── web/               # Next.js + shadcn/ui
    │   ├── src/app/       # routes: /scenes, /scenes/[id], /schedules
    │   ├── src/components/
    │   ├── src/lib/       # API client, PicData conversion
    │   └── Dockerfile
    └── api/               # NestJS + TypeORM
        ├── src/scenes/           # scene aggregate CRUD
        ├── src/schedules/        # weekly schedule + resolution
        ├── src/scheduler/        # the 10-minute cron
        ├── src/pixoo/            # device discovery and command building
        ├── src/database/         # DataSource + migrations
        └── Dockerfile
```

## Architecture

### Communicating with the Pixoo64

The Pixoo64 handles displaying the date, day of week, time, and temperature, as well as looping through multiple background images, **natively on the device itself**. Because of this, the backend only needs to do the following:

1. Once it determines which scene should be active, build the corresponding Pixoo64 Control API command(s) from that scene's configuration (background images and each element's position/color/font)
2. Clear whatever the previous scene left on the device (`Draw/ClearHttpText`, `Draw/ResetHttpGifId`), then send the new scene's command(s) to the Pixoo64

After a single send, the device continues to advance the clock, refresh the temperature, and loop the background images on its own. There is **no need for the backend to continuously re-render and re-send frames**. The only thing the backend does proactively is evaluate the schedule every 10 minutes and send a command when needed.

### Handling of Device Information

The Pixoo64's IP address and other device information are not persisted in the database. Immediately before sending a command, the app calls the Device Discovery API (`FindDevice`) to find the device on the local network, and sends the Control API request to the discovered IP address.

```mermaid
sequenceDiagram
    participant Scheduler as NestJS Scheduler (every 10 min)
    participant Divoom as app.divoom-gz.com (FindDevice)
    participant Pixoo as Pixoo64 (on LAN)

    Scheduler->>Scheduler: Resolve the active scene from the current day of week and time slot
    Scheduler->>Divoom: FindDevice (discover the device on the same LAN)
    Divoom-->>Scheduler: DevicePrivateIP
    Scheduler->>Pixoo: POST /post (Draw/SendHttpGif, Draw/SendHttpItemList)
    Pixoo-->>Scheduler: { error_code: 0 }
    Note over Pixoo: From here on, the Pixoo64 autonomously handles clock updates, image looping, and temperature refresh
```

### Building Commands

The main commands have been verified against the real device with Postman. Scene settings are mapped onto the Pixoo64 Control API as follows.

| Scene setting | Command | Notes |
| --- | --- | --- |
| Background images (multiple, loop interval) | `Draw/SendHttpGif` | Uses `PicNum` / `PicWidth` / `PicOffset` / `PicID` / `PicSpeed` / `PicData` |
| Date / weekday / time / sensor / text display | `Draw/SendHttpItemList` | Every element type shares this one command; an `ItemList` entry's numeric `type` field is what distinguishes them |

All 23 [display types](http://doc.divoom-gz.com/web/#/12?page_id=234) are supported. `SceneElement.type` is named after Divoom's own `DIVOOM_DISP_CUSTOM_DIAL_SUPPORT_*` constants, and the numeric `ItemList.type` is derived when the request is built:

| Group | `SceneElement.type` → code |
| --- | --- |
| Time | `second` 1, `minute` 2, `hour` 3, `am_pm` 4, `hour_minute` 5, `hour_minute_second` 6 |
| Date | `year` 7, `day` 8, `month` 9, `month_year` 10, `english_month_day` 11, `day_month_year` 12, `english_month` 16 |
| Weekday | `weekday_short` 13, `weekday_medium` 14, `weekday_long` 15 |
| Sensors | `temperature` 17, `temperature_max` 18, `temperature_min` 19, `weather` 20, `noise` 21 |
| Custom | `text` 22, `url_text` 23 |

The device produces the value for every type except the last two, which display what the element carries in its own `text` field: a literal string for `text`, and for `url_text` a URL the device polls every `update_time` seconds, reading a `DispData` string out of the JSON it gets back. `text` is required for those two and rejected for every other type, where it is dropped rather than stored — which is why `TextString` is only sent for those two.

A font has to actually contain the characters a type renders — digits for a clock, letters for a weekday, `c`/`f` for a temperature — so the font picker shows each font's charset.

Each element's position, color and font map onto the `ItemList` fields `x` / `y` / `font` / `color` / `align`.

## Data Model (Overview)

```mermaid
erDiagram
    Scene ||--o| SceneImage : "background image loop settings"
    SceneImage ||--o{ SceneImageDetail : "frames"
    Scene ||--o{ SceneElement : "display elements"
    Scene ||--o{ Schedule : "assignment"

    Scene {
        int id PK
        string name
    }

    SceneImage {
        int id PK
        int scene_id FK "UNIQUE"
        int pic_speed "background image loop interval (Draw/SendHttpGif.PicSpeed)"
    }

    SceneImageDetail {
        int id PK
        int scene_image_id FK
        int frame_index "loop order (PicOffset); UNIQUE with scene_image_id"
        text image_data "64x64 image data, Base64-encoded (PicData)"
    }

    SceneElement {
        int id PK
        int scene_id FK
        string type "one of 23 display types"
        varchar text "TextString; only for the text and url_text types"
        int x
        int y
        int dir
        int font
        int text_width "ItemList.TextWidth"
        int text_height "ItemList.Textheight"
        int speed
        string color
        int update_time
        int align
    }

    Schedule {
        int id PK
        smallint day_of_week "0-6; UNIQUE with slot"
        smallint slot "0-143 (10-minute increments, 144 slots per day)"
        int scene_id FK
    }
```

Every table also carries `created_at` / `updated_at`. Columns are `snake_case` in the database and `camelCase` on the TypeScript entities, bridged by TypeORM's `SnakeNamingStrategy`.

`frame_index` is named that way rather than `order` because `ORDER` is a reserved SQL word and would need quoting in every hand-written query.

Constraints enforced at the database level:

| Constraint | Table |
| --- | --- |
| `UNIQUE (day_of_week, slot)` — one scene per slot | `schedules` |
| `CHECK (day_of_week BETWEEN 0 AND 6)`, `CHECK (slot BETWEEN 0 AND 143)` | `schedules` |
| `UNIQUE (scene_image_id, frame_index)` — no duplicate loop positions | `scene_image_details` |
| `UNIQUE (scene_id)` — at most one image config per scene | `scene_images` |
| `ON DELETE CASCADE` from `scenes` — deleting a scene removes its image, frames, elements and schedules | all |

### How a schedule is interpreted

A `schedules` row records only where a scene **starts**. It has no end: a scene runs until the next entry on the weekly timeline, which is treated as a single loop — the slot before Sunday 00:00 is Saturday 23:50. One entry anywhere is therefore enough to cover the whole week, and playback never has a gap. An empty table simply means nothing is scheduled.

Days and slots are wall-clock local time. The `api` container therefore runs on `TZ` (default `Asia/Tokyo`) rather than UTC.

## Scheduler

A cron in the API evaluates the schedule every 10 minutes, on the slot boundary.

- It sends a scene **only when the active one changes**. The device keeps animating, ticking the clock and refreshing the temperature by itself, so re-sending an unchanged scene would just restart its loop from the first frame.
- If nothing is scheduled, the display is left as-is rather than cleared.
- A failed push is not recorded as sent, so the next tick retries it. A scene deleted out from under the scheduler is logged and skipped rather than crashing the job.
- Editing a scene or the schedule does not push anything by itself — use `POST /api/scenes/:id/push` to see a change immediately, or wait for the next tick.

## API

Every route is served under the `/api` prefix, e.g. `http://localhost:3001/api/scenes`. The `NEXT_PUBLIC_API_URL` and `API_URL` variables handed to the web container already include that prefix, so the frontend appends the route directly (`` `${API_URL}/scenes` ``).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/scenes` | All scenes, each with its elements and image frames |
| `GET` | `/api/scenes/:id` | One scene with its elements and image frames |
| `POST` | `/api/scenes` | Create a scene together with its elements and image frames |
| `PUT` | `/api/scenes/:id` | Replace a scene wholesale; elements and frames absent from the body are deleted |
| `DELETE` | `/api/scenes/:id` | Delete a scene and everything referencing it |
| `POST` | `/api/scenes/:id/push` | Play a stored scene on the device now |
| `POST` | `/api/scenes/preview` | Render ad-hoc scene content on the device without saving it |
| `GET` | `/api/fonts` | The fonts an element can be rendered in |
| `GET` | `/api/schedules` | Every scene start marker, ordered by day then slot |
| `PUT` | `/api/schedules` | Replace the entire weekly schedule |

A scene and everything it owns is always written and read as one aggregate, in a single transaction.

## Web UI

| Route | Purpose |
| --- | --- |
| `/scenes` | Every scene, with a button to play each one on the device |
| `/scenes/new`, `/scenes/[id]` | Edit a scene's name, background frames and elements |
| `/schedules` | Weekday x 10-minute grid; click a cell to place a scene's start time |

Reads happen in server components and go over the compose network; the browser only talks to the API for writes, previews and pushes. The API client picks `API_URL` when it runs on the server and falls back to `NEXT_PUBLIC_API_URL` in the browser.

Uploaded images are converted to `PicData` in the browser — decoded onto a canvas, stripped of the alpha channel and Base64-encoded — so the API only ever sees the exact string it forwards to the device. Anything that is not exactly 64x64 is rejected rather than rescaled, which would wreck pixel art.

An element's font is a numeric id the device understands. `/api/fonts` proxies Divoom's catalogue (`https://appin.divoom-gz.com/Device/GetTimeDialFont`) so the editor can describe each one instead of asking for a bare number, and caches the result for an hour since the catalogue does not change.

That endpoint returns each font as a comma-separated string rather than an object:

```
"232,1,11,20,group1/M00/14/65/eEwpPWMtHhCE7719579,0123456789:"
   id type  w  h  asset path                       charset
```

There are **no font names** in it, so the picker identifies a font by what actually distinguishes it — its size and the characters it can render:

```
#232 · 11x20 · 0123456789:
#18 · 5x5 · 0123456789km-/:%cfABCDEFGHIJKLMN…
#2 · 16x16 · image font
```

The charset may itself contain a comma, so it is parsed as everything past the asset path rather than as a single field. Entries that do not parse are dropped instead of failing the whole catalogue. If the catalogue is unreachable the editor falls back to a plain numeric **Font ID** input, and an id that is not in the list always stays selectable, so no existing scene is silently changed.

The editor's preview is a magnified 64x64 canvas with the elements drawn as labelled boxes. It shows **placement only**: the device renders text with its own bitmap fonts and substitutes the live values, so the real appearance has to be checked with "Preview on device".

The schedule grid colours each slot by the scene playing in it, following the same wrapping rule as the API, so a single start marker visibly fills the whole week.

## Command sequence

Pushing a scene takes four steps:

| # | Step | Request |
| --- | --- | --- |
| 1 | Resolve the device address | `FindDevice` against `app.divoom-gz.com` |
| 2 | Clear both layers | `Draw/ClearHttpText` + `Draw/ResetHttpGifId` |
| 3 | Send the background | one `Draw/SendHttpGif` per frame |
| 4 | Send the text | a single `Draw/SendHttpItemList` |

Steps 2–4 are each one POST to the device, batched into a [`Draw/CommandList`](http://doc.divoom-gz.com/web/#/12?page_id=241):

```json
{
  "Command": "Draw/CommandList",
  "CommandList": [
    { "Command": "Draw/SendHttpGif", "PicNum": 2, "PicWidth": 64, "PicOffset": 0, "PicID": 0, "PicSpeed": 500, "PicData": "..." },
    { "Command": "Draw/SendHttpGif", "PicNum": 2, "PicWidth": 64, "PicOffset": 1, "PicID": 0, "PicSpeed": 500, "PicData": "..." }
  ]
}
```

Each animation frame stays its own entry — the device reassembles the loop from `PicNum` and `PicOffset` — but all the frames travel in the one background request. A step with nothing to send is skipped, so a scene with no elements makes two device requests rather than three.

A 60-frame background makes that request about 1 MB, so the API raises its own JSON body limit to 2 MB; the stock 100 KB would reject anything past six frames.

### Request interval

The device answers a request before it has finished applying it. Send the text too soon after an animation and the display can end up showing only the animation, as if the text were overwritten once playback started. `PIXOO_REQUEST_INTERVAL_MS` (default 500) is the pause left between consecutive device requests; `0` disables it.

Two related settings come from measuring the real device:

- `PIXOO_REQUEST_TIMEOUT_MS` (default 30000) — how long to wait for an answer. The device works through a request before replying, and that scales with the payload: 10 frames take about 1.3 s, 30 frames 3.5 s, and 60 frames 6.1 s. A 5-second timeout would fail every scene past roughly 48 frames.
- Each command is attempted up to three times, two seconds apart. After accepting a large animation the device goes unresponsive for several seconds while it renders, and no fixed delay reliably avoids that window — a 0 ms gap succeeded where 500 ms and 1500 ms timed out. Retrying is safe because every command sets state rather than accumulating it. A non-zero `error_code` is a real rejection and is never retried.

```bash
PIXOO_REQUEST_INTERVAL_MS=1000 docker compose up -d api
```

The debug log names each step and stamps milliseconds, so the actual spacing is visible:

```
13:54:13.569 DEBUG [clear]    POST http://192.168.0.203:80/post ...
13:54:14.134 DEBUG [image]    POST http://192.168.0.203:80/post ...
13:54:14.945 DEBUG [elements] POST http://192.168.0.203:80/post ...
```

Background frames travel as Base64 of a raw 64x64 RGB buffer — exactly the `PicData` string the device expects, so nothing is re-encoded on the way out. The API rejects any frame that does not decode to precisely 12288 bytes. Converting a PNG into that form is the browser's job; the API never handles image files. Frame order comes from the position in the `frames` array, so clients never assign indexes themselves.

- There is no `Device` table (as noted above, the device is discovered on the LAN right before every send instead)
- `Scene` itself carries no image-related fields. Background image loop settings live in `SceneImage` (at most one per scene — a scene is allowed to have no background image at all), and each individual frame lives in `SceneImageDetail`. Frame data is stored as a Base64 string (the same format `PicData` uses on the wire), not as raw bytes, since it can be forwarded to the device as-is

`SceneElement` holds every `ItemList` field that is configurable per element, except the following, which are fixed and therefore not persisted:

| `ItemList` field | Why it's excluded |
| --- | --- |
| `Command` | Always `Draw/SendHttpItemList` for every element type; not a per-scene setting |
| `TextId` | Assigned sequentially when the request is built; not a per-scene setting |
| `type` | Fixed per `SceneElement.type` — see the mapping table above |
| `TextString` | Stored as `text`, but only for the `text` and `url_text` types; for the rest the device supplies the value |

## Development Roadmap

- [x] **Phase 0: Finalize design**
  - [x] Define the mapping between scene settings and `ItemList` fields
  - [x] Verify the main commands (`Draw/SendHttpGif`, `Draw/SendHttpItemList`, etc.) against the real device via Postman
  - [x] Choose an ORM: TypeORM
- [x] **Phase 1: Docker foundation**
  - [x] Scaffold the Next.js (+ shadcn/ui) and NestJS (+ TypeORM) apps under `apps/`
  - [x] `docker-compose.yml` (web / api / db) and per-app Dockerfiles
- [x] **Phase 2: DB schema & migrations**
  - [x] Scene / SceneImage / SceneImageDetail / SceneElement / Schedule entities
  - [x] Initial migration, applied and verified against the running database
- [x] **Phase 3: NestJS API implementation**
  - [x] Scene aggregate CRUD (scene + elements + image loop in one operation)
  - [x] Weekly schedule replace
  - [x] Request validation, including `PicData` size checks
- [x] **Phase 4: Pixoo64 integration module**
  - [x] Device discovery client (`FindDevice`)
  - [x] Logic to build device commands from scene settings
  - [x] Push and preview endpoints
- [x] **Phase 5: Scheduler implementation**
  - [x] Weekly-timeline resolution, wrapping across days and the week boundary
  - [x] 10-minute cron that pushes only when the active scene changes
- [x] **Phase 6: Next.js + shadcn frontend**
  - [x] Scene list, with per-scene push to the device
  - [x] Scene editor: image frames, elements, and a magnified 64x64 placement preview
  - [x] Schedule screen: a weekday x 10-minute grid, edited through a dialog
- [x] **Phase 7: Integration testing & real-device verification**
  - [x] End-to-end scenario, error handling, boundaries and a clean-environment rebuild
  - [x] Scheduler auto-push verified against the real device
- [ ] **Phase 8: Wrap-up**

## Setup

### Prerequisites

Docker with Compose v2 — either [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [OrbStack](https://orbstack.dev/).

```bash
brew install --cask docker
```

### Running

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api npm run migration:run
```

The migration step is required on a fresh database — the app does not create its own schema, so without it every page fails with a 500 until the tables exist.

| Service | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| DB | `postgresql://pixoo:pixoo@localhost:5432/pixoo` |

Ports and database credentials are configurable via `.env` — see `.env.example`. If a PostgreSQL is already running natively on the host, either stop it or set `DB_PORT` to a free port; only the host-side mapping changes, since within the compose network the database is always `db:5432`.

All three services run in development mode with hot reload, and `apps/web` and `apps/api` are bind-mounted into their containers, so source edits apply without a rebuild. Re-run with `--build` only when dependencies or a Dockerfile change.

`node_modules` lives in a container-local volume rather than being shared with the host, so the container is unaffected by a host-side `npm install` built for a different platform. Compose keeps that volume when it recreates a container, so after changing dependencies rebuild *and* renew it:

```bash
docker compose up -d --build --renew-anon-volumes api
```

### Database migrations

TypeORM runs with `synchronize: false`, so the schema only ever changes through migrations. Run them inside the container, where `DATABASE_URL` already points at `db`:

```bash
docker compose exec api npm run migration:run
```

After editing an entity, generate the migration by diffing the entities against the live database, then apply it:

```bash
docker compose exec api npm run migration:generate -- src/database/migrations/YourChange
```

`migration:revert` rolls back the most recent migration and `migration:show` lists what has been applied. Entities live under `src/<feature>/entities/`, migrations under `src/database/migrations/`.

### Debug logging

Every request to the device is logged at `debug` level with its body and the response it got back. Timestamps are stamped to the millisecond (`YYYY-MM-DD HH:mm:ss.SSS`), which is fine enough to separate the burst of requests a single push produces and to see how long each one took.

```
2026-07-30 00:29:42.240 DEBUG [PixooDeviceClient] POST http://192.168.0.203:80/post {"Command":"Draw/SendHttpGif","PicNum":3,"PicWidth":64,"PicOffset":0,"PicID":0,"PicSpeed":400,"PicData":"(Base64 image data)"}
2026-07-30 00:29:42.396 DEBUG [PixooDeviceClient] Draw/SendHttpGif <- {"error_code":0}
```

`PicData` is stood in for rather than printed: a frame is 16 KB of Base64 that tells you nothing when read, and it would bury the fields that are actually worth checking. Everything else goes out in full.

To silence the request log, drop `debug` from the log levels in `main.ts`:

```ts
logger: new MillisecondConsoleLogger({ logLevels: ['log', 'warn', 'error'] }),
```

### Networking note

The `api` container needs to reach both `app.divoom-gz.com` (for `FindDevice`) and the Pixoo64's private LAN address. Outbound traffic to both should work over Docker's default bridge network without extra configuration, but this has not been exercised yet — it gets confirmed in Phase 4, when the device client is actually implemented.
