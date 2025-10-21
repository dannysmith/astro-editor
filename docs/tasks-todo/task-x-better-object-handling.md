# Task: Better Object Handling

https://github.com/dannysmith/astro-editor/issues/36

It appears as if objects in content types aren't handled properly in the UI. As you can see here, the UI is asking me to "Enter crafting…" with a freeform text field, and then the individual properties below it.

<img width="338" height="638" alt="Image" src="https://github.com/user-attachments/assets/b32b11a1-be4a-4b1c-9187-097e9557b432" />

The JSON schema for this field is what I'd expect:

```json
"crafting": {
  "type": "object",
  "properties": {
    "textile": {
      "type": "number"
    },
    "wood": {
      "type": "number"
    },
    "metal": {
      "type": "number"
    },
    "stone": {
      "type": "number"
    },
    "elementalis": {
      "type": "number"
    },
    "mithril": {
      "type": "number"
    },
    "fadeite": {
      "type": "number"
    }
  },
  "required": [
    "textile",
    "wood",
    "metal",
    "stone",
    "elementalis",
    "mithril",
    "fadeite"
  ],
  "additionalProperties": false
},
```

This makes complex content types difficult to work with. What I'd love to see is objects transformed into [`fieldset`s](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset) with their field name as their `legend`. That would both logically group the fields underneath it, which is the intent of having them as an object to begin with, and remove the confusing input for an object type.

(I also notice that the order of the fields inside objects is not preserved, that feels like a potentially related bug)

---

Okay, so this looks like what we need to do here is first of all make a test case using the example that he's got here. So we should add an object like the one described in this report to `test/dummy-astro-project` first. We should keep this as simple as possible. We don't need to include all of those fields, obviously. Probably just a text field and a number field, date field to the object. And we should make some of them required and some of them not. So let's do that in the content.config.json schema and then add a new note which includes a couple of these fields as dummy content. Make sure the JSON front matter is done correctly. Once you've done that, I can then run Astro Sync in that site to generate the JSON schema.

And then when I've done that, we can look at putting together a plan to implement this. I would suggest that we don't want to support anything like this if it doesn't appear in the schema. Because we already have some support for nested fields. I'm unsure how that differs in schemas to objects like this. So I'd like you to investigate that by looking at the astro docs and looking online.
