#!/usr/bin/env node

// Tags the current commit as a test build, e.g. v1.0.21-test.3, and pushes the
// tag. release.yml builds it like a real release, sets the version inside the
// runner and publishes it as a prerelease. Nothing is committed, so no version
// change ends up on any branch.
//
//   bun run test-build ["what to test"]
//   bun run test-build --no-sign ["what to test"]

import { execFileSync, execSync } from 'child_process'
import readline from 'readline'
import { nextTestVersion } from './release-version.js'

const REPO_URL = 'https://github.com/dannysmith/astro-editor'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

/** Runs git attached to the terminal, so GPG can ask for the passphrase */
function gitInteractive(...args) {
  execFileSync('git', args, { stdio: 'inherit' })
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

async function testBuild() {
  const args = process.argv.slice(2)
  const noSign = args.includes('--no-sign')
  const note = args
    .filter(arg => arg !== '--no-sign')
    .join(' ')
    .trim()

  if (git('status', '--porcelain')) {
    console.error(
      '❌ Working directory is not clean. Commit or stash changes first, so the build matches what you think you are testing.'
    )
    process.exit(1)
  }

  // A tag runs the release.yml from its own commit, and older ones would
  // build a plain release instead
  try {
    git(
      'grep',
      '--quiet',
      'publish-test-build',
      'HEAD',
      '--',
      '.github/workflows/release.yml'
    )
  } catch {
    console.error(
      "❌ This commit's release.yml can't make test builds. Merge or rebase onto main first."
    )
    process.exit(1)
  }

  const branch = git('branch', '--show-current') || 'detached HEAD'
  const commit = git('rev-parse', '--short', 'HEAD')

  // The remote's tags, so test builds made elsewhere or deleted since are counted correctly
  console.log('🔍 Reading tags from GitHub...')
  const tags = git('ls-remote', '--tags', '--refs', 'origin')
    .split('\n')
    .map(line => line.split('refs/tags/')[1])
    .filter(Boolean)
  const version = nextTestVersion(tags)
  const tag = `v${version}`

  console.log(`\n🧪 Test build ${tag} from ${branch} at ${commit}`)
  if (note) console.log(`   ${note}`)

  console.log('\n🔍 Running pre-release checks...')
  execSync('bun run check:all', { stdio: 'inherit' })
  console.log('✅ All checks passed')

  const answer = await askQuestion(`\n❓ Tag and push ${tag}? (y/N): `)
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    console.log('Nothing tagged.')
    return
  }

  // release.yml uses the subject as the release's name and the body as its notes
  const subject = `Test build ${version} (${branch})`
  const body = [
    `A test build of \`${branch}\` at ${commit}. It's built and signed like a real release, but isn't one.`,
    note,
    "Installing it replaces your copy of Astro Editor and uses your normal settings. When the next stable release comes out, it'll offer to update you to it.",
  ]
    .filter(Boolean)
    .join('\n\n')

  console.log('\n🏷️  Creating tag...')
  gitInteractive(
    'tag',
    ...(noSign ? ['--no-sign'] : []),
    '-m',
    subject,
    '-m',
    body,
    tag
  )

  console.log('📤 Pushing tag...')
  gitInteractive('push', 'origin', `refs/tags/${tag}`)

  console.log(`\n🎊 Test build ${tag} is building.`)
  console.log(`📱 Actions: ${REPO_URL}/actions`)
  console.log(
    `📦 Once every platform has built, it's published here: ${REPO_URL}/releases/tag/${tag}`
  )
  console.log(
    `🧹 Delete it when you're done: gh release delete ${tag} --cleanup-tag`
  )
}

testBuild().catch(error => {
  console.error('\n❌ Test build failed:', error.message)
  process.exit(1)
})
