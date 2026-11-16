---
title: Anchors written by a generator
sends:
  - &ref_0
    id: orders.created
    version: 1.0.0
  - id: orders.updated
    version: 1.0.0
receives:
  - *ref_0
---

Serialisers like js-yaml add anchors like these when one object appears twice.
