# Task: Reduce Bundle Filesize

https://github.com/dannysmith/astro-editor/issues/8

The bundled application is currently ~22MB. I suspect we can get this down a bit by:

- Applying the build optimisations here: https://v2.tauri.app/concept/size/
- Applying some of the JS optimisations here: https://v1.tauri.app/v1/guides/building/app-size/

## Implementation Plan

### 1. Rust/Cargo Optimizations (Easy Wins)

Add release profile optimizations to `src-tauri/Cargo.toml`:

```toml
[profile.release]
codegen-units = 1        # Better LLVM optimization
lto = true               # Link-time optimizations
opt-level = "s"          # Prioritize small binary size
panic = "abort"          # Disable panic handlers
strip = true             # Remove debug symbols
```

### 2. Tauri Configuration Optimizations

Update `src-tauri/tauri.conf.json`:
- Add `"removeUnusedCommands": true` to remove unused Tauri commands
- Verify capabilities only include necessary commands

### 3. JavaScript Build Optimizations

#### Source Map Removal
Update `vite.config.ts` to disable source maps in production:
```js
build: {
  sourcemap: false,  // Disable source maps in production
  minify: 'terser',  // Ensure minification is enabled
  terserOptions: {
    compress: {
      drop_console: true,  // Remove console logs in production
      drop_debugger: true  // Remove debugger statements
    }
  }
}
```

#### Bundle Analysis Setup
1. Install bundle analyzer: `npm install --save-dev rollup-plugin-visualizer`
2. Add to `vite.config.ts`:
```js
import { visualizer } from 'rollup-plugin-visualizer'

// In plugins array:
plugins: [
  // ... existing plugins
  visualizer({
    template: 'treemap', // or 'sunburst'
    open: true,
    filename: 'bundle-stats.html',
    gzipSize: true,
    brotliSize: true,
  })
]
```
3. Run `npm run build` to generate bundle analysis

### 4. Testing & Verification

1. Measure current bundle size: `du -sh dist-tauri/*.app`
2. Apply optimizations ✅
3. Rebuild: `npm run tauri:build`
4. Measure new bundle size and compare
5. Test app functionality to ensure no regressions

## Implementation Status

✅ **Completed optimizations:**
1. Added Rust release profile optimizations to `src-tauri/Cargo.toml`
2. Added `removeUnusedCommands: true` to `src-tauri/tauri.conf.json`
3. Configured Vite to disable source maps and console logs in production
4. Installed and configured bundle analyzer (rollup-plugin-visualizer)

**Next steps:**
- Run `npm run build` to generate bundle analysis report (opens automatically) ✅
- Run `npm run tauri:build` to build the optimized app
- Compare bundle sizes before and after optimizations

**Note:** Had to install `terser` as a dev dependency since it's optional in Vite v3+.

**Initial build results:**
- Main JS bundle: 1,530.22 kB (507.07 kB gzipped)
- CSS bundle: 83.78 kB (14.80 kB gzipped)
- Font files: ~586 kB total (iA Writer fonts)

### 5. Future Optimizations (Not for this task)

For reference, these were identified but won't be addressed now:
- Dynamic import for compromise.js (copy-edit mode)
- Selective Radix UI imports
- React Hook Form alternatives

Note: Vite should already be tree-shaking unused code during the build process, so unused imports shouldn't be included in the final bundle.
