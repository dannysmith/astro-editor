# Optimization

## Overview

Documents current optimizations in Astro Editor. We prioritize **measurement before optimization**.

## Current Optimizations

### Rust Binary

`Cargo.toml` release profile:

```toml
[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

### Tauri

`tauri.conf.json`:

```json
{
  "build": {
    "removeUnusedCommands": true
  },
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
```

### Vite

`vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})
```

### React

See [performance-patterns.md](./performance-patterns.md) for:
- Decomposed Zustand stores
- getState() pattern
- CSS visibility vs conditional rendering
- Debounced operations (auto-save: 2s)

## Bundle Analysis

### Analyze Current Bundle

```bash
bun run build
# Opens bundle-stats.html automatically (rollup-plugin-visualizer)
```

We use `rollup-plugin-visualizer` configured in `vite.config.ts`.

### Current Bundle (v0.1.32)

```
Total JS: ~1.2MB minified (~350KB gzipped)
├── vendor.js: ~800KB
│   ├── React + React DOM: ~150KB
│   ├── CodeMirror 6: ~250KB
│   ├── Radix UI: ~200KB
│   └── Other: ~200KB
├── index.js: ~300KB (our code)
└── chunks: ~100KB
```

### Major Dependencies

| Dependency | Size (min) | Size (gzip) | Status |
|------------|------------|-------------|--------|
| CodeMirror | ~250KB | ~80KB | ✅ Already optimized |
| React + React DOM | ~150KB | ~45KB | ✅ Already optimized |
| Radix UI | ~200KB | ~60KB | 🔶 Could lazy-load dialogs |
| TanStack Query | ~40KB | ~12KB | ✅ Essential |
| Zustand | ~5KB | ~2KB | ✅ Minimal |
| date-fns | ~30KB | ~10KB | ✅ Tree-shakeable |

## Current Performance

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Bundle size (JS) | ~1.2MB | <1.5MB | ✅ Good |
| Bundle size (gzip) | ~350KB | <500KB | ✅ Good |
| Cold start time | ~1.5s | <2s | ✅ Good |
| Memory usage (idle) | ~150MB | <300MB | ✅ Good |

**Measurement**:
- Bundle size: `bun run build && du -sh dist/`
- Startup time: macOS Activity Monitor
- Memory: macOS Activity Monitor → Memory column

## Future Opportunities

If app grows significantly:

1. **Lazy load dialogs**: PreferencesDialog, CommandPalette
2. **Virtual scrolling**: If collections exceed 1000+ files
3. **Audit unused shadcn/ui components**: Each is 5-15KB

## Tree Shaking

We already follow good practices:

```typescript
// ✅ Specific imports
import { Save, Folder } from 'lucide-react'
import { format } from 'date-fns'

// ❌ Don't do this
import * as Icons from 'lucide-react'
import * as dateFns from 'date-fns'
```

## Related Documentation

- [performance-patterns.md](./performance-patterns.md) - React performance patterns
- [releases.md](./releases.md) - Build process
- [state-management.md](./state-management.md) - State optimization
