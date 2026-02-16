#!/usr/bin/env node

import fs from 'fs'
import { execSync } from 'child_process'
import readline from 'readline'

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

function bumpPatch(version) {
  const parts = version.split('.')
  parts[2] = String(Number(parts[2]) + 1)
  return parts.join('.')
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
  const cleanVersion = await resolveVersion()
  const tagVersion = `v${cleanVersion}`

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
    exec('pnpm run check:all')
    console.log('✅ All checks passed')

    // Update package.json
    console.log('\n📝 Updating package.json...')
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    const oldPkgVersion = pkg.version
    pkg.version = cleanVersion
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
    console.log(`   ${oldPkgVersion} → ${cleanVersion}`)

    // Update Cargo.toml
    console.log('📝 Updating Cargo.toml...')
    const cargoPath = 'src-tauri/Cargo.toml'
    const cargoToml = fs.readFileSync(cargoPath, 'utf8')
    const oldCargoVersion = cargoToml.match(/version = "([^"]*)"/)
    const updatedCargo = cargoToml.replace(
      /version = "[^"]*"/,
      `version = "${cleanVersion}"`
    )
    fs.writeFileSync(cargoPath, updatedCargo)
    console.log(
      `   ${oldCargoVersion ? oldCargoVersion[1] : 'unknown'} → ${cleanVersion}`
    )

    // Update tauri.conf.json
    console.log('📝 Updating tauri.conf.json...')
    const tauriConfigPath = 'src-tauri/tauri.conf.json'
    const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'))
    const oldTauriVersion = tauriConfig.version
    tauriConfig.version = cleanVersion
    fs.writeFileSync(
      tauriConfigPath,
      JSON.stringify(tauriConfig, null, 2) + '\n'
    )
    console.log(`   ${oldTauriVersion} → ${cleanVersion}`)

    // Run npm install to update lock files
    console.log('\n📦 Updating lock files...')
    exec('pnpm install', { silent: true })
    console.log('✅ Lock files updated')

    // Verify configurations
    console.log('\n🔍 Verifying configurations...')

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
    exec('source ~/.cargo/env && cd src-tauri && cargo check')
    console.log('✅ Rust compilation check passed')

    console.log(`\n🎉 Successfully prepared release ${tagVersion}!`)
    console.log('\n📋 Git commands to execute:')
    console.log(`   git add .`)
    console.log(`   git commit -S -m "chore: release ${tagVersion}"`)
    console.log(`   git tag -m "Release ${tagVersion}" ${tagVersion}`)
    console.log(`   git push origin main --tags`)

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

      console.log('📤 Pushing to remote...')
      exec('git push origin main --tags')

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
