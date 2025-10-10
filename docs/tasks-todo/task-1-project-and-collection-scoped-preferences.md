# Task: Project and collection- scoped references

## Background

User preferences are currently set in the preferences panel. These are stored on disk as JSON files. On Mac, that's in `~/Library/Application Support/is.danny.astroeditor/preferences`

This contains `global-settings.json` eg

```json
{
  "general": {
    "ideCommand": "cursor",
    "theme": "system",
    "highlights": {
      "nouns": false,
      "verbs": false,
      "adjectives": false,
      "adverbs": false,
      "conjunctions": false
    },
    "autoSaveDelay": 2
  },
  "appearance": {
    "headingColor": {
      "light": "#ad1a72",
      "dark": "#e255a1"
    }
  },
  "defaultProjectSettings": {
    "pathOverrides": {
      "contentDirectory": "src/content/",
      "assetsDirectory": "src/assets/",
      "mdxComponentsDirectory": "src/components/mdx/"
    },
    "frontmatterMappings": {
      "publishedDate": "date",
      "title": "title",
      "description": "description",
      "draft": "draft"
    },
    "collectionViewSettings": {}
  },
  "version": 1
}
```

We also store a `project-registry.json` which is an "index" of the projects which have been opened. Eg.

```json
{
  "projects": {
    "danny-is-astro": {
      "id": "danny-is-astro",
      "name": "danny-is-astro",
      "path": "/Users/danny/dev/dannyis-astro",
      "lastOpened": "2025-10-08T22:32:23.882Z",
      "created": "2025-08-19T14:36:53.902Z"
    },
    "articles-notes": {
      "id": "articles-notes",
      "name": "articles-notes",
      "path": "/Users/danny/dev/astro-schema-examples/articles-notes",
      "lastOpened": "2025-10-10T00:13:25.525Z",
      "created": "2025-10-04T01:38:06.153Z"
    },
    "minimal-blog": {
      "id": "minimal-blog",
      "name": "minimal-blog",
      "path": "/Users/danny/dev/astro-schema-examples/minimal-blog",
      "lastOpened": "2025-10-07T01:01:05.190Z",
      "created": "2025-10-04T01:38:34.446Z"
    },
    "schema-patterns": {
      "id": "schema-patterns",
      "name": "schema-patterns",
      "path": "/Users/danny/dev/astro-schema-examples/schema-patterns",
      "lastOpened": "2025-10-10T00:14:16.661Z",
      "created": "2025-10-04T01:38:53.133Z"
    },
    "comprehensive-schemas": {
      "id": "comprehensive-schemas",
      "name": "comprehensive-schemas",
      "path": "/Users/danny/dev/astro-schema-examples/comprehensive-schemas",
      "lastOpened": "2025-10-10T00:13:45.016Z",
      "created": "2025-10-04T01:39:30.515Z"
    },
    "starlight-minimal": {
      "id": "starlight-minimal",
      "name": "starlight-minimal",
      "path": "/Users/danny/dev/astro-schema-examples/starlight-minimal",
      "lastOpened": "2025-10-10T22:08:31.890Z",
      "created": "2025-10-04T01:40:32.710Z"
    },
    "contribute-docs-astro-build": {
      "id": "contribute-docs-astro-build",
      "name": "contribute.docs.astro.build",
      "path": "/Users/danny/dev/contribute.docs.astro.build",
      "lastOpened": "2025-10-04T02:07:50.315Z",
      "created": "2025-10-04T01:41:10.594Z"
    },
    "dummy-astro-project": {
      "id": "dummy-astro-project",
      "name": "dummy-astro-project",
      "path": "/Users/danny/dev/astro-editor/test/dummy-astro-project",
      "lastOpened": "2025-10-10T22:08:40.643Z",
      "created": "2025-10-04T01:44:00.398Z"
    }
  },
  "lastOpenedProject": "dummy-astro-project",
  "version": 1
}
```

There is a subdirectory in here called `projects` which contains a file for each project in the registry. Eg.

```json
{
  "metadata": {
    "id": "dummy-astro-project",
    "name": "dummy-astro-project",
    "path": "/Users/danny/dev/astro-editor/temp-dummy-astro-project",
    "lastOpened": "2025-10-04T01:44:00.398Z",
    "created": "2025-10-04T01:44:00.398Z"
  },
  "settings": {
    "pathOverrides": {
      "contentDirectory": "src/content/",
      "assetsDirectory": "src/assets/",
      "mdxComponentsDirectory": "src/components/mdx/"
    },
    "frontmatterMappings": {
      "publishedDate": "date",
      "title": "title",
      "description": "description",
      "draft": "draft"
    },
    "collectionViewSettings": {}
  }
}
```

See `docs/developer/preferences-system.md` for information on this.

## Requirements

Some settings are truly global, such as the default timeout, the heading colors, etc. But most of these other settings should either be project specific or collection specific. If they are project or collection specific, they should be stored in the project file. And we should not be setting any defaults in here. As an example, it's weird that we have a default path to the content directory set at the global level. We can have that default kind of hard coded into the code base if there isn't a project specific one set. But really, once we've discovered where that is, we should be saving that as details for that particular project. In the preferences pane, we should make it clear when a user is changing global preferences and when they're changing project scoped preferences. And then within the project scope preferences bit, we should show all of the collections that we've identified and any collection specific settings.

1. We should also remove as much duplication from these files as possible so there's a single source of truth for each piece of data.
2. We should not store any defaultProjectSettings in global-settings.json. This should just contain truly global settings.
3. The project registry should contain only a list of the opened projects and the last-opened one. It's basically there already, though some information is duplicated in the individual project files.
4. The individual project settings files should contain all project-specific settings and saved data (project-level path overrides etc).
5. The project files should also contain an array of collections with any collection-specific settings which have been set for those collections.
6. Collections specific settings should include all the front matter mappings (eg right now: title, publishedDate, draft boolean, description) And should probably include a collection level path override to the content and to assets. If these are not set, it should use the project level overrides, if they exist. And if they're not set either, then it should just use the hard-coded default paths. By making it possible to set these at a collection level, it allows us to support astro sites where content files are in a non-standard directory somewhere and where the assets for a particular collection, images and files and stuff, are also in some non-standard place.
7. There is potential for some confusion with users now that we're introducing path overrides, you know, about both the project and collection level. So we need to make sure the UI is very clear about these and how they work. Project/Collection level preferences should only be shown when a project is currently open.
8. If we introduce these kind of overrides and this kind of stuff, we need to make sure that everywhere else in the application where paths are used and where front matter mappings are used, we look at the right places here. So front matter mappings should be easy because they're going to be set on a per-collection basis.But the overrides, we're going to need to make sure that we're fully respecting those overrides as well as any of the project level settings. Whenever we are looking for and loading collection content, whenever we are writing to files, whenever we are reading from files, i.e. the file watcher, whenever we are copying documents in or images because they've been dragged in, that's to do with the asset folder basically wherever we're doing any of this stuff. So there's possibly an opportunity to do some refactoring here, such that everywhere in our code, we're using one variable or one function call to get the correct path for the currently active collection, etc. So there's one place in our code base where all this stuff is worked out.
9. This is a small thing. We should make sure the global settings for "highlights" (verbs etc) are `false` when the global-settings file is first created on first run.
10. While we're doing this work, we should also make sure that a preferences file, any preferences file, doesn't contain a preference that it expects. The app doesn't crash, it just falls back to a sensible hard-coded default. That should happen rarely, but it may, for instance, happen during future upgrades when we add some preferences and for whatever reason people open the app. Those aren't added to the preferences.json files. Basically, we just need to make sure that none of these preferences are required. I.e. it should be possible to completely delete the preferences files. The app still works. It'll just recreate the project registry and probably, I guess, the global settings whenever we open a project or open the app or whatever. Basically, robustness here.
11. We need to consider situations where a project or collections name/path is changed in the source directory (ie Astro site). This will probably be rare, so it may be that the complexity of handling this isn't worth it, and we should simply expect the user to reopen the astro site, then have it treat it as a new site. Obviously this won't work if it's the same astro site, as in the root path is the same. We just need to give this some consideration. Probably don't want to go overboard with this.
12. We should maybe add a debug pane to the preferences, maybe one which is a little bit less obvious than the other preferences at a top level, which includes a link that users can click to open up their preferences directory and potentially also a reset button which wipes pretty much everything from `~/Library/Application Support/is.danny.astroeditor` after some clear warnings. I wouldn't expect users to ever mess with this themselves. This is more to help me out when I get support questions or weird bugs. In the future we could obviously add some other flags to turn on and off more advanced logging and stuff here.

## Related Bug

Looking at how the codebase currently works, it looks like we have a bug that is somewhat related to this and should maybe be fixed at the same time. Here is the bug report:

### Bug Report: Content Directory Override Not Respected by Config Parser

#### How Content Directory Path Resolution Works

Astro Editor uses a two-tier path resolution strategy:

1. Content Directory Base Path

- Default: src/content (defined in src/lib/constants.ts:3)
- User override: ProjectSettings.pathOverrides.contentDirectory (per-project setting)
- Collections are expected to be subdirectories: {content_dir}/{collection_name}

1. Collection Discovery (Two Methods)

Method A: Config-based discovery (primary, via parse_astro_config)

- Parses src/content.config.ts or src/content/config.ts
- Extracts collection names from the config
- Constructs collection paths

Method B: Directory-based discovery (fallback, via scan_content_directories_with_override)

- Scans for subdirectories when config parsing fails/returns empty
- Lists subdirectories under the configured content directory
- Creates collections from directory names

3. Subsequent Operations

- All file operations (read/write/watch) use the stored collection.path from discovery
- File watcher respects the content directory override

#### The Bug

The config parser hard-codes src/content and ignores the user's content directory override.

Location: src-tauri/src/parser.rs

// Line 89 - hard-coded path
let content_dir = project_path.join("src").join("content");

// Lines 280, 307 - uses hard-coded path
let collection_path = content_dir.join(collection_name);

This means if a user sets contentDirectory: "content", the config parser will still look for collections in src/content/{name} instead of content/{name}.

Contrast with directory scanner (src-tauri/src/commands/project.rs:270-275):
let content_dir = if let Some(override_path) = &content_directory_override {
project_path.join(override_path) // ✅ Respects override
} else {
project_path.join("src").join("content")
};

#### Impact

The content directory override only works when:

- Config parsing fails entirely, OR
- Config parsing returns empty collections

The content directory override is silently ignored when:

- content.config.ts successfully parses and returns collections

This creates inconsistent behavior where the same project setting works differently depending on whether the TypeScript config can be parsed.

#### Reproduction

1. Set contentDirectory: "content" in project settings (not src/content)
2. Have a valid src/content.config.ts with collections defined
3. Place actual content files in content/{collection_name}/
4. Expected: App finds collections and files
5. Actual: App looks in src/content/{collection_name}/ and finds nothing

#### Fix Required

The parse_collections_from_content function needs to accept and use the content_directory_override parameter, similar to how scan_content_directories_with_override works.

## Other Thoughts

We have a decision to make about whether we want to use the collections array in here as part of our kind of source of truth about the available collections. In which case we're going to need to update it with new collection paths and names and stuff every time things are passed for new collections. We're going to need to obviously remove any collections which have been deleted from Astro Sites from it. We're going to need to add any new collections whenever we pass the various schemas. I'm not adverse to doing this because it might make certain things simple, but we do need to make sure that this happens accurately. And I'm not completely convinced that that stuff ought to be stored as kind of preferences files. Maybe that stuff is done somehow in the project registry. Or maybe we just get rid of the individual collection settings files completely. And we just have the project registry being like one big JavaScript object, which has all of this stuff in it.
