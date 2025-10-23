# Task: Bug: Ligatures in iA Writer Duo cause weird spacing in markdown links

https://github.com/dannysmith/astro-editor/issues/1

If strings like `fl` are present in URLs which are used in markdown links or image embeds, Codemirror renders some janky spacing at the end.

<img width="575" height="114" alt="Image" src="https://github.com/user-attachments/assets/07cb2572-7927-440d-a6f0-05dd5c44fae7" />

## Solution Implemented

**Root Cause**: iA Writer Duo includes ligatures (combining characters like "fl" into single glyphs), which causes cursor positioning issues in CodeMirror's contenteditable environment. The editor tracks character positions, but ligatures visually merge characters, causing the cursor to appear in the "wrong place."

**Fix**: Changed `fontVariantLigatures: 'common-ligatures'` to `fontVariantLigatures: 'none'` in `src/lib/editor/extensions/theme.ts:33`

**Trade-off**: This disables all ligatures but ensures accurate cursor positioning. iA Writer Duo remains the font, just without ligature rendering.

**Testing Required**: User should verify that:
1. Cursor positions correctly in links/URLs with "fl", "fi", etc.
2. The visual appearance is acceptable without ligatures
3. No other cursor positioning issues remain
