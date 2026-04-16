const rendererCache = new Map<string, unknown>()

type RendererModule = {
  default: unknown
}

/**
 * @param name renderer name: katex, sequence, plantuml, flowchart, mermaid, vega-lite
 */
const loadRenderer = async (name: string): Promise<unknown> => {
  if (!rendererCache.has(name)) {
    let module: RendererModule
    switch (name) {
      case 'sequence':
        module = await import('../parser/render/sequence')
        rendererCache.set(name, module.default)
        break
      case 'plantuml':
        module = await import('../parser/render/plantuml')
        rendererCache.set(name, module.default)
        break
      case 'flowchart':
        module = await import('flowchart.js')
        rendererCache.set(name, module.default)
        break
      case 'mermaid':
        module = await import('mermaid/dist/mermaid.core.mjs')
        rendererCache.set(name, module.default)
        break
      case 'vega-lite':
        module = await import('vega-embed')
        rendererCache.set(name, module.default)
        break
      default:
        throw new Error(`Unknown diagram name ${name}`)
    }
  }

  return rendererCache.get(name)
}

export default loadRenderer
