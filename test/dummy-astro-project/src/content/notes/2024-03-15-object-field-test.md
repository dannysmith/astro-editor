---
title: "Object Field Testing"
slug: "object-field-test"
description: "A note to test object field handling in the UI"
pubDate: 2024-03-15
tags: ["testing", "objects"]
draft: false
metadata:
  category: "development"
  priority: 5
  deadline: 2024-04-01
---

# Object Field Testing

This note is designed to test how the UI handles object fields in the schema.

## The Metadata Object

This note includes a `metadata` object in its frontmatter with the following structure:

- **category** (string, required): "development"
- **priority** (number, optional): 5
- **deadline** (date, optional): 2024-04-01

## Expected Behavior

When editing this note, the UI should:

1. Display the `metadata` object fields in a logical grouping
2. Not show a confusing text input for the object itself
3. Show individual fields for each property (category, priority, deadline)
4. Properly handle required vs optional fields within the object

This test case helps verify that object fields are rendered correctly in the frontmatter form.
