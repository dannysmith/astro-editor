---
title: Zod 4 Schema Shapes Test
pubDate: 2026-11-02
layout: wide
priorityLevel: 2
readingScore: 0.5
wordCount: 1200
coordinates:
  - 51.5
  - -0.12
embed:
  kind: video
  url: https://example.com/video
extra:
  source: newsletter
sponsor:
  name: Example Co
  url: https://example.com
gallery:
  - /src/assets/articles/styleguide-image.jpg
  - /src/assets/articles/styleguide-image.jpg
---

This note's frontmatter covers the Zod 4 JSON schema shapes the parser handles specially:

- **layout**: a union of string literals, shown as a dropdown
- **priorityLevel**: a union of number literals, shown as a number input
- **readingScore**: `gt(0).lt(10)`, shown as "> 0 • < 10"
- **wordCount**: `int()`, with no safe-integer range shown
- **coordinates** (tuple), **embed** (discriminated union) and **extra** (record): edited as YAML
- **sponsor**: a nullable object, shown as its own fields
- **gallery**: `z.array(image())`, an image picker for each image
