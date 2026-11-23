# Task: Show the entry's changes since its last commit

Before committing, a writer may want to see what they've changed in the entry. Today the Git tab says it's modified, but not how.

## Starting points

- `@codemirror/merge` can show the editor's text against another version, inline (`unifiedMergeView`) or side by side. The other version is `git show HEAD:<path>`, read through the Git panel's runner.
- It should be something switched on and off, like focus mode, not always on: writer mode comes first.
- Only the body is in CodeMirror. Frontmatter changes would need their own presentation, or a note that they changed.
- Only when the experimental Git switch is on.
