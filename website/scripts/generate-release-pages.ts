#!/usr/bin/env npx tsx
/**
 * Generate release pages from GitHub releases.
 *
 * Usage:
 *   npx tsx scripts/generate-release-pages.ts [--all] [--dry-run]
 *
 * Options:
 *   --all       Include all releases (post-1.0.0 are always included;
 *               pre-1.0.0 are included without prompting)
 *   --dry-run   Print what would be generated without writing files
 *
 * Without --all, pre-1.0.0 releases are presented for manual approval.
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as readline from 'node:readline'

const RELEASES_DIR = join(import.meta.dirname, '../src/content/docs/releases')
const IMAGES_DIR = join(import.meta.dirname, '../public/releases')
const REPO = 'dannysmith/astro-editor'

interface Release {
  tagName: string
  name: string
  publishedAt: string
  body: string
}

// ── Helpers ──────────────────────────────────────────────────────────

function isPost1_0(tag: string): boolean {
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)/)
  if (!match) return false
  const [, major, minor] = match.map(Number)
  return major >= 1
}

function versionFromTag(tag: string): string {
  return tag.replace(/^v/, '')
}

function formatDate(iso: string): string {
  return iso.split('T')[0] // YYYY-MM-DD
}

/**
 * Escape content for safe MDX rendering:
 * - Curly braces in prose (not in code blocks) → HTML entities
 * - Strip "Installation Instructions" boilerplate section
 * - Strip leading H2 title that duplicates the frontmatter title
 */
function sanitiseBody(body: string): string {
  let text = body

  // Strip the leading "## Astro Editor vX.Y.Z" or "## 🚀 Astro Editor vX.Y.Z"
  text = text.replace(/^##\s*(?:🚀\s*)?Astro Editor\s+v[\d.]+\s*\n*/i, '')

  // Strip "Installation Instructions" section and everything after it
  text = text.replace(/### Installation Instructions[\s\S]*$/i, '')

  // Strip "Full Changelog" links
  text = text.replace(/\*\*Full Changelog\*\*:.*$/gm, '')

  // Escape curly braces outside of code blocks/spans
  text = escapeCurlyBraces(text)

  // Trim trailing whitespace
  text = text.trimEnd()

  return text
}

/**
 * Escape { and } in prose but leave code blocks and inline code alone.
 */
function escapeCurlyBraces(text: string): string {
  const lines = text.split('\n')
  let inCodeBlock = false
  const result: string[] = []

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    if (inCodeBlock) {
      result.push(line)
      continue
    }

    // For non-code lines, escape braces outside of inline code spans
    result.push(escapeLineOutsideCode(line))
  }

  return result.join('\n')
}

function escapeLineOutsideCode(line: string): string {
  // Split by inline code spans, supporting multi-backtick delimiters (e.g. `` `code` ``)
  const parts = line.split(/(`+[^`]*`+)/)
  return parts
    .map((part, i) => {
      // Odd indices are inside backticks
      if (i % 2 === 1) return part
      // Escape braces in prose
      return part.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;')
    })
    .join('')
}

/**
 * Download GitHub user-attachment images to local public/releases/ and rewrite URLs.
 */
function localiseImages(body: string, version: string, dryRun: boolean): string {
  const pattern = /https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+/g
  const urls = [...new Set(body.match(pattern) || [])]

  if (urls.length === 0) return body

  if (!dryRun) {
    mkdirSync(IMAGES_DIR, { recursive: true })
  }

  let result = body
  urls.forEach((url, i) => {
    const localName = `${version}-${i + 1}.png`
    const localPath = join(IMAGES_DIR, localName)

    if (!dryRun) {
      execSync(`curl -sL -o "${localPath}" "${url}"`)
      console.log(`    Downloaded image: ${localName}`)
    } else {
      console.log(`    DRY-RUN would download: ${url} → ${localName}`)
    }

    result = result.replaceAll(url, `/releases/${localName}`)
  })

  return result
}

function generatePage(release: Release): string {
  const version = versionFromTag(release.tagName)
  const date = formatDate(release.publishedAt)
  const body = sanitiseBody(release.body)
  const ghUrl = `https://github.com/${REPO}/releases/tag/${release.tagName}`

  const hasContent = body.trim().length > 0

  return [
    '---',
    `title: 'v${version}'`,
    `description: 'Astro Editor v${version}'`,
    `date: ${date}`,
    `slug: 'releases/v${version}'`,
    '---',
    '',
    ...(hasContent ? [body, '', '---', ''] : []),
    `[View on GitHub](${ghUrl})`,
    '',
  ].join('\n')
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const includeAll = args.includes('--all')
  const dryRun = args.includes('--dry-run')

  // Fetch all releases (list endpoint doesn't include body)
  console.log('Fetching releases from GitHub...')
  const json = execSync(
    `gh release list --repo ${REPO} --limit 100 --json tagName,name,publishedAt`,
    { encoding: 'utf-8' }
  )
  const summaries: Omit<Release, 'body'>[] = JSON.parse(json)

  // Fetch bodies individually
  console.log(`Found ${summaries.length} releases. Fetching bodies...`)
  const releases: Release[] = summaries.map((summary) => {
    const body = execSync(
      `gh release view "${summary.tagName}" --repo ${REPO} --json body -q .body`,
      { encoding: 'utf-8' }
    )
    return { ...summary, body }
  })

  // Ensure output directory exists
  if (!dryRun) {
    mkdirSync(RELEASES_DIR, { recursive: true })
  }

  let generated = 0
  let skipped = 0

  for (const release of releases) {
    const version = versionFromTag(release.tagName)
    const filePath = join(RELEASES_DIR, `${version}.mdx`)

    if (existsSync(filePath)) {
      console.log(`  SKIP ${version} (already exists)`)
      skipped++
      continue
    }

    const post1 = isPost1_0(release.tagName)

    if (!post1 && !includeAll) {
      console.log(`\n── ${release.tagName} (pre-1.0) ──`)
      const body = sanitiseBody(release.body)
      if (body.trim().length === 0) {
        console.log('  (empty body after stripping boilerplate)')
      } else {
        console.log(body.slice(0, 300))
        if (body.length > 300) console.log('  ...')
      }
      const answer = await ask('  Include this release? [y/N] ')
      if (answer !== 'y') {
        console.log(`  SKIP ${version}`)
        skipped++
        continue
      }
    }

    release.body = localiseImages(release.body, versionFromTag(release.tagName), dryRun)
    const content = generatePage(release)

    if (dryRun) {
      console.log(`  DRY-RUN would write ${version}.mdx`)
    } else {
      writeFileSync(filePath, content, 'utf-8')
      console.log(`  WROTE ${version}.mdx`)
    }
    generated++
  }

  console.log(`\nDone. Generated: ${generated}, Skipped: ${skipped}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
