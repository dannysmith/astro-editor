# Astro Editor Telemetry Worker

Cloudflare Worker for collecting anonymous telemetry from Astro Editor.

**Privacy-focused**: Only collects anonymous UUIDs with minimal metadata (version, event type, platform).

## Quick Start

```bash
cd telemetry-worker
pnpm install

# Create database and copy the database_id to wrangler.toml
pnpm run d1:create

# Run migrations
pnpm run d1:migrate

# Test locally (in separate terminals)
pnpm run dev
pnpm run test:local

# Deploy
pnpm run deploy
```

**Configure custom domain**: In Cloudflare dashboard → Workers & Pages → astro-telemetry → Settings → Domains & Routes → Add `updateserver.dny.li`

## Prerequisites

- Cloudflare account (free tier sufficient)
- `wrangler` installed: `pnpm install -D wrangler`
- Authenticated: `pnpm wrangler login`

## Data Format

```json
{
  "appId": "astro-editor",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "version": "0.1.32",
  "event": "update_check",
  "platform": "macos",
  "timestamp": "2025-11-05T12:00:00.000Z"
}
```

## Available Scripts

```bash
pnpm run dev              # Start local dev server
pnpm run deploy           # Deploy to production
pnpm run tail             # View live logs
pnpm run test:local       # Test local endpoint
pnpm run d1:create        # Create D1 database
pnpm run d1:migrate       # Run database migrations
```

## Common Queries

### Total unique users

```bash
wrangler d1 execute astro-telemetry --command "
  SELECT COUNT(DISTINCT uuid) as total_users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
"
```

### Users per version

```bash
wrangler d1 execute astro-telemetry --command "
  SELECT version, COUNT(DISTINCT uuid) as users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
  GROUP BY version
  ORDER BY version DESC
"
```

### Daily active users (last 30 days)

```bash
wrangler d1 execute astro-telemetry --command "
  SELECT DATE(created_at) as date, COUNT(DISTINCT uuid) as users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
    AND event = 'update_check'
    AND created_at >= datetime('now', '-30 days')
  GROUP BY DATE(created_at)
  ORDER BY date DESC
"
```

### New users this week

```bash
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

### Export data

```bash
wrangler d1 execute astro-telemetry --command "SELECT * FROM telemetry_events" --json > export.json
```

## Testing Production

```bash
curl -X POST https://updateserver.dny.li/event \
  -H 'Content-Type: application/json' \
  -d '{
    "appId": "astro-editor",
    "uuid": "test-uuid",
    "version": "0.1.32",
    "event": "update_check",
    "platform": "macos",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }'
```

Expected: `OK`

Verify:

```bash
wrangler d1 execute astro-telemetry --command "SELECT * FROM telemetry_events ORDER BY created_at DESC LIMIT 1"
```

## Cost Analysis

**Free tier limits:**
- Workers: 100k requests/day
- D1: 5GB storage, 5M reads/day, 100k writes/day

**Expected usage (~100 users):**
- Requests: ~100/day
- D1 writes: ~100/day
- Storage: ~1MB/year

**Total cost: $0**

## Troubleshooting

### Database not found

Ensure you've:
1. Created database: `pnpm run d1:create`
2. Updated `wrangler.toml` with correct `database_id`
3. Run migrations: `pnpm run d1:migrate`

### Custom domain not working

1. Verify `dny.li` is in your Cloudflare account
2. Wait 2-3 minutes for DNS propagation
3. Check logs: `pnpm run tail`

### No data in queries

1. Check logs: `pnpm run tail`
2. Verify app is sending events
3. Test with curl

## Monitoring

Set up alerts in Cloudflare dashboard → Notifications for:
- Worker errors
- High error rate
- D1 issues

## Maintenance

### Cleanup old data

```bash
wrangler d1 execute astro-telemetry --command "
  DELETE FROM telemetry_events
  WHERE created_at < datetime('now', '-1 year')
"
```

### Backup

```bash
wrangler d1 execute astro-telemetry --command "SELECT * FROM telemetry_events" --json > backup-$(date +%Y%m%d).json
```

## Documentation

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
