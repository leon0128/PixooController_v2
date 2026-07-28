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
    │   └── Dockerfile
    └── api/               # NestJS + TypeORM
        ├── src/scenes/entities/
        ├── src/schedules/entities/
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
| Date / day-of-week / time / temperature display | `Draw/SendHttpItemList` | All four element types share this single command; an `ItemList` entry's numeric `type` field is what distinguishes them |

`ItemList.type` values confirmed via testing:

| `SceneElement.type` | Pixoo `type` code(s) |
| --- | --- |
| `time` | `5` |
| `day_of_week` | `14` |
| `temperature` | `17` |
| `date` | expands into three `ItemList` entries: `9` (month), `22` (separator), `8` (day) |

Each element's position, color, and font are mapped to `ItemList` fields such as `x` / `y` / `font` / `color` / `align`. `PicData` and `ItemList[].TextString` values themselves are opaque payloads (Base64 bitmap / device-internal placeholder text respectively) — the actual bitmap encoding is produced by the app's own image encoder when building each request.

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
        string type "date | day_of_week | time | temperature"
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

## API

Every route is served under the `/api` prefix, e.g. `http://localhost:3001/api/scenes`. The `NEXT_PUBLIC_API_URL` and `API_URL` variables handed to the web container already include that prefix, so the frontend appends the route directly (`` `${API_URL}/scenes` ``).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/scenes` | All scenes, each with its elements and image frames |
| `GET` | `/api/scenes/:id` | One scene with its elements and image frames |
| `POST` | `/api/scenes` | Create a scene together with its elements and image frames |
| `PUT` | `/api/scenes/:id` | Replace a scene wholesale; elements and frames absent from the body are deleted |
| `DELETE` | `/api/scenes/:id` | Delete a scene and everything referencing it |
| `GET` | `/api/schedules` | Every scene start marker, ordered by day then slot |
| `PUT` | `/api/schedules` | Replace the entire weekly schedule |

A scene and everything it owns is always written and read as one aggregate, in a single transaction.

Background frames travel as Base64 of a raw 64x64 RGB buffer — exactly the `PicData` string the device expects, so nothing is re-encoded on the way out. The API rejects any frame that does not decode to precisely 12288 bytes. Converting a PNG into that form is the browser's job; the API never handles image files. Frame order comes from the position in the `frames` array, so clients never assign indexes themselves.

- There is no `Device` table (as noted above, the device is discovered on the LAN right before every send instead)
- `Scene` itself carries no image-related fields. Background image loop settings live in `SceneImage` (at most one per scene — a scene is allowed to have no background image at all), and each individual frame lives in `SceneImageDetail`. Frame data is stored as a Base64 string (the same format `PicData` uses on the wire), not as raw bytes, since it can be forwarded to the device as-is

`SceneElement` holds every `ItemList` field that is configurable per element, except the following, which are fixed and therefore not persisted:

| `ItemList` field | Why it's excluded |
| --- | --- |
| `Command` | Always `Draw/SendHttpItemList` for every element type; not a per-scene setting |
| `TextId` | Assigned sequentially when the request is built; not a per-scene setting |
| `type` | Fixed per `SceneElement.type`: `time` → `5`, `day_of_week` → `14`, `temperature` → `17`; `date` expands into three fixed entries (`9` / `22` / `8`) |
| `TextString` | The displayed content is inherently determined by the element type (the device fills in the actual date/time/temperature value itself), so free text is not used |

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
- [ ] **Phase 4: Pixoo64 integration module**
  - Device discovery client (`FindDevice`)
  - Logic to build `CommandList` from scene settings
- [ ] **Phase 5: Scheduler implementation**
  - A 10-minute cron that resolves the active scene and sends commands to the Pixoo64
- [ ] **Phase 6: Next.js + shadcn frontend**
  - Scene editor screen, schedule management screen (a day-of-week x 10-minute timetable UI)
- [ ] **Phase 7: Integration testing & real-device verification**
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
docker compose up --build
```

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

### Networking note

The `api` container needs to reach both `app.divoom-gz.com` (for `FindDevice`) and the Pixoo64's private LAN address. Outbound traffic to both should work over Docker's default bridge network without extra configuration, but this has not been exercised yet — it gets confirmed in Phase 4, when the device client is actually implemented.
