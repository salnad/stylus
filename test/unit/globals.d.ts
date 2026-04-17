declare const describe: (description: string, callback: () => void) => void
declare const it: (description: string, callback: () => void) => void

interface ChaiExpectChain {
  to: {
    equal(expected: unknown): void
    deep: {
      equal(expected: unknown): void
    }
  }
}

declare const expect: (value: unknown) => ChaiExpectChain
