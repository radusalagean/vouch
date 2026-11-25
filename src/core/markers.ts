import type { Resolution, Status } from './anchor'

export type MarkerPart = 'start' | 'mid' | 'end' | 'only'

/** One gutter tile: a line plus its role in the run of same-status lines. */
export interface Marker {
  line: number // 1-based
  part: MarkerPart
  status: Status
}

// Per-line precedence when records share an anchor line: a dismissed review
// needs action first, an unresolved ambiguity second, a green mark last.
const RANK: Record<Status, number> = { dismissed: 2, ambiguous: 1, reviewed: 0 }

/**
 * Lay out gutter markers for a document: each line covered by any resolution
 * takes the highest-ranked status on that line, and contiguous same-status
 * lines become one run (start / mid… / end, or a lone 'only'). Runs are the
 * visual unit — a higher-ranked record punched into a reviewed run splits it
 * into two runs rather than being drawn over it.
 *
 * Ranges come from shared .vouch/ records, so they are clamped to the
 * document; a range that resolves entirely outside it contributes nothing.
 */
export function markersFor(entries: readonly { res: Resolution }[], lineCount: number): Marker[] {
  if (lineCount < 1) return []

  const byLine = new Map<number, Status>()
  for (const { res } of entries) {
    const start = Math.max(1, res.effectiveRange[0])
    const end = Math.min(lineCount, res.effectiveRange[1])
    for (let line = start; line <= end; line++) {
      const prev = byLine.get(line)
      if (prev === undefined || RANK[res.status] > RANK[prev]) byLine.set(line, res.status)
    }
  }

  const lines = [...byLine.keys()].sort((a, b) => a - b)
  const markers: Marker[] = []
  for (let i = 0; i < lines.length;) {
    const first = lines[i]!
    const status = byLine.get(first)!
    let last = first
    while (lines[i + 1] === last + 1 && byLine.get(last + 1) === status) {
      i++
      last = lines[i]!
    }
    i++

    if (first === last) {
      markers.push({ line: first, part: 'only', status })
      continue
    }
    markers.push({ line: first, part: 'start', status })
    for (let line = first + 1; line < last; line++) {
      markers.push({ line, part: 'mid', status })
    }
    markers.push({ line: last, part: 'end', status })
  }
  return markers
}
