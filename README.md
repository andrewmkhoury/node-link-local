# npll

**Node Package Link Local** — sync a local npm package into another project via staged tarballs.  
Works with **pnpm**, **yarn**, and **npm** in any combination (e.g. library uses pnpm, app uses yarn).

Replaces the need for `npm link` / `yarn link` with a workspace-safe flow: the library is packed into a tarball, staged in the app’s `.local-packages/`, and installed from that file. No symlinks, no cross-workspace protocol issues.

## Install

From this directory:

```bash
npm install -g .
# or
npm link
```

Or run without installing:

```bash
node bin/npll.js add /path/to/lib /path/to/app
```

## Commands

| Command | Description |
|--------|-------------|
| `npll add <path-to-lib> <path-to-app>` | Build (if needed), pack the library, and install it into the app from a staged tarball |
| `npll remove <path-to-lib> <path-to-app>` | Uninstall the library from the app and remove the staged tarball |

## Examples

```bash
# Use a local package "my-lib" inside "my-app"
npll add ./packages/my-lib ./apps/my-app

# Stop using the local copy
npll remove ./packages/my-lib ./apps/my-app
```

Paths can be absolute or relative. Both directories must contain a `package.json`. The library’s `package.json` is used to get the package name; the app’s lockfile is used to detect pnpm/yarn/npm.

## How it works

1. **add**
   - Detects package manager in both lib and app (pnpm / yarn / npm).
   - If the lib has no `dist/`, runs `build` with the lib’s package manager.
   - Copies the lib into a temp dir, normalizes `package.json` (e.g. `workspace:*` → `*`, strips prepare/prepack/postpack), and runs `pack`.
   - Copies the resulting `.tgz` into the app’s `.local-packages/`.
   - Installs from that tarball using the app’s package manager (with flags that avoid workspace linking issues where applicable).

2. **remove**
   - Uninstalls the package from the app using the app’s package manager.
   - Deletes any matching `.tgz` in the app’s `.local-packages/`.

## Requirements

- Node.js ≥ 18
- Library and app each have a `package.json`; library has a `name` (and ideally a build that produces `dist/` if you rely on it).

## Platform

Works on **Windows, macOS, and Linux**. Uses only Node built-ins (`path`, `fs`, `os`, `child_process`) and the system `PATH` to run pnpm/yarn/npm, so no shell-specific or platform-specific code.

## License

MIT
