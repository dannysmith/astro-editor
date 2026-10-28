# Schema system

The frontmatter form is built from each collection's schema. Rust reads two sources, merges them into one `SchemaDefinition` per collection (`src-tauri/src/schema_merger.rs`), and sends it to the frontend as JSON. The frontend only deserialises it (`src/lib/schema.ts`); it never parses schemas itself.

## Two sources

- **The JSON schema is the source of truth.** `astro sync` (and `astro dev`) writes `.astro/collections/<name>.schema.json` for each collection. Types, constraints, descriptions, defaults, enum values and required fields all come from there.
- **The Zod config only adds `image()` and `reference()`.** Astro generates the JSON by calling the schema function with `image: () => z.string()`, so image fields come out as plain strings. `reference('authors')` comes out as a union of IDs and `{id, collection}` objects with the collection name gone. The Zod parser (`src-tauri/src/parser.rs`) finds those two helpers in the config text and nothing else, and `enhance_schema_from_zod` applies them: image fields become `image`, references get their target collection.
- **Config lookup:** `src/content.config.ts` first, then the legacy `src/content/config.ts` (`parse_astro_config`). Collections that use the `file()` loader are left out of the collection list; they're only read as reference targets (`load_file_based_collection`).
- **Changes reload the form.** The project watcher watches both config paths and `.astro/collections/`, and a change invalidates the collections query. The schema folder is only watched if it existed when watching started, so after a project's first `astro sync`, reopen the project in the app to pick up schema changes (#347).

To support a new Astro helper, the touch points are `find_helper_calls` in `parser.rs`, `enhance_schema_from_zod` in `schema_merger.rs`, and the routing in `src/components/frontmatter/fields/FrontmatterField.tsx`.

## The Zod-only fallback

If the JSON schema is missing or fails to parse, `create_complete_schema` falls back to the Zod parser's output alone. That output only contains the `image()` and `reference()` fields, all optional. The form then shows those fields plus whatever keys the file already has, without types, required markers, descriptions or defaults. If the config has no helpers either, the collection has no schema at all and the form shows only the file's keys.

**This is the likeliest cause of "my fields don't show up" or "this field has the wrong type".** The usual reasons:

- the project has never run `astro sync`, so `.astro/collections/` doesn't exist;
- Astro's generator threw for that collection, in which case it logs a warning and writes no file;
- the JSON contains a shape our serde types can't read (see Known Gaps). One unreadable field fails the whole collection.

A missing file is logged at debug level only. A parse failure logs `[Schema] Failed to parse JSON schema` as a warning.

## Helper paths must match JSON field names

`parse_field` flattens nested objects into dot paths (`coverImage.image`), keeping `parentPath` so the form can group them. The Zod parser builds the same dotted path for each helper by walking back through the braces, and the merge matches on the exact name. A mismatch fails silently: the field stays a plain string, or a reference with no target.

Arrays are never flattened. A helper directly inside `z.array(...)` is recorded against the array field itself, so `tags: z.array(reference('tags'))` enhances `tags`. A helper inside an object inside an array (`gallery: z.array(z.object({ src: image() }))`) gets the path `gallery.src`, which matches no field, so arrays of objects get no image or reference handling.

The parser pattern-matches helper calls rather than parsing Zod structure on purpose. The header comment in `parser.rs` says why; don't replace it with a structural parser. Its brace matching counts characters naively, so braces inside strings in the config can confuse it (comments are stripped first).

## Nullable fields

`.nullable()` and `.nullish()` produce a union with `null`, in one of two forms. Which one you get depends on the installed **Zod** version, not the Astro version:

- **Zod 4.4 and earlier:** `anyOf: [{ "type": "number" }, { "type": "null" }]`.
- **Zod 4.5 and later:** a nullable bare primitive collapses to `"type": ["number", "null"]`. Anything with more than a bare `type` (enums, arrays, `.int()`, constrained strings, objects) still uses `anyOf`.

`non_null_type` handles the type-array form, and `handle_anyof_type` unwraps nullable primitives, arrays and enums. Getting this wrong corrupts data: anything the parser doesn't recognise becomes a string field, and editing a string field writes a string back into the frontmatter, so a nullable number would be saved as text.

## Schema formats by Astro version

Both are supported, and `parse_json_schema` tries them in this order:

- **Astro 5 (Zod 3):** JSON Schema draft-07, with the collection wrapped as `{ "$ref": "#/definitions/<name>", "definitions": { … } }`. Dates are a three-way `anyOf` of `date-time`, `date` and `unix-time` formats.
- **Astro 6 and 7 (Zod 4):** draft 2020-12 with a flat root: `type`, `properties` and `required` at the top level. Dates are `{ "type": "string", "format": "date-time" }`.

Don't drop the Astro 5 path while the website lists Astro 5 as supported. `test_astro5_format_still_works` covers it.

## What Astro generates

Astro 6 and 7 generate each schema in `generateJSONSchema` (`astro/dist/content/types-generator.js`) with:

```js
z.toJSONSchema(schema, {
  io: 'input',
  unrepresentable: 'any',
  override: /* every z.date(), including z.coerce.date(), becomes { type: 'string', format: 'date-time' } */,
})
```

What follows from that:

- **`io: 'input'` describes what the file may contain, not what Astro outputs.** Fields with `.default()` aren't in `required` (Rust also marks any field with a default as not required), and transforms and refinements leave no trace, so the form's validation is looser than Astro's.
- **Images** are `{ "type": "string" }` because of the `image: () => z.string()` stub.
- **References** are an `anyOf` of `{ "type": "number" }` (Astro 7), `{ "type": "string" }`, `{ id, collection }` and `{ slug, collection }`. `is_reference_field` detects them by the object branch.
- **`$schema`:** Astro 7 adds an optional `$schema` property to object schemas so editors can validate data files. `parse_entry_schema` skips it.
- **`file()` loader collections** have a root `anyOf` of an array of entries and an object of entries (`additionalProperties`).

To see current output, read `.astro/collections/` in any of the `test/` projects (regenerating them is in `testing.md`). The Rust tests in `schema_merger.rs` hold samples of each shape the parser handles.

## Known gaps

Tracked in #347:

- **Nullable objects** become a string field instead of being flattened.
- **`z.discriminatedUnion`** is emitted as `oneOf`, which Rust doesn't read, so the field comes out as `unknown` and renders as a text input.
- **Literal unions** (`z.union([z.literal('a'), z.literal('b')])`) are emitted as an `anyOf` of `const`, and are parsed as plain strings rather than enums.
- **`file()` collection roots:** the Rust file-collection branch and its test (`test_parse_astro6_file_based_collection`) use an older root shape. It doesn't matter while file collections stay out of the collection list.
- **Tuples, numeric literals and numeric enums** (`items: false`, `const: 5`, `enum: [1, 2]`) don't fit our serde types, so one such field fails the whole collection's JSON parse and drops it to the Zod-only fallback.
