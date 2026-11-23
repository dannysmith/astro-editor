#!/bin/bash
# Builds (or rebuilds) the throwaway git repos for trying the Git panel in the
# app, in ~/dev/temp-git-repos-for-ae-testing: outside the astro-editor
# checkout, so nothing done in them can land in this repo. What each is for is
# in docs/developer/git.md.
#
#   bash scripts/make-git-test-repos.sh
#
# Run it from the astro-editor checkout, outside the agent sandbox (it writes
# to ~/dev). macOS only (BSD `date` and `sed`). Each site is a copy of a project
# in test/, including its generated .astro/ folder, plus `bun install`.
# Re-running wipes and recreates everything.
set -euo pipefail

SRC="$(git rev-parse --show-toplevel)/test"
ROOT="$HOME/dev/temp-git-repos-for-ae-testing"

# Inherited, these would point every git command below at another repository,
# such as this checkout
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES
# Belt and braces: no git command here may climb out of ROOT into a parent repo
export GIT_CEILING_DIRECTORIES="$HOME/dev"
# Setup commits are never signed and never run the user's global hooks
export GIT_CONFIG_PARAMETERS="'commit.gpgsign=false' 'core.hooksPath=/dev/null' 'init.defaultBranch=main' 'protocol.file.allow=always'"

case "$ROOT" in "$HOME/dev/temp-git-repos-for-ae-testing") ;; *) exit 1 ;; esac
rm -rf "$ROOT"
mkdir -p "$ROOT/remotes"

copy_site() { # copy_site <test project> <dest>
  # .astro/ stays committed (not gitignored) so clones and the submodule have
  # the generated schemas AE reads
  rsync -a --exclude node_modules --exclude .DS_Store --exclude .claude "$SRC/$1/" "$2/"
}

# commit_as <who> <days ago> <message>: who is "me" (global identity) or "sam"
commit_as() {
  local date
  date="$(date -v-"$2"d '+%Y-%m-%dT%H:%M:%S')"
  if [ "$1" = sam ]; then
    GIT_AUTHOR_NAME="Sam Collaborator" GIT_AUTHOR_EMAIL="sam@example.com" \
      GIT_COMMITTER_NAME="Sam Collaborator" GIT_COMMITTER_EMAIL="sam@example.com" \
      GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit -qm "$3"
  else
    GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit -qm "$3"
  fi
}

with_remote() { # with_remote <name>: bare remote in remotes/, push main, set upstream
  git init -q --bare "$ROOT/remotes/$1.git"
  git remote add origin "$ROOT/remotes/$1.git"
  git push -q -u origin main
}

# --- blog: a site at the root of its own repo, with history and a remote ------
B="$ROOT/blog"
copy_site dummy-astro-project "$B"
cd "$B"
git init -q
git add -A && commit_as me 30 "Initial site"
printf '\nA paragraph Sam added.\n' >> src/content/articles/first-article.md
git add -A && commit_as sam 20 "Expand the first article"
git mv src/content/articles/second-article.md src/content/articles/the-second-article.md
git add -A && commit_as me 10 "Rename the second article"
printf '\nAnother paragraph after the rename.\n' >> src/content/articles/the-second-article.md
git add -A && commit_as me 3 "Update “Second article”"
with_remote blog
printf '\nAn unpushed change.\n' >> src/content/notes/quick-tip.md
git add -A && commit_as me 1 "Update “Quick tip”"
# Uncommitted: one changed article
printf '\nAn edit that is not committed yet.\n' >> src/content/articles/first-article.md

# A second clone of the same remote, to play another contributor:
#   git -C "$ROOT/blog-collaborator" commit … && git -C "$ROOT/blog-collaborator" push
# then `git -C "$ROOT/blog" fetch` makes blog "behind", and pushing from blog is rejected
git clone -q "$ROOT/remotes/blog.git" "$ROOT/blog-collaborator"
git -C "$ROOT/blog-collaborator" config user.name "Sam Collaborator"
git -C "$ROOT/blog-collaborator" config user.email "sam@example.com"

# --- monorepo: a Starlight site in docs/ of a library repo, with hooks --------
M="$ROOT/monorepo"
mkdir -p "$M/packages/widget/src" "$M/.githooks"
copy_site starlight-minimal "$M/docs"
rm -f "$M/docs/.gitignore"
cd "$M"
cat > package.json <<'EOF'
{ "name": "widget-monorepo", "private": true, "workspaces": ["packages/*", "docs"] }
EOF
printf '# Widget\n\nA library with its docs site in docs/.\n' > README.md
printf 'export const widget = () => "widget"\n' > packages/widget/src/index.ts
printf 'node_modules/\ndist/\n.DS_Store\n' > .gitignore
rm -f docs/bun.lock
bun install --silent # a workspace install: one bun.lock at the root, committed below
# pre-commit: strips trailing whitespace from staged markdown and re-stages it,
# like lint-staged + prettier (this is what leaves `MM` after `commit --only`)
cat > .githooks/pre-commit <<'EOF'
#!/bin/bash
git diff --cached --name-only --diff-filter=ACM -z -- '*.md' '*.mdx' |
  while IFS= read -r -d '' f; do sed -i '' -e 's/[[:space:]]*$//' "$f"; git add -- "$f"; done
EOF
# pre-push: refuses while a .block-push file exists at the repo root
cat > .githooks/pre-push <<'EOF'
#!/bin/sh
if [ -f .block-push ]; then echo "pre-push: blocked (delete .block-push to allow)" >&2; exit 1; fi
EOF
chmod +x .githooks/*
git init -q
git add -A && commit_as sam 40 "Initial library and docs"
printf '\nMore about the example guide.\n' >> docs/src/content/docs/guides/example.md
git add -A && commit_as sam 12 "Expand the example guide"
with_remote monorepo
git config core.hooksPath .githooks
# Someone's unrelated work in progress, which commits from AE must leave alone:
printf 'export const version = "2"\n' >> packages/widget/src/index.ts
git add packages/widget/src/index.ts                       # staged, outside docs/
printf '\nUnstaged README edit.\n' >> README.md            # unstaged, outside docs/
printf '// staged config tweak\n' >> docs/astro.config.mjs
git add docs/astro.config.mjs                              # staged, inside docs/

# --- ignored-site: a site in a folder that the parent repo ignores ------------
# Opening ignored-site/site should say it isn't in a repository
I="$ROOT/ignored-site"
mkdir -p "$I"
cd "$I"
git init -q
printf 'site/\n' > .gitignore
printf '# Parent repo that ignores site/\n' > README.md
git add -A && commit_as me 5 "Parent repo"
copy_site dummy-astro-project "$I/site"

# --- no-repo: a site with no git at all ---------------------------------------
copy_site dummy-astro-project "$ROOT/no-repo"

# --- submodule: a parent repo with the site as a submodule in site/ -----------
S="$ROOT/submodule-site-src"
copy_site dummy-astro-project "$S"
cd "$S"
git init -q
git add -A && commit_as me 15 "Initial site"
with_remote submodule-site
cd "$ROOT" && rm -rf "$S"
P="$ROOT/submodule-parent"
mkdir -p "$P" && cd "$P"
git init -q
printf '# Parent with the site as a submodule\n' > README.md
git add -A && commit_as me 14 "Parent repo"
git submodule -q add "$ROOT/remotes/submodule-site.git" site
commit_as me 14 "Add the site as a submodule"

# node_modules isn't copied (it's large); AE reads Starlight's components from it,
# and the sites should build. bun's cache makes this quick
for site in "$B" "$ROOT/blog-collaborator" "$I/site" "$ROOT/no-repo" "$P/site"; do
  (cd "$site" && bun install --silent)
done

echo "Built in $ROOT:"
for r in blog blog-collaborator monorepo ignored-site no-repo submodule-parent; do
  printf '  %-18s %s\n' "$r" "$(git -C "$ROOT/$r" log -1 --format='%h %s' 2>/dev/null || echo '(no repo)')"
done
