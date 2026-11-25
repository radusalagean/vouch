import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { markersFor } from '../../src/core/markers'
import type { Resolution } from '../../src/core/anchor'

const res = (status: Resolution['status'], from: number, to: number): { res: Resolution } => ({
  res: { status, effectiveRange: [from, to] },
})

describe('markersFor', () => {
  it('returns nothing without entries or lines', () => {
    expect(markersFor([], 10)).toEqual([])
    expect(markersFor([res('reviewed', 1, 3)], 0)).toEqual([])
  })

  it('marks a single-line range as one lone capsule', () => {
    expect(markersFor([res('reviewed', 4, 4)], 10)).toEqual([
      { line: 4, part: 'only', status: 'reviewed' },
    ])
  })

  it('marks start, middle and end of a multi-line range', () => {
    expect(markersFor([res('reviewed', 2, 5)], 10)).toEqual([
      { line: 2, part: 'start', status: 'reviewed' },
      { line: 3, part: 'mid', status: 'reviewed' },
      { line: 4, part: 'mid', status: 'reviewed' },
      { line: 5, part: 'end', status: 'reviewed' },
    ])
  })

  it('merges adjacent same-status records into one run', () => {
    const marks = markersFor([res('reviewed', 1, 2), res('reviewed', 3, 4)], 10)
    expect(marks).toEqual([
      { line: 1, part: 'start', status: 'reviewed' },
      { line: 2, part: 'mid', status: 'reviewed' },
      { line: 3, part: 'mid', status: 'reviewed' },
      { line: 4, part: 'end', status: 'reviewed' },
    ])
  })

  it('keeps a gap between non-adjacent runs', () => {
    const marks = markersFor([res('reviewed', 1, 2), res('reviewed', 5, 6)], 10)
    expect(marks).toEqual([
      { line: 1, part: 'start', status: 'reviewed' },
      { line: 2, part: 'end', status: 'reviewed' },
      { line: 5, part: 'start', status: 'reviewed' },
      { line: 6, part: 'end', status: 'reviewed' },
    ])
  })

  it('splits a reviewed run around a higher-ranked record', () => {
    const marks = markersFor([res('reviewed', 1, 5), res('dismissed', 3, 3)], 10)
    expect(marks).toEqual([
      { line: 1, part: 'start', status: 'reviewed' },
      { line: 2, part: 'end', status: 'reviewed' },
      { line: 3, part: 'only', status: 'dismissed' },
      { line: 4, part: 'start', status: 'reviewed' },
      { line: 5, part: 'end', status: 'reviewed' },
    ])
  })

  it('ranks dismissed over ambiguous over reviewed on a shared line', () => {
    const marks = markersFor(
      [res('reviewed', 1, 3), res('ambiguous', 1, 3), res('dismissed', 2, 2)],
      3,
    )
    expect(marks).toEqual([
      { line: 1, part: 'only', status: 'ambiguous' },
      { line: 2, part: 'only', status: 'dismissed' },
      { line: 3, part: 'only', status: 'ambiguous' },
    ])
  })

  it('treats an identical-range clash by rank, not order', () => {
    const marks = markersFor([res('reviewed', 2, 3), res('ambiguous', 2, 3)], 5)
    expect(marks.map((m) => m.status)).toEqual(['ambiguous', 'ambiguous'])
  })

  it('turns a fully covered document into one run', () => {
    const marks = markersFor([res('reviewed', 1, 4)], 4)
    expect(marks).toEqual([
      { line: 1, part: 'start', status: 'reviewed' },
      { line: 2, part: 'mid', status: 'reviewed' },
      { line: 3, part: 'mid', status: 'reviewed' },
      { line: 4, part: 'end', status: 'reviewed' },
    ])
  })

  it('clamps ranges to the document', () => {
    expect(markersFor([res('reviewed', 0, 2)], 3)).toEqual([
      { line: 1, part: 'start', status: 'reviewed' },
      { line: 2, part: 'end', status: 'reviewed' },
    ])
    expect(markersFor([res('dismissed', 8, 12)], 10)).toEqual([
      { line: 8, part: 'start', status: 'dismissed' },
      { line: 9, part: 'mid', status: 'dismissed' },
      { line: 10, part: 'end', status: 'dismissed' },
    ])
    expect(markersFor([res('reviewed', 11, 20)], 10)).toEqual([])
  })
})

// gutter.ts builds each icon path as `media/${status}-${part}.svg`, so the
// assets are only correct if every pair exists and every SVG is stretchable:
// VS Code paints them with background-size 3px 100%, and without
// preserveAspectRatio="none" the browser letterboxes them and the strip breaks
// at every line boundary.
describe('gutter icons', () => {
  const svg = (status: string, part: string): string =>
    readFileSync(join(process.cwd(), 'media', `${status}-${part}.svg`), 'utf8')

  for (const status of ['reviewed', 'dismissed', 'ambiguous']) {
    for (const part of ['start', 'mid', 'end', 'only']) {
      it(`ships a stretchable ${status}/${part} icon`, () => {
        const icon = svg(status, part)
        expect(icon).toContain('viewBox="0 0 3 16"')
        expect(icon).toContain('preserveAspectRatio="none"')
      })
    }
  }
})
