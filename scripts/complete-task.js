#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.join(__dirname, '..', 'docs')
const TODO_DIR = path.join(DOCS_DIR, 'tasks-todo')
const DONE_DIR = path.join(DOCS_DIR, 'tasks-done')

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get last modified date of a file
 */
function getLastModifiedDate(filePath) {
  const stats = fs.statSync(filePath)
  return new Date(stats.mtime)
}

/**
 * Strip task number prefix (task-1-, task-2-, task-x-, etc.)
 * Also strips standalone "task-" prefix without number
 */
function stripTaskNumber(filename) {
  // First strip numbered prefixes (task-1-, task-2-, task-x-)
  let cleaned = filename.replace(/^task-[0-9x]+-/, '')
  // Then strip any remaining "task-" prefix
  cleaned = cleaned.replace(/^task-/, '')
  return cleaned
}

/**
 * Add date prefix to task name
 */
function addDatePrefix(filename, date) {
  const dateStr = formatDate(date)
  const nameWithoutTaskPrefix = stripTaskNumber(filename)
  return `task-${dateStr}-${nameWithoutTaskPrefix}`
}

/**
 * Rename all existing completed tasks with their last modified dates
 */
function renameExistingTasks() {
  console.log('📁 Renaming existing completed tasks...\n')

  const files = fs.readdirSync(DONE_DIR)
  const taskFiles = files.filter(f => f.endsWith('.md'))

  let renamedCount = 0
  let skippedCount = 0

  taskFiles.forEach(filename => {
    const oldPath = path.join(DONE_DIR, filename)

    // Skip if already has date format (task-YYYY-MM-DD-)
    if (/^task-\d{4}-\d{2}-\d{2}-/.test(filename)) {
      console.log(`⏭️  Skipping (already dated): ${filename}`)
      skippedCount++
      return
    }

    const modifiedDate = getLastModifiedDate(oldPath)
    const newFilename = addDatePrefix(filename, modifiedDate)
    const newPath = path.join(DONE_DIR, newFilename)

    fs.renameSync(oldPath, newPath)
    console.log(`✅ ${filename}`)
    console.log(`   → ${newFilename}\n`)
    renamedCount++
  })

  console.log(`\n📊 Summary:`)
  console.log(`   Renamed: ${renamedCount}`)
  console.log(`   Skipped: ${skippedCount}`)
  console.log(`   Total:   ${taskFiles.length}`)
}

/**
 * Complete a task: move from todo to done with today's date
 */
function completeTask(taskIdentifier) {
  console.log(`📝 Completing task: ${taskIdentifier}\n`)

  // Find matching file in tasks-todo
  const todoFiles = fs.readdirSync(TODO_DIR)
  const matchingFile = todoFiles.find(f => {
    const normalized = f.toLowerCase().replace('.md', '')
    const searchTerm = taskIdentifier.toLowerCase()
    return normalized.includes(searchTerm) || normalized.endsWith(searchTerm)
  })

  if (!matchingFile) {
    console.error(`❌ Error: No task found matching "${taskIdentifier}"`)
    console.error(`\nAvailable tasks in tasks-todo/:`)
    todoFiles
      .filter(f => f.endsWith('.md'))
      .forEach(f => console.error(`   - ${f}`))
    process.exit(1)
  }

  const oldPath = path.join(TODO_DIR, matchingFile)
  const todayDate = new Date()
  const newFilename = addDatePrefix(matchingFile, todayDate)
  const newPath = path.join(DONE_DIR, newFilename)

  // Check if destination already exists
  if (fs.existsSync(newPath)) {
    console.error(
      `❌ Error: Task already exists in tasks-done: ${newFilename}`
    )
    process.exit(1)
  }

  fs.renameSync(oldPath, newPath)

  console.log(`✅ Task completed!`)
  console.log(`   From: tasks-todo/${matchingFile}`)
  console.log(`   To:   tasks-done/${newFilename}`)
  console.log(`   Date: ${formatDate(todayDate)}`)
}

/**
 * Show usage help
 */
function showHelp() {
  console.log(`
📋 Task Completion Script

Usage:
  pnpm task:complete <task-name>         Complete a task
  pnpm task:rename-done                  Rename all existing completed tasks

Examples:
  pnpm task:complete frontend-performance
  pnpm task:complete 2
  pnpm task:rename-done

Notes:
  - Task name can be partial (e.g., "frontend" matches "task-2-frontend-performance-optimization.md")
  - Completed tasks are moved to tasks-done/ with format: task-YYYY-MM-DD-description.md
  - Existing tasks are renamed using their last modified date
`)
}

// Main execution
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  showHelp()
  process.exit(0)
}

if (args.includes('--rename-existing')) {
  renameExistingTasks()
} else if (args.length === 0) {
  console.error('❌ Error: No task specified\n')
  showHelp()
  process.exit(1)
} else {
  const taskIdentifier = args.join(' ')
  completeTask(taskIdentifier)
}
