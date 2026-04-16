// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

type CodeMirrorMode = {
  dependencies?: string[]
}

type CodeMirrorLike = {
  modeURL?: string
  modes: Record<string, CodeMirrorMode>
  requireMode?: (mode: string | { name: string }, cont: () => void) => void
  autoLoadMode?: (instance: unknown, mode: string) => void
  on(element: HTMLElement, event: string, listener: () => void): void
}

const loadMore = (CodeMirror: CodeMirrorLike): void => {
  if (!CodeMirror.modeURL) {
    CodeMirror.modeURL = '../../mode/%N/%N.js'
  }

  const loading: Record<string, Array<() => void>> = {}

  const splitCallback = (cont: () => void, count: number): (() => void) => {
    let countDown = count
    return () => {
      if (--countDown === 0) {
        cont()
      }
    }
  }

  const ensureDeps = (mode: string, cont: () => void): void => {
    const deps = CodeMirror.modes[mode].dependencies
    if (!deps) {
      cont()
      return
    }

    const missing: string[] = []
    for (let i = 0; i < deps.length; ++i) {
      if (!Object.prototype.hasOwnProperty.call(CodeMirror.modes, deps[i])) {
        missing.push(deps[i])
      }
    }
    if (!missing.length) {
      cont()
      return
    }

    const split = splitCallback(cont, missing.length)
    for (let i = 0; i < missing.length; ++i) {
      CodeMirror.requireMode?.(missing[i], split)
    }
  }

  CodeMirror.requireMode = (mode: string | { name: string }, cont: () => void) => {
    const modeName = typeof mode === 'string' ? mode : mode.name
    if (Object.prototype.hasOwnProperty.call(CodeMirror.modes, modeName)) {
      ensureDeps(modeName, cont)
      return
    }
    if (Object.prototype.hasOwnProperty.call(loading, modeName)) {
      loading[modeName].push(cont)
      return
    }

    const file = (CodeMirror.modeURL ?? '').replace(/%N/g, modeName)
    const script = document.createElement('script')
    script.src = file
    const otherScript = document.getElementsByTagName('script')[0]
    const list = loading[modeName] = [cont]

    CodeMirror.on(script, 'load', () => {
      ensureDeps(modeName, () => {
        for (let i = 0; i < list.length; ++i) {
          list[i]()
        }
      })
    })
    otherScript.parentNode?.insertBefore(script, otherScript)
  }

  CodeMirror.autoLoadMode = (instance: unknown, mode: string) => {
    if (!Object.prototype.hasOwnProperty.call(CodeMirror.modes, mode)) {
      CodeMirror.requireMode?.(mode, () => {
        const doc = instance as { setOption(key: string, value: unknown): void, getOption(key: string): unknown }
        doc.setOption('mode', doc.getOption('mode'))
      })
    }
  }
}

export default loadMore
