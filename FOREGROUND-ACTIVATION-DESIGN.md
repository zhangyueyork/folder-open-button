# Windows Explorer foreground activation

Date: 2026-10-23

## Understanding

- Fix the Windows desktop behavior of the Obsidian folder-open button.
- A click should immediately show Windows Explorer in the foreground.
- Prefer restoring and activating an existing Explorer window for the folder.
- Preserve support for paths containing Chinese characters, spaces, and shell metacharacters.
- Do not change the button UI or the rest of the file-tree interaction.
- Do not introduce a resident process, network access, or file-content access.

## Assumptions and constraints

- The plugin supports desktop Obsidian on Windows only.
- A short-lived helper process is acceptable, with a four-second timeout.
- Windows can still deny foreground activation in exceptional system states, so opening the folder must have a fallback.
- The feature is used interactively and does not need to handle concurrent bulk requests.

## Approaches considered

1. Use a short-lived PowerShell helper with the Windows Shell COM API and `user32`.
2. Launch `explorer.exe` directly, which cannot reliably reuse the existing window.
3. Minimize Obsidian before opening Explorer, which changes unrelated window state.

## Decision log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Use Shell COM to locate or open the folder, then restore and activate its window with `user32` | Direct `explorer.exe`; minimize Obsidian | Reuses an existing window and leaves Obsidian's state unchanged |
| Pass the target through the child-process environment | Interpolate it into a command | Keeps arbitrary valid paths out of executable script text |
| Fall back to Electron `shell.openPath()` | Fail immediately | Retains the current ability to open the folder if activation is unavailable |
| Poll for at most 1.5 seconds after opening | Resident watcher | Covers normal Explorer startup without leaving a background process |

## Verification

- Automated checks cover the activation success path and the Electron fallback.
- Build, lint, and unit tests must pass.
- Final focus behavior must also be smoke-tested in desktop Windows because headless tests cannot assert OS foreground ownership.

## Responsiveness revision (2026-11-02)

### Updated understanding and constraints

- Repeated use showed a visible one-to-two-second pause caused by cold-starting PowerShell, loading `user32`, creating the Shell COM object, and waiting for Explorer before opening the folder.
- The folder-open request must be issued immediately after path validation; foreground activation must not block visible feedback.
- No resident PowerShell process, native helper service, third-party dependency, or settings page will be added.
- A short-lived activation process remains acceptable, and rapid repeated clicks must not let an older request steal focus from the newest request.

### Approaches considered

1. Open immediately with Electron and activate asynchronously with the existing short-lived helper.
2. Open with `explorer.exe` and activate asynchronously, with less consistent reuse and path behavior.
3. Keep a prewarmed helper process, rejected because it would remain resident while the plugin is enabled.

### Updated decision log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Call `shell.openPath()` before starting activation and never await activation | Wait for activation first | Makes PowerShell startup invisible to the primary interaction |
| Make the helper activation-only | Let the helper open the folder | Prevents duplicate opens and removes the long creation polling loop |
| Cancel the previous helper when a new folder is clicked | Let helpers race | Ensures the newest click owns the final foreground action |
| Treat activation as best-effort | Report activation failure as an open failure | The folder being opened is the primary success condition |
| Keep at most 250 ms of non-blocking window lookup retries | Poll for 1.5 seconds | Covers ordinary Explorer creation while keeping helpers short-lived |

### Revised verification

- Test that `shell.openPath()` is invoked before activation and that activation completion does not delay the result.
- Test cancellation of the previous helper on rapid clicks.
- Retain path-safety, failure, lint, build, and Windows desktop smoke checks.

## Existing-window deduplication revision (2026-11-02)

### Updated understanding

- Calling `shell.openPath()` before checking Explorer made new folders feel immediate, but could create a duplicate when the folder was already open.
- Existing windows may have been opened either by this plugin or manually before the click.
- The solution must remain non-resident and favor fast feedback over perfect stale-state tracking.

### Approaches evaluated

1. Maintain a startup cache of Explorer paths. Fast on cache hits, but misses windows opened manually after startup and becomes stale when windows close.
2. Probe on every click with a lightweight Windows Script Host process, then open only when no exact path exists.
3. Use PowerShell for every preflight check. Exact, but measured at roughly 0.7–0.8 seconds after warm-up on the target system.

### Decision log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Use `cscript.exe` with a fixed generated JScript probe | Cache-only lookup; PowerShell preflight | Measured around 0.14–0.37 seconds and detects both manually and plugin-opened windows |
| Generate the fixed script in the OS temporary directory and remove it on unload | Ship an extra release asset | Keeps standard Obsidian release packaging and does not interpolate paths into script code |
| Pass the target path as an `execFile` argument | Construct a shell command | Preserves literal Unicode and special-character paths without shell parsing |
| Do not call `shell.openPath()` when the exact path is found, even if focus is denied | Open again on focus failure | Prevents duplicates; the stronger PowerShell focus helper can run asynchronously |
| Open normally when the probe is missing, disabled, or times out | Treat probe failure as fatal | Preserves availability on systems where Windows Script Host is restricted |

### Verification

- Unit tests distinguish activated, found-but-not-focused, missing, and unavailable probe results.
- Existing-window results must never invoke `shell.openPath()`.
- Real Windows smoke testing must verify exact-path reuse, foreground focus, and elapsed click-to-window time.
