#!/bin/bash

# Astro Editor Telemetry Stats
# Run with: ./stats.sh or pnpm run stats

set -e

# Colors
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
RESET='\033[0m'

header() {
  echo ""
  echo -e "${BOLD}${CYAN}$1${RESET}"
  echo -e "${DIM}─────────────────────────────────────────${RESET}"
}

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  ✨ ASTRO EDITOR STATS${RESET}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"

header "⭐ GITHUB"
stars=$(gh api repos/dannysmith/astro-editor --jq '.stargazers_count' 2>/dev/null)
echo -e "   ${BOLD}${GREEN}${stars}${RESET} stars"

header "🍺 HOMEBREW INSTALLS"
d30=$(curl -s "https://formulae.brew.sh/api/analytics/cask-install/30d.json" | jq -r '.items[] | select(.cask == "astro-editor") | .count // 0')
d90=$(curl -s "https://formulae.brew.sh/api/analytics/cask-install/90d.json" | jq -r '.items[] | select(.cask == "astro-editor") | .count // 0')
d365=$(curl -s "https://formulae.brew.sh/api/analytics/cask-install/365d.json" | jq -r '.items[] | select(.cask == "astro-editor") | .count // 0')
printf "   ${BOLD}${GREEN}%-6s${RESET} ${DIM}30 days${RESET}\n" "${d30:-0}"
printf "   ${BOLD}${GREEN}%-6s${RESET} ${DIM}90 days${RESET}\n" "${d90:-0}"
printf "   ${BOLD}${GREEN}%-6s${RESET} ${DIM}365 days${RESET}\n" "${d365:-0}"

header "📊 TELEMETRY USERS"
total=$(pnpm wrangler d1 execute astro-telemetry --remote --json --command "
  SELECT COUNT(DISTINCT uuid) as total_users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
" 2>/dev/null | jq -r '.[0].results[0].total_users')
new_users=$(pnpm wrangler d1 execute astro-telemetry --remote --json --command "
  SELECT COUNT(DISTINCT uuid) as new_users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
    AND uuid IN (
      SELECT uuid FROM telemetry_events
      GROUP BY uuid
      HAVING MIN(created_at) >= datetime('now', '-7 days')
    )
" 2>/dev/null | jq -r '.[0].results[0].new_users')
printf "   ${BOLD}${GREEN}%-6s${RESET} total users\n" "$total"
printf "   ${BOLD}${YELLOW}%-6s${RESET} new this week\n" "$new_users"

header "📦 BY VERSION"
pnpm wrangler d1 execute astro-telemetry --remote --json --command "
  SELECT version, COUNT(DISTINCT uuid) as users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
  GROUP BY version
  ORDER BY version DESC
" 2>/dev/null | jq -r '.[0].results[] | "\(.version)|\(.users)"' | while IFS='|' read -r ver count; do
  printf "   ${MAGENTA}v%-8s${RESET} ${BOLD}%s${RESET} users\n" "$ver" "$count"
done

header "📅 DAILY ACTIVE (Last 14 Days)"
pnpm wrangler d1 execute astro-telemetry --remote --json --command "
  SELECT DATE(created_at) as date, COUNT(DISTINCT uuid) as users
  FROM telemetry_events
  WHERE app_id = 'astro-editor'
    AND event = 'update_check'
    AND created_at >= datetime('now', '-14 days')
  GROUP BY DATE(created_at)
  ORDER BY date DESC
" 2>/dev/null | jq -r '.[0].results[] | "\(.date)|\(.users)"' | while IFS='|' read -r date count; do
  bar=$(printf '%*s' "$count" '' | tr ' ' '█')
  printf "   ${DIM}%s${RESET}  ${GREEN}%-10s${RESET} ${BOLD}%s${RESET}\n" "$date" "$bar" "$count"
done

echo ""
echo -e "${DIM}═══════════════════════════════════════════════════════════${RESET}"
echo ""
