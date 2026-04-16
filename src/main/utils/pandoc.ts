import { spawn } from 'child_process'
import commandExists from 'command-exists'
import { isFile2 } from 'common/filesystem'

const pandocCommand = 'pandoc'

type PandocStreamInput = NodeJS.ReadableStream
type PandocStreamOutput = NodeJS.ReadableStream

interface PandocConverter {
  (): Promise<string>
  stream: (srcStream: PandocStreamInput) => PandocStreamOutput
}

interface PandocFunction {
  (from: string, to: string, ...args: string[]): PandocConverter
  exists: () => boolean
}

const envPathExists = (): boolean => {
  return !!process.env.MARKTEXT_PANDOC && isFile2(process.env.MARKTEXT_PANDOC)
}

const getCommand = (): string => {
  if (envPathExists() && process.env.MARKTEXT_PANDOC) {
    return process.env.MARKTEXT_PANDOC
  }
  return pandocCommand
}

const pandoc = ((from: string, to: string, ...args: string[]): PandocConverter => {
  const command = getCommand()
  const option = ['-s', from, '-t', to].concat(args)

  const converter = (() => new Promise<string>((resolve, reject) => {
    const proc = spawn(command, option)
    proc.on('error', reject)

    let data = ''
    proc.stdout.on('data', chunk => {
      data += chunk.toString()
    })
    proc.stdout.on('end', () => resolve(data))
    proc.stdout.on('error', reject)
    proc.stdin.end()
  })) as PandocConverter

  converter.stream = (srcStream: PandocStreamInput): PandocStreamOutput => {
    const proc = spawn(command, option)
    srcStream.pipe(proc.stdin)
    return proc.stdout
  }

  return converter
}) as PandocFunction

pandoc.exists = (): boolean => {
  if (envPathExists()) {
    return true
  }
  return commandExists.sync(pandocCommand)
}

export default pandoc
