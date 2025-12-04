---
title: Nullable Schema Types Test
description: Testing nullable arrays and enums
pubDate: 2024-12-01
draft: false
status: review
keywords:
  - testing
  - nullable
  - schema
scores:
  - 85
  - 92
  - 78
tags:
  - test
---

# Nullable Schema Types Test

This file tests the nullable schema types:

1. **status** - `z.enum(['draft', 'review', 'published']).nullish()` - Should render as a dropdown
2. **keywords** - `z.array(z.string()).nullish()` - Should render as a tag input
3. **scores** - `z.array(z.number()).nullish()` - Should render as a number array input

## Expected Behavior

- `status` field should show a dropdown with options: draft, review, published
- `keywords` field should show a tag input, not a text field
- `scores` field should show a number array input
