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
