# Developer Documentation

Welcome to developer documentation of MarkText.

## TypeScript migration notes

MarkText now uses TypeScript for first-party application/runtime code under `src/common`, `src/main`, `src/renderer`, and the Muya editor core.

The remaining `.js` files in the repository are intentionally limited to:

- tooling/config wrappers such as webpack, Karma, and Playwright config files
- runtime bootstrap helpers such as `test/unit/index.js` and `test/specs/register.js`
- vendored or generated assets such as files under `src/muya/lib/assets/libs`

For day-to-day validation, prefer:

- `yarn lint`
- `yarn typecheck`
- `xvfb-run -a yarn unit`
- `yarn test:specs` (network-dependent)

- [Project architecture](ARCHITECTURE.md)
- [Build instructions](BUILD.md)
- [Debugging](DEBUGGING.md)
- [Interface](INTERFACE.md)
- [Steps to release MarkText](RELEASE.md)
- [Prepare a hotfix](RELEASE_HOTFIX.md)
- [Internal documentation](code/README.md)
