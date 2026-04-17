class TextRenderer {
  strong (text: string): string {
    return text
  }

  em (text: string): string {
    return text
  }

  codespan (text: string): string {
    return text
  }

  del (text: string): string {
    return text
  }

  text (text: string): string {
    return text
  }

  html (html: string): string {
    return html
  }

  inlineMath (math: string, _displayMode?: boolean): string {
    return math
  }

  emoji (text: string, emoji: string): string {
    return emoji || text
  }

  script (content: string, marker: string): string {
    const tagName = marker === '^' ? 'sup' : 'sub'
    return `<${tagName}>${content}</${tagName}>`
  }

  footnoteIdentifier (
    identifier: string,
    {
      footnoteId,
      footnoteIdentifierId,
      order
    }: {
      footnoteId?: string | number
      footnoteIdentifierId?: string | number
      order?: string | number
    }
  ): string {
    return `<a href="#${footnoteId ? `fn${footnoteId}` : ''}" class="footnote-ref" id="fnref${footnoteIdentifierId}" role="doc-noteref"><sup>${order || identifier}</sup></a>`
  }

  link (_href: string, _title: string | null | undefined, text: string): string {
    return String(text)
  }

  image (_href: string, _title: string | null | undefined, text: string): string {
    return String(text)
  }

  br (): string {
    return ''
  }
}

export default TextRenderer
