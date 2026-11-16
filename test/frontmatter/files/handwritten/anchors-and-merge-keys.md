---
title: Anchors, aliases and merge keys
defaults: &defaults
  layout: post
  comments: true
author: &me Danny
editor: *me
page:
  <<: *defaults
  comments: false
tags: &tags [one, two]
moreTags: *tags
---

Astro merges `<<` keys, so `page` is `{ layout: post, comments: false }`.
