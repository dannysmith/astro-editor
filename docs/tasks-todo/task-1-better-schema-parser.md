# Task: Better Schema Parser

https://github.com/dannysmith/astro-editor/issues/15

## Backbground

The schema parser is pretty dumb at the moment, and reads the zod schemas directly. This means support is very limited, and doesn't work for any kind of complex schema at all (including starlight sites which import special loaders and schemas from the starlight package). In an effort to improve this I am investigating using the generated `<collectionname>.schema.json` files found in `.astro/collections`.

## Using Astro's Generated Schema files instead

Astro's transformation from Zod to JSON Schema is sophisticated but predictable. While some Zod features (transforms, complex refinements) are lost, the generated schemas provide enough information to build a robust content editor. The key is understanding the transformation patterns documented here and designing the editor to work within these constraints while leveraging the rich type information that is preserved.

We created a variety of different types of astro sites in another repository that would generate the JSON schemas and then had AI analyze them to come up with comprehensive documentation for how this works along with examples.

Read `docs/developer/astro-generated-conentcollection-schemas.md` for this documentation.

Below are a few additional details that came out of that analysis, which are not in the documentation above.

### Key Insights for Parser Development

1. **Predictable Structure**: All schemas follow the same wrapper structure with `$ref` and `definitions`
2. **Type Safety**: The `additionalProperties: false` ensures strict validation - useful for GUI field generation
3. **Date Flexibility**: The `anyOf` for dates allows multiple input formats, important for editor UX
4. **Reference Handling**: The complex structure for references means editors need to handle multiple reference formats
5. **Lost Information**: Custom validations, transforms, and complex refinements are not preserved - editors may need alternative validation strategies
6. **Enum Resolution**: All enums are fully resolved at build time, so the JSON schema contains actual values, not references
7. **Required Field Detection**: Check the `required` array, not individual field definitions, to determine if a field is mandatory
8. **Default Values**: Preserved in the schema, allowing editors to pre-populate fields
9. **Nested Structure Preservation**: Complex nested objects maintain their full structure, making it possible to generate nested form inputs
10. **Format Hints**: String formats (email, uri) provide validation hints for input fields

### Recommendations for Astro Editor Development

1. **Parse the `required` array** to determine which fields must be filled
2. **Use `default` values** to pre-populate form fields
3. **Leverage format hints** (`email`, `uri`) for input validation
4. **Handle the three reference formats** for collection references
5. **Support the three date formats** in date picker implementations
6. **Use `enum` arrays** to generate select/dropdown inputs
7. **Respect `minLength`/`maxLength`** for text input constraints
8. **Parse nested objects recursively** to generate grouped form sections
9. **Consider `additionalProperties: false`** to warn users about invalid fields
10. **Use descriptions** for field help text/tooltips

### Testing Recommendations

To fully test an Astro Editor against these patterns:

1. Test with simple schemas (minimal-blog)
2. Test with complex nested objects (comprehensive-schemas)
3. Test with imported schemas (starlight-minimal)
4. Test with file loaders (documentation collection)
5. Test with all date input formats
6. Test with collection references
7. Test with enums and unions
8. Test with array constraints
9. Test with default values
10. Test with required vs optional field

## Requirements

- `.describe()` should be used to display a short description of the field (if present). It could also be used to "mark" fields for special treatment in the UI, much like the field names "title" and "description" are currently used.
- Astro's image() is represented as a string only in the schema, which is annoying. Supporting image fields in the sidebar UI would require the schema to still be parsed.

## Tasks

1. Write comprehensive requirements for the sidebar fields UI, with mappings onto the various field types defined in the schemas.
2. Design a more sensible data structure for a "Field" which can be passed into a react component and result in the complete field being rendered with all the correct UI.
3. Write a utility which reads JSON schema files and returns field objects structured as above.
4. Simplify the schema parser to only read the loader and path for each collection, and identify any hard-coded image() fields. These should be merged into the contentcollectionschema objects built from the JSON schemas.

---

## Analysis & Implementation Planning

### Current Architecture Assessment

#### Rust Parser (`src-tauri/src/parser.rs`) - ~1400 lines
**Current approach:**
- Regex-based parsing of `content.config.ts` TypeScript source
- Extracts Zod schemas via pattern matching
- Serializes to custom JSON structure: `{type: "zod", fields: [...]}`

**Supported features:**
- Basic types: String, Number, Boolean, Date
- Complex types: Array, Enum, Union, Literal, Object
- Constraints: min/max, length, email, URL, regex patterns
- Default values and optional fields

**Known limitations:**
1. **Cannot handle:**
   - Imported schemas (e.g., Starlight's `docsSchema()`)
   - Complex nested objects (marked as `Object([])`)
   - Collection references (`reference()`)
   - Image fields (detected but marked as String)
   - Transforms, refinements (noted but not preserved)
   - Discriminated unions
   - Tuples
   - Record types

2. **Fragility:**
   - Regex patterns break with complex TypeScript
   - Multi-line definitions require careful normalization
   - Comments must be stripped carefully to avoid breaking strings
   - Import resolution not implemented

3. **Maintenance burden:**
   - Every new Zod feature requires parser updates
   - Testing requires mock TypeScript files
   - Difficult to debug regex failures

#### TypeScript Schema Interface (`src/lib/schema.ts`)
**Current structure:**
```typescript
interface ZodField {
  name: string
  type: ZodFieldType
  optional: boolean
  default?: string
  options?: string[] // For enum
  constraints?: ZodFieldConstraints
  arrayType?: ZodFieldType
  unionTypes?: Array<ZodFieldType | { type: 'Literal'; value: string }>
  literalValue?: string
}
```

**Issues:**
- Flat structure doesn't represent nested objects well
- No description field for help text
- No reference information for collection links
- No image metadata
- Union types oversimplified

#### React Field Components
**Current implementation:**
- Direct Store Pattern (no React Hook Form) ✅
- Individual components: StringField, ArrayField, DateField, EnumField, NumberField, BooleanField, TextareaField
- Routing via `FrontmatterField.tsx` based on type
- Special handling for title/description via `frontmatterMappings`

**Missing components (scope for this task):**
- ImageField (for Astro image() helper) - **In scope**
- Description/help text display - **In scope**
- Constraint indicators (min/max, email, URL) - **In scope**
- Validation error messages - **In scope**
- Default value indicators - **In scope**

**Out of scope (future enhancements):**
- NestedObjectField (using flattened dot notation instead)
- ReferenceField (using StringField for now)
- TupleField
- UnionField (complex unions - using StringField)
- RecordField (key-value maps - using JSON textarea)
- Arrays of objects editor (using JSON textarea)

### Proposed Architecture

#### Phase 1: Hybrid Approach (Recommended First Step)

**Strategy:** Use Astro's JSON schemas as primary source, fall back to Zod parsing for image detection.

**Advantages:**
- Leverages Astro's robust schema generation
- Handles imported schemas automatically
- Preserves descriptions, defaults, constraints
- Standard JSON Schema format (well-tested)
- Reduces maintenance burden significantly

**Disadvantages:**
- Requires `.astro/collections/` directory to exist
- Requires Astro project to be built at least once
- Image fields need special handling

**Implementation:**
1. **Rust commands:**
   - Add `read_json_schema(project_path, collection_name)` command
   - Keep simplified Zod parser for image() detection only
   - Merge image metadata into JSON schema field data

2. **TypeScript parser:**
   - New `parseJsonSchema(schemaJson)` function
   - Recursive type determination following doc patterns
   - Map JSON Schema types to field components

3. **Field data structure (new):**
```typescript
interface SchemaField {
  // Identity
  name: string
  label: string

  // Type information
  type: FieldType // Expanded enum
  subType?: FieldType // For arrays, unions

  // Validation
  required: boolean
  constraints?: FieldConstraints

  // UI metadata
  description?: string
  placeholder?: string
  helpText?: string

  // Default values
  default?: unknown

  // Type-specific data
  enumValues?: string[]
  objectFields?: SchemaField[] // Recursive for nested objects
  referenceCollection?: string
  imageMetadata?: ImageFieldMetadata

  // Advanced types
  unionOptions?: SchemaField[]
  tupleTypes?: FieldType[]
  recordValueType?: FieldType
}

enum FieldType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Date = 'date',
  Email = 'email',
  URL = 'url',
  Array = 'array',
  Enum = 'enum',
  Object = 'object',
  Reference = 'reference',
  Image = 'image',
  Tuple = 'tuple',
  Union = 'union',
  Record = 'record',
  Literal = 'literal',
  Unknown = 'unknown',
}
```

4. **New field component:**
   - `ImageField` - Image picker/upload UI (if image detected from Zod parser)

5. **Enhanced existing components:**
   - Add description/help text to all fields
   - Show constraint indicators (e.g., "Min: 5, Max: 100", "Email", "URL")
   - Display default values in placeholders
   - Add validation error messages
   - Handle nested objects via flattened dot notation
   - Handle references, unions, tuples as StringField for now
   - Handle arrays of objects as JSON textarea

#### Phase 2: Full JSON Schema Support

**Once Phase 1 is stable:**
1. Add full tuple support
2. Add discriminated union support
3. Add record type support
4. Add validation for all constraint types
5. Add help tooltips with schema information

#### Phase 3: Enhanced UX

**Future improvements:**
1. Field reordering based on schema order
2. Collapsible field groups for complex schemas
3. Inline validation with error messages
4. Field search/filter for large schemas
5. Schema visualization/preview mode

### Implementation Approaches

#### Approach A: Big Bang Replacement
- Replace entire Rust parser at once
- Rewrite all TypeScript schema handling
- Update all components simultaneously

**Pros:**
- Clean break from old system
- No hybrid complexity
- Faster overall completion

**Cons:**
- High risk - everything breaks until done
- Difficult to test incrementally
- Long PR review
- May discover blockers late

#### Approach B: Incremental Migration (Recommended)
1. Add JSON schema reader alongside current parser
2. Add new field data structure, keep old one
3. Update components one at a time
4. Feature flag for JSON schema mode
5. Remove old parser once stable

**Pros:**
- Lower risk - can roll back
- Incremental testing
- Smaller, reviewable PRs
- Early validation of approach

**Cons:**
- Temporary code duplication
- Longer calendar time
- More complex during transition

#### Approach C: Parallel Systems
- Build entirely new schema system in parallel
- Use feature flag to switch between old/new
- Complete all components before switching
- Remove old system in final PR

**Pros:**
- Zero disruption during development
- Full testing before switch
- Easy A/B comparison

**Cons:**
- Significant duplication
- Maintenance of two systems
- Large final cutover PR
- Wasted effort if approach wrong

**Recommendation:** Approach B (Incremental Migration)

### Architecture Decisions (Finalized)

#### 1. JSON Schema Availability ✅
**Decision:** JSON schemas as primary source, full Zod parser as fallback.

- Astro generates `.astro/collections/*.schema.json` via `astro sync` (auto-runs on `astro dev`/`astro build`)
- Safe to assume these exist for most projects
- If missing/malformed: fall back to existing Zod parser
- No need to run `astro sync` ourselves (avoids npm/pnpm/bun complexity)

#### 2. Fallback Strategy ✅
**Decision:** Two-tier fallback with existing parser unchanged.

```
1. Try JSON schema (new code)
   ↓ (if missing/malformed)
2. Fall back to full existing Zod parser (unchanged)
```

**Implementation approach:**
- Keep current Zod parser (`parser.rs`) completely untouched as fallback
- Add image detection as post-processing step when both sources available
- No code duplication - one parser for fallback, one for images
- Lower risk, cleaner architecture

#### 3. Reference Fields ✅
**Decision:** Parse correctly, render as StringField.

- JSON schema parser will detect and type reference fields correctly
- UI renders as basic text input (StringField component)
- Future enhancement: autocomplete/dropdown with collection data
- Out of scope for this task - too much UI complexity

#### 4. Nested Objects ✅
**Decision:** Flattened dot notation for simple objects, JSON for arrays.

**Common use cases in Astro:**
- SEO/metadata grouping: `seo.title`, `seo.description`, `seo.ogImage`
- Author info: `author.name`, `author.email`, `author.avatar`
- Arrays of objects: `gallery[].image`, `gallery[].caption` (for future)

**UI approach:**
- Simple nested objects → flatten with dot notation (`seo.title`, `author.name`)
- Arrays of objects → JSON textarea (future: proper array editor)
- No expandable sections yet (keep it simple)
- Example frontmatter structure:
  ```yaml
  title: "Post Title"
  seo.title: "SEO Title Override"
  seo.description: "Meta description"
  author.name: "John Doe"
  author.email: "john@example.com"
  ```

**Parser responsibility:**
- Recursively traverse nested objects
- Generate flattened field names with dot notation
- Preserve full schema info for each nested field

#### 5. Performance ✅
**Decision:** Parse all schemas upfront, cache in TanStack Query.

- Parse schemas when project opens
- Cache results in TanStack Query (already supports lazy loading if needed later)
- Most Astro sites won't have hundreds of schemas
- Architecture allows future lazy loading with minimal changes

#### 6. Validation
**Decision:** UI-level validation only (for now).

- Display constraint hints in UI (min/max, required, etc.)
- No full JSON Schema validation library needed initially
- Future enhancement: use ajv or similar for strict validation

#### 7. TypeScript Types
**Decision:** Not needed.

- Manual TypeScript interfaces for our internal structures
- No code generation from JSON Schema
- Simpler, more maintainable

### Opportunities for Improvement

1. **Better Type Safety:**
   - Use discriminated unions for field types
   - Exhaustive pattern matching for field rendering
   - Runtime validation of schema structure

2. **Testing Strategy:**
   - Unit tests for JSON Schema parser
   - Integration tests with real Astro schemas
   - Component tests for new field types
   - Visual regression tests for field rendering

3. **Developer Experience:**
   - Better error messages when schema invalid
   - Schema validation warnings in dev mode
   - Debug panel showing parsed schema

4. **Performance:**
   - Lazy load field components
   - Virtualize long field lists
   - Memoize expensive schema parsing

5. **Accessibility:**
   - Proper ARIA labels for all fields
   - Keyboard navigation for complex fields
   - Screen reader support for validation

### Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| JSON schemas not available | High | Medium | Fallback to Zod parser |
| Breaking changes to component API | High | Low | Incremental migration |
| Performance degradation | Medium | Low | Profile and optimize early |
| Complex schemas break UI | Medium | Medium | Limit nesting, handle gracefully |
| Lost functionality from Zod parser | Low | Low | Keep Zod parser for image detection |
| User confusion with new fields | Low | Medium | Add help text, tooltips |

### Testing Strategy

#### Unit Tests
- [ ] JSON Schema parser with all type variations
- [ ] Field type determination logic
- [ ] Constraint extraction and validation
- [ ] Default value handling
- [ ] Nested object recursion

#### Integration Tests
- [ ] Parse real Astro JSON schemas
- [ ] Handle Starlight schemas
- [ ] Handle file() loader schemas
- [ ] Parse dummy-astro-project schemas

#### Component Tests
- [ ] Existing field components still work with new data structure
- [ ] Flattened nested objects render correctly (dot notation)
- [ ] Reference fields render as StringField
- [ ] ImageField picker works (if implemented)
- [ ] Description/help text displays
- [ ] Constraint indicators show correctly
- [ ] Validation messages display

#### E2E Tests
- [ ] Open project with complex schema
- [ ] Edit all field types
- [ ] Save changes correctly
- [ ] Validation prevents invalid data
- [ ] Help text displays correctly

### Rollout Plan (Revised)

#### Stage 1: Research & Validation (1-2 days)
- [ ] Test Astro JSON schema generation with dummy project
- [ ] Create sample schemas with nested objects, references, images
- [ ] Validate JSON schema parsing approach with real examples
- [ ] Prototype SchemaField interface with flattened structure
- [ ] Test nested object flattening logic

#### Stage 2: Foundation (3-5 days)
- [ ] Add Rust command to read JSON schema files from `.astro/collections/`
- [ ] Create TypeScript JSON Schema parser (`parseJsonSchema.ts`)
- [ ] Implement nested object flattening (dot notation)
- [ ] Define new SchemaField interface
- [ ] Write comprehensive parser unit tests
- [ ] Set up fallback to existing Zod parser

#### Stage 3: Enhanced Field Components (4-6 days)
- [ ] Update FrontmatterField.tsx to use new SchemaField structure
- [ ] Add description/help text rendering to all field components
- [ ] Add constraint indicators (min/max, email, URL, etc.)
- [ ] Implement validation messages
- [ ] Update field components to handle flattened nested fields
- [ ] Test with simple and complex schemas

#### Stage 4: Image Detection & Special Types (2-3 days)
- [ ] Add image() detection from Zod parser (if needed)
- [ ] Implement ImageField component (or defer to future)
- [ ] Handle reference fields (render as StringField)
- [ ] Handle unions/tuples (render as StringField or JSON)
- [ ] Handle arrays of objects (JSON textarea)

#### Stage 5: Integration & Testing (3-5 days)
- [ ] Integration tests with real Astro schemas (Starlight, etc.)
- [ ] Test with dummy-astro-project
- [ ] Component tests for all enhanced fields
- [ ] E2E tests for complete workflows
- [ ] Error handling and edge cases
- [ ] Performance profiling

#### Stage 6: Polish & Documentation (2-3 days)
- [ ] Update CLAUDE.md with new schema architecture
- [ ] Add developer documentation for parser
- [ ] User-facing documentation (if needed)
- [ ] Code cleanup and optimization
- [ ] Final QA

**Total Estimated Time:** 15-24 days (3-4.5 weeks)

### Remaining Open Questions

1. **Error Handling:** What should we display to users when:
   - JSON schema is malformed?
   - JSON schema is missing but Zod fallback also fails?
   - Schema parsing succeeds but field type is unsupported?

2. **Migration Path:** Should we use a feature flag to switch between old/new parsers, or do a hard cutover?

3. **Image Field Implementation:** Should we implement ImageField in this task, or defer to a future enhancement?

### Implementation Plan - Next Steps

**Ready to start implementation. Recommended order:**

#### Week 1: Foundation
1. **Day 1-2:** Research & validation
   - Test JSON schema generation with real Astro project
   - Create test cases for all field types
   - Prototype flattening logic for nested objects

2. **Day 3-5:** Build JSON schema parser
   - Rust command to read `.astro/collections/*.schema.json`
   - TypeScript parser for JSON schema → SchemaField conversion
   - Implement nested object flattening
   - Write comprehensive unit tests

#### Week 2-3: Component Updates
3. **Day 6-11:** Enhance field components
   - Update all field components for new data structure
   - Add description/help text rendering
   - Add constraint indicators
   - Implement validation messages
   - Test with various schema types

4. **Day 12-14:** Special types & edge cases
   - Handle references (StringField)
   - Handle unions/tuples (StringField/JSON)
   - Handle arrays of objects (JSON textarea)
   - Decide on ImageField (implement or defer)

#### Week 3-4: Testing & Polish
5. **Day 15-19:** Integration & testing
   - Test with Starlight schemas
   - Test with complex nested structures
   - E2E testing
   - Performance optimization

6. **Day 20-24:** Documentation & cleanup
   - Update CLAUDE.md
   - Developer documentation
   - Code review and refinement
   - Final QA

**After this analysis, ready to begin Stage 1 implementation.**
