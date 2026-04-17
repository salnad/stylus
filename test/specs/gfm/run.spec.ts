// This file is copy from https://github.com/markedjs/marked/blob/master/test/specs/gfm/getSpecs.js
// And for custom use.
import fs from 'fs'
import path from 'path'
import cheerio, { type CheerioAPI, type Element } from 'cheerio'
import fetch from 'node-fetch'
import { HtmlDiffer } from '@markedjs/html-differ'

import marked from '../../../src/muya/lib/parser/marked/index.js'
import { MT_MARKED_OPTIONS } from '../config'
import { removeCustomClass } from '../help'
import { writeResult } from '../commonMark/run.spec'

interface TextResponse {
  text(): Promise<string>
}

interface JsonResponse<T> {
  json(): Promise<T>
}

interface GfmSpec {
  section: string
  html: string
  markdown: string
  example: number
  shouldFail?: boolean
}

interface HtmlDifferOptions {
  ignoreSelfClosingSlash: boolean
  ignoreAttributes: string[]
}

const options: HtmlDifferOptions = { ignoreSelfClosingSlash: true, ignoreAttributes: ['id', 'class'] }

const htmlDiffer = new HtmlDiffer(options)

const getSpecs = async (): Promise<[string, GfmSpec[]]> => {
  return fetch('https://github.github.com/gfm/')
    .then((res: TextResponse) => res.text())
    .then(html => cheerio.load(html))
    .then(($: CheerioAPI) => {
      const versionMatch = $('.version').text().match(/\d+\.\d+/)
      const version = versionMatch?.[0]
      if (!version) {
        throw new Error('No version found')
      }
      const specs: GfmSpec[] = []
      $('.extension').each((_i, ext: Element) => {
        const section = $('.definition', ext).text().trim().replace(/^\d+\.\d+(.*?) \(extension\)[\s\S]*$/, '$1')
        $('.example', ext).each((_j, exa: Element) => {
          const id = $(exa).attr('id')
          if (!id) {
            throw new Error('No example id found')
          }
          const example = +id.replace(/\D/g, '')
          const markdown = $('.language-markdown', exa).text().trim()
          const html = $('.language-html', exa).text().trim()
          specs.push({
            section,
            html,
            markdown,
            example
          })
        })
      })

      return [version, specs]
    })
}

const getMarkedSpecs = async (version: string): Promise<GfmSpec[]> => {
  return fetch(`https://raw.githubusercontent.com/markedjs/marked/master/test/specs/gfm/gfm.${version}.json`)
    .then((res: JsonResponse<GfmSpec[]>) => res.json())
}

const diffAndGenerateResult = async (): Promise<void> => {
  const [version, specs] = await getSpecs()
  const markedSpecs = await getMarkedSpecs(version)
  specs.forEach(spec => {
    const html = removeCustomClass(marked(spec.markdown, MT_MARKED_OPTIONS))
    if (!htmlDiffer.isEqual(html, spec.html)) {
      spec.shouldFail = true
    }
  })
  fs.writeFileSync(path.resolve(__dirname, `./gfm.${version}.json`), JSON.stringify(specs, null, 2) + '\n')
  writeResult(version, specs, markedSpecs, 'gfm')
}

diffAndGenerateResult().catch(err => {
  console.log(err)
})
