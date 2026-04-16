/* eslint-disable @typescript-eslint/no-explicit-any, no-use-before-define */

type OverlayState = {
  base: any
  overlay: any
  basePos: number
  baseCur: string | null
  overlayPos: number
  overlayCur: string | null
  streamSeen: any
}

const overlayMode = (CodeMirror: any): void => {
  CodeMirror.overlayMode = function (base: any, overlay: any, combine?: boolean) {
    return {
      startState (): OverlayState {
        return {
          base: CodeMirror.startState(base),
          overlay: CodeMirror.startState(overlay),
          basePos: 0,
          baseCur: null,
          overlayPos: 0,
          overlayCur: null,
          streamSeen: null
        }
      },

      copyState (state: OverlayState): OverlayState {
        return {
          base: CodeMirror.copyState(base, state.base),
          overlay: CodeMirror.copyState(overlay, state.overlay),
          basePos: state.basePos,
          baseCur: null,
          overlayPos: state.overlayPos,
          overlayCur: null,
          streamSeen: null
        }
      },

      token (stream: any, state: OverlayState): string | null {
        if (stream !== state.streamSeen ||
          Math.min(state.basePos, state.overlayPos) < stream.start) {
          state.streamSeen = stream
          state.basePos = state.overlayPos = stream.start
        }

        if (stream.start === state.basePos) {
          state.baseCur = base.token(stream, state.base)
          state.basePos = stream.pos
        }

        if (stream.start === state.overlayPos) {
          stream.pos = stream.start
          state.overlayCur = overlay.token(stream, state.overlay)
          state.overlayPos = stream.pos
        }

        stream.pos = Math.min(state.basePos, state.overlayPos)

        if (state.overlayCur === null) {
          return state.baseCur
        } else if (
          (state.baseCur !== null &&
          state.overlay.combineTokens) ||
          (combine && state.overlay.combineTokens === null)
        ) {
          return `${state.baseCur} ${state.overlayCur}`
        } else {
          return state.overlayCur
        }
      },

      indent: base.indent && function (state: OverlayState, textAfter: string) {
        return base.indent(state.base, textAfter)
      },

      electricChars: base.electricChars,

      innerMode (state: OverlayState) {
        return {
          state: state.base,
          mode: base
        }
      },

      blankLine (state: OverlayState): string | null | undefined {
        let baseToken
        let overlayToken
        if (base.blankLine) baseToken = base.blankLine(state.base)
        if (overlay.blankLine) overlayToken = overlay.blankLine(state.overlay)

        return overlayToken == null
          ? baseToken
          : (combine && baseToken != null ? `${baseToken} ${overlayToken}` : overlayToken)
      }
    }
  }
}

export default overlayMode
