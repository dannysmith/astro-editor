import { describe, it, expect } from 'vitest'
import {
  bumpPatch,
  latestStableTag,
  nextTestVersion,
  wixVersion,
} from './release-version'

describe('bumpPatch', () => {
  it('bumps the patch number', () => {
    expect(bumpPatch('1.0.9')).toBe('1.0.10')
  })
})

describe('wixVersion', () => {
  it('moves the prerelease number into the fourth field', () => {
    expect(wixVersion('1.0.21-test.3')).toBe('1.0.21.3')
  })

  it('rejects versions WiX could not take', () => {
    expect(() => wixVersion('1.0.21-test')).toThrow()
    expect(() => wixVersion('1.0.21')).toThrow()
  })
})

describe('latestStableTag', () => {
  it('picks the highest stable tag, ignoring prereleases', () => {
    expect(
      latestStableTag(['v1.0.9', 'v1.0.20', 'v1.0.21-test.1', 'v1.0.10'])
    ).toBe('v1.0.20')
  })
})

describe('nextTestVersion', () => {
  it('starts at test.1 on the patch after the latest stable release', () => {
    expect(nextTestVersion(['v1.0.9', 'v1.0.20', 'v1.0.19'])).toBe(
      '1.0.21-test.1'
    )
  })

  it('numbers after existing test builds of the same version', () => {
    expect(
      nextTestVersion([
        'v1.0.20',
        'v1.0.21-test.1',
        'v1.0.21-test.4',
        'v1.0.20-test.9',
      ])
    ).toBe('1.0.21-test.5')
  })

  it('ignores test builds and other tags when finding the latest release', () => {
    expect(
      nextTestVersion(['v1.0.20', 'v1.0.21-test.2', 'v0.0.0-linux-test'])
    ).toBe('1.0.21-test.3')
  })

  it('compares versions numerically, not as text', () => {
    expect(nextTestVersion(['v1.0.9', 'v1.1.0', 'v1.0.10'])).toBe(
      '1.1.1-test.1'
    )
  })

  it('throws when there is no stable release', () => {
    expect(() => nextTestVersion(['v1.0.21-test.1'])).toThrow()
  })
})
