-- Telemetry Events Table
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

-- Essential indexes for common query patterns
CREATE INDEX idx_uuid ON telemetry_events(uuid);
CREATE INDEX idx_created_at ON telemetry_events(created_at);
CREATE INDEX idx_version ON telemetry_events(version);
CREATE INDEX idx_event ON telemetry_events(event);
