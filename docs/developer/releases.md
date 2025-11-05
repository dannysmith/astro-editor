# Release Process Guide

This document explains how to create releases for Astro Editor using the automated GitHub Actions workflow.

## Release Process

### Method 1: Command Line

**Step 1: Prepare Release**

```bash
# Ensure you're on main branch and up to date
git checkout main
git pull origin main

# Verify everything works
pnpm run check:all
```

**Step 2: Update Version Numbers**

```bash
# Update package.json version (example: 0.1.0 → 0.1.1)
# Update src-tauri/Cargo.toml version to match
# You can do this manually or wait for the automation script
```

**Step 3: Create and Push Tag**

```bash
# Commit version changes first
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to 0.1.1"

# Create and push tag (this triggers the release workflow)
git tag v0.1.1
git push origin main --tags
```

### Method 2: GitHub Web Interface

**Step 1: Go to Releases**

- Navigate to your GitHub repository
- Click "Releases" in the right sidebar
- Click "Create a new release"

**Step 2: Create Tag**

- Click "Choose a tag" dropdown
- Type new tag name (e.g., `v0.1.1`)
- Click "Create new tag: v0.1.1 on publish"

**Step 3: Fill Release Info**

- Release title: `Astro Editor v0.1.1`
- Description: Brief summary of changes
- Click "Publish release"

## What Happens After Tagging

### Automatic Workflow Steps

1. **Workflow Triggers** - GitHub Actions starts when tag is pushed
2. **Create Draft Release** - Initial release draft is created
3. **Multi-Platform Builds** - Builds for macOS, Windows, and Linux simultaneously
4. **Upload Assets** - All installers and updater files are attached
5. **Publish Release** - Draft becomes public release automatically

### Build Artifacts Created

- `Astro Editor_0.1.1_universal.dmg` (macOS installer)
- `Astro Editor_0.1.1_x64_en-US.msi` (Windows installer)
- `astro-editor_0.1.1_amd64.deb` (Debian package)
- `astro-editor_0.1.1_amd64.AppImage` (Linux AppImage)
- `latest.json` (Auto-updater manifest)
- `.sig` signature files for verification

## Testing the Release System

### Test 1: First Release

1. **Create Initial Release**

   ```bash
   # Start with version 0.1.0
   git tag v0.1.0
   git push origin main --tags
   ```

2. **Monitor Workflow**
   - Go to GitHub → Actions tab
   - Watch "Release Astro Editor" workflow
   - Should take 10-15 minutes to complete

3. **Verify Release**
   - Check GitHub → Releases
   - Download and test one installer
   - Confirm all expected files are present

### Test 2: Auto-Update Testing

1. **Install First Release**
   - Download and install v0.1.0 from GitHub releases
   - Run the application

2. **Create Second Release**

   ```bash
   # Make a small change (e.g., update README)
   echo "Test update" >> README.md
   git add README.md
   git commit -m "test: minor change for update testing"

   # Update version to 0.1.1 in both package.json and Cargo.toml
   # Then create new release
   git tag v0.1.1
   git push origin main --tags
   ```

3. **Test Auto-Update**
   - Keep v0.1.0 app running
   - Wait 5 seconds after v0.1.1 release is published
   - Should see update notification dialog
   - Test the update process

## Branch Strategy

### Current Setup: Trunk-Based Development

- **Main Branch**: `main` - All development and releases happen here
- **No Feature Branches**: Direct commits to main (suitable for single developer)
- **Release Tags**: Created from main branch commits

### Release Workflow

```
main branch: ──●──●──●──●──●──●──●──
                    ↑        ↑
                 v0.1.0   v0.1.1
```

## Troubleshooting

### Common Issues

**Workflow doesn't trigger:**

- Ensure tag starts with `v` (e.g., `v1.0.0`, not `1.0.0`)
- Check that tag was pushed: `git push origin --tags`

**Build fails:**

- Verify `TAURI_PRIVATE_KEY` secret is set correctly
- Check that all tests pass locally: `pnpm run check:all`

**Auto-update doesn't work:**

- Confirm updater endpoint URLs match your GitHub repository
- Verify public key in `tauri.conf.json` matches private key
- Check console logs in the app for error messages

**Version mismatches:**

- Ensure `package.json` and `src-tauri/Cargo.toml` versions match
- Tags should match the version in `package.json`

### Manual Cleanup

**Delete a tag (if needed):**

```bash
# Delete local tag
git tag -d v0.1.0

# Delete remote tag
git push origin --delete v0.1.0
```

**Cancel a running workflow:**

- Go to GitHub → Actions → Select workflow run → Cancel

## Quick Reference Commands

```bash
# Check current version
grep '"version"' package.json

# List all tags
git tag -l

# Create and push tag
git tag v0.1.1 && git push origin main --tags

# Run all checks
pnpm run check:all
```

## Next Steps

Once this basic process is working, we can add:

- [ ] Automated version bumping script
- [ ] Changelog generation
- [ ] Pre-release testing workflow
- [ ] Code signing for distribution outside Mac App Store
