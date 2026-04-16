# MarkText Development Guide

## Cursor Cloud specific instructions

### Overview

MarkText is an Electron-based desktop markdown editor. It is a single application (not a microservice architecture) with no database or backend server.

### Node.js Version

This project requires **Node.js v16** (`>=16 <17`). The environment uses `nvm` to manage versions. Before running any commands, ensure Node 16 is active:

```
nvm use 16
```

### Key Commands

See `docs/dev/BUILD.md` and `package.json` for the full list. The most important ones:

| Command | Description |
|---------|-------------|
| `yarn lint` | ESLint checks |
| `yarn unit` | Unit tests (522 tests, uses karma-electron) |
| `yarn dev` | Run the app in development mode (launches Webpack Dev Server on port 9091 + Electron) |

### Running Unit Tests

Unit tests require a display server. Use `xvfb-run`:

```
xvfb-run yarn unit
```

### Running the App in Dev Mode

The app needs a display. Use `DISPLAY=:1` with Xvfb already running:

```
DISPLAY=:1 yarn dev
```

### Native Module Build Workaround

The standard `yarn install` postinstall runs `electron-rebuild`, which tries to download Electron headers from `electronjs.org`. This URL is blocked in the Cloud Agent environment. The workaround:

1. Install without scripts: `yarn install --frozen-lockfile --ignore-scripts`
2. Run the postinstall script: `node .electron-vue/postinstall.js`
3. Build `ced` natively: `cd node_modules/ced && /workspace/node_modules/.bin/node-gyp rebuild && cd ../..`
4. Other native modules (`keytar`, `native-keymap`, `fontmanager-redux`) ship with prebuilt binaries and don't need manual rebuild.
5. Run lint:fix: `yarn run lint:fix`

### Non-obvious Notes

- The Webpack Dev Server runs on `127.0.0.1:9091` with HMR. Electron connects to this in dev mode.
- Electron launches with `--inspect=5858` and `--remote-debugging-port=8315` in dev mode.
- GPU/libva errors in the Electron console are expected in headless environments and can be ignored.
- Vue DevTools extension install failures (SSL/network errors) are expected in restricted network environments and are non-fatal.
- The `ced` module (compact encoding detection) is the only native module that must be compiled from source. The local `node-gyp` at `node_modules/.bin/node-gyp` (v8.x) must be used instead of a globally installed one, which may be too new for Node 16.
