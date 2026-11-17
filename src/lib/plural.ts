/** A count with its noun, like "1 file" or "3 files" */
export function counted(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}
