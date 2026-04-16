declare module '*.vue' {
  import Vue from 'vue'

  export default Vue
}

declare module '*.css' {
  const content: string
  export default content
}

declare module '*.html' {
  const content: string
  export default content
}

declare module '*.md' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: {
    id?: string
    url: string
    viewBox: string
  }
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.gif' {
  const content: string
  export default content
}

declare module '*.webp' {
  const content: string
  export default content
}

declare module '*.mp4' {
  const content: string
  export default content
}

declare module '*.webm' {
  const content: string
  export default content
}

declare module '*.ogg' {
  const content: string
  export default content
}

declare module '*.mp3' {
  const content: string
  export default content
}

declare module '*.wav' {
  const content: string
  export default content
}

declare module '*.flac' {
  const content: string
  export default content
}

declare module '*.aac' {
  const content: string
  export default content
}

declare module '*.woff' {
  const content: string
  export default content
}

declare module '*.woff2' {
  const content: string
  export default content
}

declare module '*.eot' {
  const content: string
  export default content
}

declare module '*.ttf' {
  const content: string
  export default content
}

declare module '*.otf' {
  const content: string
  export default content
}

declare module '*.node' {
  const content: any
  export default content
}

declare module 'fuzzaldrin' {
  export function filter<T>(items: T[], query: string, options?: { key?: keyof T | string }): T[]
}

declare module 'command-exists' {
  interface CommandExists {
    (command: string): Promise<void>
    sync(command: string): boolean
  }

  const commandExists: CommandExists
  export default commandExists
}

declare module 'ced' {
  function ced(input: Buffer | Uint8Array | ArrayBuffer | string): string
  export default ced
}

declare module 'axios/lib/adapters/http' {
  const adapter: unknown
  export default adapter
}

declare module 'mermaid/dist/mermaid.core.mjs' {
  const mermaid: unknown
  export default mermaid
}

declare module 'vue-electron' {
  const plugin: unknown
  export default plugin
}

declare module 'source-map-support' {
  const sourceMapSupport: {
    install(options?: Record<string, unknown>): void
  }
  export default sourceMapSupport
}

declare module 'element-ui/lib/locale/lang/en' {
  const locale: unknown
  export default locale
}

declare module 'element-ui/lib/locale' {
  const locale: {
    use(language: unknown): void
  }
  export default locale
}

declare module 'codemirror/lib/codemirror' {
  const codeMirror: unknown
  export default codeMirror
}

declare module 'plist' {
  const plist: {
    parse(content: string): unknown
  }
  export default plist
}

declare module 'dom-autoscroller' {
  interface AutoScroller {
    down?: boolean
    destroy(force?: boolean): void
  }

  interface AutoScrollerOptions {
    margin?: number
    maxSpeed?: number
    scrollWhenOutside?: boolean
    autoScroll?: () => boolean
  }

  export default function autoScroll(elements: Element[], options?: AutoScrollerOptions): AutoScroller
}

declare module 'dragula' {
  interface DragulaOptions {
    direction?: 'horizontal' | 'vertical'
    revertOnSpill?: boolean
    mirrorContainer?: Element
    ignoreInputTextSelection?: boolean
  }

  interface Drake {
    dragging?: boolean
    destroy(): void
    on(event: 'drop', handler: (el: Element, target: Element | null, source: Element | null, sibling: Element | null) => void): Drake
  }

  export default function dragula(containers?: Element[], options?: DragulaOptions): Drake
}
