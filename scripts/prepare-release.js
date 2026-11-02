#!/usr/bin/env node

import fs from 'fs'
import { execSync } from 'child_process'
import readline from 'readline'
import { bumpPatch, latestStableTag, setVersion } from './release-version.js'

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    })
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`)
  }
}

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function resolveVersion() {
  const arg = process.argv[2]

  // If a valid version was passed as argument, use it directly
  if (arg && arg.match(/^v?\d+\.\d+\.\d+$/)) {
    const clean = arg.replace('v', '')
    return clean
  }

  if (arg) {
    console.error(`❌ Invalid version format: ${arg}`)
    console.error('   Expected: v1.0.0 or 1.0.0')
    process.exit(1)
  }

  // Auto-detect from package.json and propose patch bump
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const current = pkg.version
  const proposed = bumpPatch(current)

  const answer = await askQuestion(
    `📦 Current version: ${current}\n❓ Release version? (${proposed}): `
  )

  const chosen = answer || proposed
  if (!chosen.match(/^\d+\.\d+\.\d+$/)) {
    console.error(`❌ Invalid version format: ${chosen}`)
    process.exit(1)
  }

  return chosen
}

async function prepareRelease() {
  // Releases normally come from main. Anywhere else is a hotfix branch made
  // from the latest release tag, which gets merged back into main afterwards
  const branch = exec('git branch --show-current', { silent: true }).trim()
  if (!branch) {
    console.error('❌ Not on a branch. Switch to main or a hotfix branch.')
    process.exit(1)
  }
  const onMain = branch === 'main'
  if (!onMain) {
    const answer = await askQuestion(
      `⚠️  You're on ${branch}, not main. Releasing from here is for hotfixes.\n❓ Continue? (y/N): `
    )
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      process.exit(0)
    }
  }

  console.log('🔍 Fetching tags...')
  exec('git fetch --tags', { silent: true })

  // A hotfix built from an older release would quietly drop everything since
  if (!onMain) {
    const tags = exec("git tag --list 'v*'", { silent: true }).split('\n')
    const latest = latestStableTag(tags)
    try {
      exec(`git merge-base --is-ancestor ${latest} HEAD`, { silent: true })
    } catch {
      console.error(
        `❌ ${branch} doesn't contain ${latest}, the latest release. Branch hotfixes from it: git switch -c hotfix/<version> ${latest}`
      )
      process.exit(1)
    }
  }

  const cleanVersion = await resolveVersion()
  const tagVersion = `v${cleanVersion}`

  const existingTag = exec(`git tag --list ${tagVersion}`, {
    silent: true,
  }).trim()
  if (existingTag) {
    console.error(`❌ Tag ${tagVersion} already exists.`)
    process.exit(1)
  }

  console.log(`🚀 Preparing release ${tagVersion}...\n`)

  try {
    // Check git status
    console.log('🔍 Checking git status...')
    const gitStatus = exec('git status --porcelain', { silent: true })
    if (gitStatus.trim()) {
      console.error(
        '❌ Working directory is not clean. Please commit or stash changes first.'
      )
      console.log('Uncommitted changes:')
      console.log(gitStatus)
      process.exit(1)
    }
    console.log('✅ Working directory is clean')

    // Run all checks first
    console.log('\n🔍 Running pre-release checks...')
    exec('bun run check:all')
    console.log('✅ All checks passed')

    console.log('')
    setVersion(cleanVersion)

    // Run bun install to update the lockfile
    console.log('\n📦 Updating lock files...')
    exec('bun install', { silent: true })
    console.log('✅ Lock files updated')

    // Verify configurations
    console.log('\n🔍 Verifying configurations...')
    const tauriConfig = JSON.parse(
      fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')
    )

    if (!tauriConfig.bundle?.createUpdaterArtifacts) {
      console.warn(
        '⚠️  Warning: createUpdaterArtifacts not enabled in tauri.conf.json'
      )
    } else {
      console.log('✅ Updater artifacts enabled')
    }

    if (!tauriConfig.plugins?.updater?.pubkey) {
      console.warn('⚠️  Warning: Updater public key not configured')
    } else {
      console.log('✅ Updater public key configured')
    }

    // Final check that Rust code compiles
    console.log('\n🔍 Running final compilation check...')
    exec('cd src-tauri && cargo check')
    console.log('✅ Rust compilation check passed')

    console.log(`\n🎉 Successfully prepared release ${tagVersion}!`)
    console.log('\n📋 Git commands to execute:')
    console.log(`   git add .`)
    console.log(`   git commit -S -m "chore: release ${tagVersion}"`)
    console.log(`   git tag -m "Release ${tagVersion}" ${tagVersion}`)
    console.log(`   git push --atomic origin HEAD ${tagVersion}`)

    console.log('\n🚀 After pushing:')
    console.log('   • GitHub Actions will automatically build the release')
    console.log('   • A draft release will be created on GitHub')
    console.log("   • You'll need to manually publish the draft release")
    console.log('   • Users will receive auto-update notifications')

    // Interactive execution option
    const answer = await askQuestion(
      '\n❓ Would you like me to execute these git commands? (y/N): '
    )

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log('\n⚡ Executing git commands...')

      console.log('📝 Adding changes...')
      exec('git add .')

      console.log('💾 Creating commit...')
      exec(`git commit -S -m "chore: release ${tagVersion}"`)

      console.log('🏷️  Creating tag...')
      exec(`git tag -m "Release ${tagVersion}" ${tagVersion}`)

      // Only this branch and the new tag, so stray local tags never start a build
      console.log('📤 Pushing to remote...')
      exec(`git push --atomic origin HEAD ${tagVersion}`)

      console.log(`\n🎊 Release ${tagVersion} has been published!`)
      console.log(
        '📱 Check GitHub Actions: https://github.com/dannysmith/astro-editor/actions'
      )
      console.log(
        '📦 Draft release will appear at: https://github.com/dannysmith/astro-editor/releases'
      )
      console.log(
        '\n⚠️  Remember: You need to manually publish the draft release on GitHub!'
      )
      if (!onMain) {
        console.log(
          `⚠️  Then open a PR from ${branch} into main so the fix and the version bump land there too.`
        )
      }
    } else {
      console.log('\n📝 Git commands saved for manual execution.')
      console.log("   Run them when you're ready to release.")
    }
  } catch (error) {
    console.error('\n❌ Pre-release preparation failed:', error.message)
    process.exit(1)
  }
}

// Run if this is the main module
prepareRelease()
