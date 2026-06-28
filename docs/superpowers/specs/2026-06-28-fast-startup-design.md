# Fast Startup Design

## Goal

Make the Windows app show its first window faster, targeting about 3 seconds on a typical local machine, without changing conversion behavior or the user-facing workflow.

## Root Cause Hypothesis

The app already keeps startup code light: `src/main.js` creates the Electron window and loads local HTML, while the Python/MarkItDown converter is invoked only when a file is converted. The slow startup is therefore most likely caused by the current `portable` Electron Builder target, which produces a large single-file executable that must prepare or unpack resources before the app can show.

## Chosen Approach

Change the Windows release target from a portable single executable to an NSIS installer. This keeps application features unchanged but installs the Electron app and converter resources on disk ahead of time, reducing the amount of work needed when the user launches the program.

## Alternatives Considered

- Keep portable output and optimize renderer code: lower risk to packaging, but unlikely to fix a large pre-window delay because renderer code is small and local.
- Lazy-load the converter: already effectively true, because `runConverter` is only called from `convert-file`.
- Replace Electron: outside the current scope and would change far more than needed.

## Files

- `package.json`: change `build.win.target` from `portable` to `nsis`, remove the `dist:win` script's forced `portable` target, set an installer artifact name, and point `electronDist` at the installed local Electron distribution so builds do not stall while downloading Electron.
- `README.md`: update release wording from portable build to installer build.

## Verification

- Run `npm test` to confirm helper logic still passes.
- Run `npm run dist:win` to confirm the Windows installer builds.
- Inspect `release/` to confirm an installer is produced.
