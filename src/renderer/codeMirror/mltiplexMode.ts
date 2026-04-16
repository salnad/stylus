/* eslint-disable @typescript-eslint/no-explicit-any, no-use-before-define */

const multiplexMode = (CodeMirror: any): void => {
  CodeMirror.multiplexingMode = function (outer: any, ...rest: any[]) {
    const others = rest

    function indexOf (string: string, pattern: string | RegExp, from: number, returnEnd?: boolean): number {
      if (typeof pattern === 'string') {
        const found = string.indexOf(pattern, from)
        return returnEnd && found > -1 ? found + pattern.length : found
      }
      const match = pattern.exec(from ? string.slice(from) : string)
      return match ? match.index + from + (returnEnd ? match[0].length : 0) : -1
    }

    return {
      startState () {
        return {
          outer: CodeMirror.startState(outer),
          innerActive: null,
          inner: null
        }
      },

      copyState (state: any) {
        return {
          outer: CodeMirror.copyState(outer, state.outer),
          innerActive: state.innerActive,
          inner: state.innerActive && CodeMirror.copyState(state.innerActive.mode, state.inner)
        }
      },

      token (stream: any, state: any): any {
        if (!state.innerActive) {
          let cutOff = Infinity
          const oldContent = stream.string
          for (let index = 0; index < others.length; ++index) {
            const other = others[index]
            const found = indexOf(oldContent, other.open, stream.pos)
            if (found === stream.pos) {
              if (!other.parseDelimiters) stream.match(other.open)
              state.innerActive = other

              let outerIndent = 0
              if (outer.indent) {
                const possibleOuterIndent = outer.indent(state.outer, '')
                if (possibleOuterIndent !== CodeMirror.Pass) outerIndent = possibleOuterIndent
              }

              state.inner = CodeMirror.startState(other.mode, outerIndent)
              return other.delimStyle && (other.delimStyle + ' ' + other.delimStyle + '-open')
            } else if (found !== -1 && found < cutOff) {
              cutOff = found
            }
          }
          if (cutOff !== Infinity) stream.string = oldContent.slice(0, cutOff)
          const outerToken = outer.token(stream, state.outer)
          if (cutOff !== Infinity) stream.string = oldContent
          return outerToken
        } else {
          const curInner = state.innerActive
          const oldContent = stream.string
          if (!curInner.close && stream.sol()) {
            state.innerActive = state.inner = null
            return this.token(stream, state)
          }
          const found = curInner.close ? indexOf(oldContent, curInner.close, stream.pos, curInner.parseDelimiters) : -1
          if (found === stream.pos && !curInner.parseDelimiters) {
            stream.match(curInner.close)
            state.innerActive = state.inner = null
            return curInner.delimStyle && (curInner.delimStyle + ' ' + curInner.delimStyle + '-close')
          }
          if (found > -1) stream.string = oldContent.slice(0, found)
          let innerToken = curInner.mode.token(stream, state.inner)
          if (found > -1) stream.string = oldContent

          if (found === stream.pos && curInner.parseDelimiters) {
            state.innerActive = state.inner = null
          }

          if (curInner.innerStyle) {
            if (innerToken) innerToken = innerToken + ' ' + curInner.innerStyle
            else innerToken = curInner.innerStyle
          }

          return innerToken
        }
      },

      indent (state: any, textAfter: string) {
        const mode = state.innerActive ? state.innerActive.mode : outer
        if (!mode.indent) return CodeMirror.Pass
        return mode.indent(state.innerActive ? state.inner : state.outer, textAfter)
      },

      blankLine (state: any) {
        const mode = state.innerActive ? state.innerActive.mode : outer
        if (mode.blankLine) {
          mode.blankLine(state.innerActive ? state.inner : state.outer)
        }
        if (!state.innerActive) {
          for (let index = 0; index < others.length; ++index) {
            const other = others[index]
            if (other.open === '\n') {
              state.innerActive = other
              state.inner = CodeMirror.startState(other.mode, mode.indent ? mode.indent(state.outer, '') : 0)
            }
          }
        } else if (state.innerActive.close === '\n') {
          state.innerActive = state.inner = null
        }
      },

      electricChars: outer.electricChars,

      innerMode (state: any) {
        return state.inner
          ? { state: state.inner, mode: state.innerActive.mode }
          : { state: state.outer, mode: outer }
      }
    }
  }
}

export default multiplexMode
