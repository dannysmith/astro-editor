# Task: Improve support for different schemas

Following on from `docs/tasks-done/task-1-better-schema-parser.md`, we should do the following:

1. Refactor: Unify SchemaField and ZodField (ie remove ZodField) if appropriate.

Needs some thinking about the best UI:

1. Handle nested fields properly
2. Handle references to other collections properly
3. Test against a bunch of real-world schemas for weird things where it's using inappropriate UI Fields.
