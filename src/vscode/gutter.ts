import * as vscode from 'vscode'
import type { Status } from '../core/anchor'
import { markersFor, type MarkerPart } from '../core/markers'
import type { FileStatus } from './pipeline'

const RULER: Record<Status, string> = {
  reviewed: '#1DBF9A',
  dismissed: '#FF7A2E',
  ambiguous: '#E5B25E',
}

export class Gutter {
  private readonly decorations: Record<Status, Record<MarkerPart, vscode.TextEditorDecorationType>>

  constructor(extensionUri: vscode.Uri) {
    const mk = (svgs: Record<MarkerPart, string>, ruler: string) => {
      const make = (svg: string, marksRuler: boolean): vscode.TextEditorDecorationType =>
        vscode.window.createTextEditorDecorationType({
          gutterIconPath: vscode.Uri.joinPath(extensionUri, 'media', svg),
          // `gutterIconSize` is emitted verbatim as CSS `background-size`, and
          // icons are positioned `center center`: an exact width with 100%
          // height tiles the strip edge to edge on every line, independent of
          // line height and glyph-margin width. The SVGs carry
          // preserveAspectRatio="none" because background-size stretches them.
          gutterIconSize: '3px 100%',
          // Only the first tile of a run marks the overview ruler: one entry
          // per reviewed range, as before, instead of one per line.
          ...(marksRuler
            ? {
                overviewRulerColor: ruler,
                overviewRulerLane: vscode.OverviewRulerLane.Right,
              }
            : {}),
        })
      return {
        start: make(svgs.start, true),
        mid: make(svgs.mid, false),
        end: make(svgs.end, false),
        only: make(svgs.only, true),
      }
    }
    this.decorations = {
      reviewed: mk(
        {
          start: 'reviewed-start.svg',
          mid: 'reviewed-mid.svg',
          end: 'reviewed-end.svg',
          only: 'reviewed-only.svg',
        },
        RULER.reviewed,
      ),
      dismissed: mk(
        {
          start: 'dismissed-start.svg',
          mid: 'dismissed-mid.svg',
          end: 'dismissed-end.svg',
          only: 'dismissed-only.svg',
        },
        RULER.dismissed,
      ),
      ambiguous: mk(
        {
          start: 'ambiguous-start.svg',
          mid: 'ambiguous-mid.svg',
          end: 'ambiguous-end.svg',
          only: 'ambiguous-only.svg',
        },
        RULER.ambiguous,
      ),
    }
  }

  apply(editor: vscode.TextEditor, status: FileStatus): void {
    const empty = (): Record<MarkerPart, vscode.Range[]> => ({
      start: [],
      mid: [],
      end: [],
      only: [],
    })
    const ranges = { reviewed: empty(), dismissed: empty(), ambiguous: empty() }

    for (const m of markersFor(status.entries, editor.document.lineCount)) {
      ranges[m.status][m.part].push(new vscode.Range(m.line - 1, 0, m.line - 1, 0))
    }
    for (const s of ['reviewed', 'dismissed', 'ambiguous'] as const) {
      for (const p of ['start', 'mid', 'end', 'only'] as const) {
        editor.setDecorations(this.decorations[s][p], ranges[s][p])
      }
    }
  }

  dispose(): void {
    for (const perPart of Object.values(this.decorations)) {
      for (const d of Object.values(perPart)) d.dispose()
    }
  }
}
