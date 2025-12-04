---
title: "Frontmatter Preservation Test"
description: 'Single quotes here'
pubDate: 2024-06-15T14:30:00Z
draft: false
tags:
  - preservation
  - formatting
  - "quoted tag"
status: draft
keywords:
  - exact-format
  - should-stay
---

# Frontmatter Preservation Test

This file tests that frontmatter is preserved exactly when only the markdown content is edited.

## What to Test

1. Edit ONLY this markdown content (not the frontmatter panel)
2. Save the file (or let auto-save trigger)
3. Check the file on disk - frontmatter should be IDENTICAL:
   - Date should still be `2024-06-15T14:30:00Z` (with time, not normalized to just date)
   - Quotes should be preserved exactly as written
   - Field order should remain the same
   - Multiline array format should be preserved

## If Frontmatter Changes

If the frontmatter was re-serialized, you'll see:
- Date becomes `2024-06-15` (time stripped)
- Fields may be reordered
- Quote styles may change
- Array formatting may change to inline `[a, b, c]`
