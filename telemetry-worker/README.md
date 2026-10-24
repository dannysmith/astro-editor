# Astro Editor Telemetry Worker

Cloudflare Worker for collecting anonymous telemetry from Astro Editor. Only collects anonymous UUIDs with minimal metadata (version, event type, platform).

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
bun run dev              # Start local dev server
bun run deploy           # Deploy to production
bun run tail             # View live logs
bun run test:local       # Test local endpoint
bun run d1:create        # Create D1 database
bun run d1:migrate       # Run database migrations
```

## Common Queries

### Get all telemetry

```bash
bunx wrangler d1 execute astro-telemetry --remote --command " SELECT * FROM telemetry_events WHERE app_id = 'astro-editor' ORDER BY created_at DESC"
```

### Total installs

```bash
bunx wrangler d1 execute astro-telemetry --remote --command "
  SELECT COUNT(DISTINCT uuid) as total_installs
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
"
```

### Users by platform

```bash
bunx wrangler d1 execute astro-telemetry --remote --command "
  SELECT platform, COUNT(DISTINCT uuid) as users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
  GROUP BY platform
  ORDER BY users DESC
"
```

### Users per current version

```bash
bunx wrangler d1 execute astro-telemetry --remote --command "
  SELECT version, COUNT(*) as users
  FROM (
    SELECT uuid, version
    FROM telemetry_events
    WHERE app_id = 'astro-editor'
    GROUP BY uuid
    HAVING created_at = MAX(created_at)
  )
  GROUP BY version
  ORDER BY version DESC
"
```

### Daily active users (last 30 days)

```bash
bunx wrangler d1 execute astro-telemetry --remote --command "
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
bunx wrangler d1 execute astro-telemetry --remote --command "
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
bunx wrangler d1 execute astro-telemetry --remote --command "SELECT * FROM telemetry_events" --json > export.json
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

## Maintenance

### Cleanup old data

```bash
wrangler d1 execute astro-telemetry --remote --command "
  DELETE FROM telemetry_events
  WHERE created_at < datetime('now', '-1 year')
"
```

### Backup

```bash
wrangler d1 execute astro-telemetry --remote --command "SELECT * FROM telemetry_events" --json > backup-$(date +%Y%m%d).json
```

## Documentation

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
