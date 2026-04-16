import arg from 'arg'
import type { ParsedApplicationArgs } from 'common/types/app'

type ApplicationArgSpec = {
  '--debug': BooleanConstructor
  '--safe': BooleanConstructor
  '--new-window': BooleanConstructor
  '-n': '--new-window'
  '--disable-gpu': BooleanConstructor
  '--disable-spellcheck': BooleanConstructor
  '--user-data-dir': StringConstructor
  '--help': BooleanConstructor
  '-h': '--help'
  '--verbose': typeof arg.COUNT
  '-v': '--verbose'
  '--version': BooleanConstructor
}

export type ApplicationArgResult = ParsedApplicationArgs

const parseArgs = (argv: string[] | null = null, permissive = true): ApplicationArgResult => {
  const parsedArgv = argv ?? process.argv.slice(1)
  const spec: ApplicationArgSpec = {
    '--debug': Boolean,
    '--safe': Boolean,

    '--new-window': Boolean,
    '-n': '--new-window',

    '--disable-gpu': Boolean,
    '--disable-spellcheck': Boolean,
    '--user-data-dir': String,

    // Misc
    '--help': Boolean,
    '-h': '--help',
    '--verbose': arg.COUNT,
    '-v': '--verbose',
    '--version': Boolean
  }

  return arg(spec, { argv: parsedArgv, permissive }) as unknown as ApplicationArgResult
}

export default parseArgs
