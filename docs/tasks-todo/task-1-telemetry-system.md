# Telemetry System Implementation

## Background

Currently have no visibility into:

- How many users have installed Astro Editor
- Which versions are in use
- Update adoption rates

**Goal:** Implement privacy-focused, minimal telemetry to understand user base and version distribution.

## Requirements

**Privacy-First Principles:**

- Anonymous UUID only (no personal info, IP addresses, or identifiable data)
- Minimal data collection (version, app ID, event type, timestamp)
- No tracking of user content, files, or behavior within the app
- Piggyback on existing update check (expected network activity)

**No opt-out for now** - this is a single ping during update checks. Can add preference toggle later if needed.

**Data Collected:**

```typescript
{
  appId: 'astro-editor',      // Future-proof for other apps
  uuid: string,                // Anonymous identifier
  version: string,             // e.g., "0.1.32"
  event: 'update_check',       // Event type
  platform: 'macos',
  timestamp: string            // ISO 8601
}
```

**Endpoint:** `https://updateserver.dny.li/event` (Cloudflare Workers on dny.li domain)

**First Install Detection:** Inferred from database (first appearance of UUID = new user). No need to send separate event or track client-side.

## Prerequisites

Before starting:

- [ ] Verify existing commands work: `read_app_data_file`, `write_app_data_file` (src-tauri/src/commands/files.rs)
- [ ] Confirm app has access to version string (check package.json or Tauri config)
- [ ] Cloudflare account with Workers/D1 enabled

## Phase 1: In-App Implementation (Tauri)

### 1.1 Store UUID in App Data Directory

**Approach:** Use existing app data file commands (NOT preferences system)

**Storage location:**

```
/Users/danny/Library/Application Support/is.danny.astroeditor/telemetry.json
```

**File format:**

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-11-04T12:00:00Z"
}
```

**Implementation:**

Create `src/lib/telemetry.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core'

export async function getOrCreateTelemetryUuid(): Promise<string> {
  try {
    const content = await invoke<string>('read_app_data_file', {
      filePath: 'telemetry.json',
    })
    const data = JSON.parse(content)
    return data.uuid
  } catch {
    // File doesn't exist, create new UUID
    const uuid = crypto.randomUUID() // Built-in browser API
    const data = {
      uuid,
      created_at: new Date().toISOString(),
    }
    await invoke('write_app_data_file', {
      filePath: 'telemetry.json',
      content: JSON.stringify(data, null, 2),
    })
    return uuid
  }
}

export async function sendTelemetryEvent(version: string): Promise<void> {
  try {
    const uuid = await getOrCreateTelemetryUuid()

    const payload = {
      appId: 'astro-editor',
      uuid,
      version,
      event: 'update_check',
      platform: 'macos',
      timestamp: new Date().toISOString(),
    }

    // 5 second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      await fetch('https://updateserver.dny.li/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    // Fail silently - don't block user or show errors
    console.error('Telemetry event failed:', error)
  }
}
```

**No Rust changes needed** - use existing commands!

### 1.2 Integrate Telemetry into Update Check

**File:** `src/App.tsx` (update check logic around lines 13-65)

**Current flow:**

1. `checkForUpdates()` called 5s after startup (and manually via menu)
2. Calls `check()` from `@tauri-apps/plugin-updater`
3. Shows dialog if update available
4. Downloads and installs if user accepts

**New flow:**

1. `checkForUpdates()` called 5s after startup (or manually)
2. **NEW:** Send telemetry event (non-blocking, fails silently)
3. Call `check()` from updater (existing behavior)
4. Continue with existing update logic

**Implementation:**

Modify `src/App.tsx`:

```typescript
// Add import at top
import { sendTelemetryEvent } from './lib/telemetry'
import { getVersion } from '@tauri-apps/api/app'

// Modify checkForUpdates function:
const checkForUpdates = async (): Promise<boolean> => {
  try {
    // NEW: Send telemetry before update check (non-blocking)
    const version = await getVersion()
    sendTelemetryEvent(version).catch(() => {
      // Silently ignore telemetry failures - don't block update check
    })

    // Existing update check logic continues unchanged...
    const update = await check()
    if (update) {
      // ... existing code
    }
  } catch (checkError) {
    // ... existing error handling
  }
}
```

**Files to create/modify:**

- **NEW:** `src/lib/telemetry.ts`
- **MODIFY:** `src/App.tsx` (add imports and telemetry call)

### 1.3 Local Testing Plan

Before deploying the worker, test the integration:

**Option 1: Mock Server**

```bash
# Create simple test server
npx http-server -p 8080 --cors

# Update telemetry.ts temporarily to use localhost:8080/event
```

**Option 2: Mock in Tests**

```typescript
// In tests, mock the fetch call
global.fetch = vi.fn(() => Promise.resolve({ ok: true }))
```

**Test Checklist:**

- [ ] Test UUID generation on fresh install (delete telemetry.json first)
- [ ] Test UUID persistence across app restarts
- [ ] Test telemetry send with mock endpoint
- [ ] Test graceful failure when endpoint unreachable
- [ ] Test that update check still works if telemetry fails
- [ ] Verify no performance impact on startup

## Phase 2: Backend (Cloudflare Worker + D1)

### 2.1 D1 Database Schema

Create `schema.sql`:

```sql
CREATE TABLE telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  uuid TEXT NOT NULL,
  version TEXT NOT NULL,
  event TEXT NOT NULL,
  platform TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Essential indexes only (add more as query patterns emerge)
CREATE INDEX idx_uuid ON telemetry_events(uuid);
CREATE INDEX idx_created_at ON telemetry_events(created_at);
```

**Rationale:**

- `uuid` - for counting unique users
- `created_at` - for time-series queries
- Can add `app_id`, `version`, `event` indexes later if needed

### 2.2 Cloudflare Worker Implementation

Create `worker.js`:

```javascript
export default {
  async fetch(request, env) {
    // Only accept POST to /event
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const url = new URL(request.url)
    if (url.pathname !== '/event') {
      return new Response('Not found', { status: 404 })
    }

    try {
      // Parse and validate payload
      const payload = await request.json()
      const { appId, uuid, version, event, platform, timestamp } = payload

      if (!appId || !uuid || !version || !event || !platform || !timestamp) {
        return new Response('Missing required fields', { status: 400 })
      }

      // Insert into D1
      await env.DB.prepare(
        `INSERT INTO telemetry_events (app_id, uuid, version, event, platform, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(appId, uuid, version, event, platform, timestamp)
        .run()

      return new Response('OK', { status: 200 })
    } catch (error) {
      console.error('Error processing telemetry event:', error)
      return new Response('Internal server error', { status: 500 })
    }
  },
}
```

Create `wrangler.toml`:

```toml
name = "astro-telemetry"
main = "worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "astro-telemetry"
database_id = "<INSERT_DATABASE_ID_HERE>"
```

Create `package.json`:

```json
{
  "name": "astro-telemetry-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
```

### 2.3 Cloudflare Deployment Steps

1. **Create D1 database:**

   ```bash
   wrangler d1 create astro-telemetry
   # Copy the database_id from output into wrangler.toml
   ```

2. **Run migrations:**

   ```bash
   wrangler d1 execute astro-telemetry --file=schema.sql
   ```

3. **Test locally:**

   ```bash
   wrangler dev
   # Test with: curl -X POST http://localhost:8787/event -H "Content-Type: application/json" -d '{"appId":"astro-editor","uuid":"test-uuid","version":"0.1.32","event":"update_check","platform":"macos","timestamp":"2025-11-04T12:00:00Z"}'
   ```

4. **Deploy worker:**

   ```bash
   wrangler deploy
   ```

5. **Configure custom domain:**
   - In Cloudflare dashboard, go to Workers & Pages
   - Select your worker
   - Add custom domain: `updateserver.dny.li`

**Cloudflare Free Tier:**

- Workers: 100k requests/day (we'll use ~100/day)
- D1: 5GB storage, 5M reads/day, 100k writes/day (we'll use ~100 writes/day)
- **Cost: $0**

### 2.4 Data Access & Querying

**Common Queries:**

```bash
# Total unique users
wrangler d1 execute astro-telemetry --command "
  SELECT COUNT(DISTINCT uuid) as total_users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
"

# Users per version
wrangler d1 execute astro-telemetry --command "
  SELECT version, COUNT(DISTINCT uuid) as users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
  GROUP BY version
  ORDER BY version DESC
"

# Daily active users (last 30 days)
wrangler d1 execute astro-telemetry --command "
  SELECT DATE(created_at) as date, COUNT(DISTINCT uuid) as users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
    AND event = 'update_check'
    AND created_at >= datetime('now', '-30 days')
  GROUP BY DATE(created_at)
  ORDER BY date DESC
"

# New users this week (first seen UUIDs)
wrangler d1 execute astro-telemetry --command "
  SELECT COUNT(DISTINCT uuid) as new_users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
    AND uuid IN (
      SELECT uuid FROM telemetry_events
      GROUP BY uuid
      HAVING MIN(created_at) >= datetime('now', '-7 days')
    )
"
```

**Export for analysis:**

```bash
wrangler d1 execute astro-telemetry --command "SELECT * FROM telemetry_events" --json > telemetry-export.json
```

### 2.5 Monitoring

- Monitor worker errors in Cloudflare dashboard
- Set up email alerts for worker failures (Cloudflare notifications)
- Data retention: Keep forever (dataset will be tiny, maybe 1000 rows/year)

### 2.6 Testing Checklist

- [ ] Local wrangler dev testing with curl
- [ ] Verify D1 inserts work locally
- [ ] Test invalid payloads (missing fields, malformed JSON)
- [ ] Deploy to production and test with real app
- [ ] Verify queries return expected data
- [ ] Set up monitoring alerts

## Success Metrics

After implementation, we can answer:

- How many unique users have installed Astro Editor?
- What versions are people running?
- How quickly do users update to new versions?
- Approximately how often is the app being used? (via update check frequency)

## Acceptance Criteria

**Phase 1 Complete:** ✅

- [x] UUID generated and stored in app data on first launch
- [x] Telemetry event sent during update check
- [x] App functions normally if telemetry endpoint fails
- [x] No performance impact on app startup or update checks
- [x] Tests written and passing

**Phase 2 Complete:** ✅

- [x] Cloudflare Worker deployed to updateserver.dny.li
- [x] D1 database created and schema applied
- [x] Worker accepts POST to /event and stores data
- [x] Can query data via wrangler CLI
- [x] Custom domain configured (DNS propagation in progress)

**Bug Fix:**
- [x] Fixed `validate_app_data_path` to handle relative file paths (like `telemetry.json`)
- [x] Telemetry now works correctly for both new and existing installations

**Phase 2 Files Created:**

- [x] `telemetry-worker/worker.js` - Cloudflare Worker with event endpoint
- [x] `telemetry-worker/schema.sql` - D1 database schema
- [x] `telemetry-worker/wrangler.toml` - Wrangler configuration
- [x] `telemetry-worker/package.json` - Dependencies and scripts
- [x] `telemetry-worker/README.md` - Comprehensive documentation
- [x] `telemetry-worker/DEPLOYMENT.md` - Quick deployment guide

## Implementation Notes

- Keep telemetry code isolated and testable
- All HTTP calls must be async and non-blocking
- Log failures at error level but never show to user
- CORS not needed (Tauri app, not browser)
- Send telemetry on every update check (gives better "last seen" data)

## Future Enhancements

Consider later (not in scope for initial implementation):

- Opt-out preference in Settings
- Additional events (crash reports, feature usage)
- Simple dashboard UI at /dashboard
- Show anonymous ID in About screen
