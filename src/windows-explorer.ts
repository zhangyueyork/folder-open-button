import { execFile, type ChildProcess } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGET_PATH_ENV = 'OBSIDIAN_FOLDER_OPEN_BUTTON_TARGET';
const ACTIVATION_TIMEOUT_MS = 2500;
const WINDOW_RETRY_COUNT = 6;
const WINDOW_RETRY_DELAY_MS = 50;
const PROBE_TIMEOUT_MS = 1200;
const PROBE_SCRIPT_PATH = join(
	tmpdir(),
	`obsidian-folder-open-button-${process.pid}.js`,
);

let activeActivationProcess: ChildProcess | null = null;
let probeScriptPromise: Promise<string> | null = null;

export type ExplorerWindowProbeResult =
	| 'activated'
	| 'found'
	| 'not-found'
	| 'unavailable';

const PROBE_EXPLORER_SCRIPT = String.raw`
var targetPath = WScript.Arguments.Item(0).replace(/[\\\/]+$/, '').toLowerCase();
var shellApplication = new ActiveXObject('Shell.Application');
var windows = shellApplication.Windows();
var windowShell = new ActiveXObject('WScript.Shell');

for (var index = 0; index < windows.Count; index++) {
    try {
        var explorerWindow = windows.Item(index);
        var windowPath = String(explorerWindow.Document.Folder.Self.Path)
            .replace(/[\\\/]+$/, '')
            .toLowerCase();
        if (windowPath === targetPath) {
            var activated = windowShell.AppActivate(String(explorerWindow.LocationName));
            WScript.Quit(activated ? 0 : 3);
        }
    } catch (error) {
        // Shell.Application also enumerates non-file-system shell windows.
    }
}

WScript.Quit(2);
`;

function ensureProbeScript(): Promise<string> {
	probeScriptPromise ??= writeFile(PROBE_SCRIPT_PATH, PROBE_EXPLORER_SCRIPT, {
		encoding: 'utf8',
	}).then(() => PROBE_SCRIPT_PATH);
	return probeScriptPromise;
}

export async function prepareWindowsExplorerIntegration(): Promise<void> {
	try {
		await ensureProbeScript();
	} catch {
		// The regular Electron opening path remains available without the probe.
	}
}

export async function disposeWindowsExplorerIntegration(): Promise<void> {
	if (activeActivationProcess !== null) {
		activeActivationProcess.kill();
		activeActivationProcess = null;
	}

	probeScriptPromise = null;
	try {
		await unlink(PROBE_SCRIPT_PATH);
	} catch {
		// The file may not exist if preparation failed or cleanup already ran.
	}
}

export async function probeAndActivateFolderInWindowsExplorer(
	absolutePath: string,
): Promise<ExplorerWindowProbeResult> {
	try {
		const scriptPath = await ensureProbeScript();
		return await new Promise((resolve) => {
			execFile(
				'cscript.exe',
				['//NoLogo', scriptPath, absolutePath],
				{
					encoding: 'utf8',
					timeout: PROBE_TIMEOUT_MS,
					windowsHide: true,
				},
				(error) => {
					if (error === null) {
						resolve('activated');
					} else if (error.code === 2) {
						resolve('not-found');
					} else if (error.code === 3) {
						resolve('found');
					} else {
						resolve('unavailable');
					}
				},
			);
		});
	} catch {
		return 'unavailable';
	}
}

// PowerShell is used only as a short-lived bridge to the Windows Shell COM API
// and user32. The target path is supplied through the child environment rather
// than interpolated into this script.
const ACTIVATE_EXPLORER_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$targetPath = [System.IO.Path]::GetFullPath($env:OBSIDIAN_FOLDER_OPEN_BUTTON_TARGET).TrimEnd('\', '/')

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class FolderOpenButtonNativeMethods
{
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

function Normalize-FolderPath([string] $path) {
    if ([string]::IsNullOrWhiteSpace($path)) {
        return $null
    }

    try {
        return [System.IO.Path]::GetFullPath($path).TrimEnd('\', '/')
    } catch {
        return $null
    }
}

$shell = New-Object -ComObject Shell.Application

function Find-ExplorerWindow([string] $path) {
    foreach ($window in @($shell.Windows())) {
        try {
            $windowPath = Normalize-FolderPath $window.Document.Folder.Self.Path
            if ([string]::Equals($windowPath, $path, [System.StringComparison]::OrdinalIgnoreCase)) {
                return [IntPtr][long]$window.HWND
            }
        } catch {
            # Shell.Application also enumerates non-file-system shell windows.
        }
    }

    return [IntPtr]::Zero
}

$windowHandle = [IntPtr]::Zero
for ($attempt = 0; $attempt -lt ${WINDOW_RETRY_COUNT}; $attempt++) {
    $windowHandle = Find-ExplorerWindow $targetPath
    if ($windowHandle -ne [IntPtr]::Zero) {
        break
    }

    if ($attempt -lt ${WINDOW_RETRY_COUNT - 1}) {
        Start-Sleep -Milliseconds ${WINDOW_RETRY_DELAY_MS}
    }
}

if ($windowHandle -eq [IntPtr]::Zero) {
    exit 2
}

# SW_RESTORE also makes an already-open but minimized Explorer visible.
[void][FolderOpenButtonNativeMethods]::ShowWindowAsync($windowHandle, 9)
[void][FolderOpenButtonNativeMethods]::BringWindowToTop($windowHandle)

if (-not [FolderOpenButtonNativeMethods]::SetForegroundWindow($windowHandle)) {
    exit 3
}
`;

const ENCODED_ACTIVATION_SCRIPT = Buffer.from(
	ACTIVATE_EXPLORER_SCRIPT,
	'utf16le',
).toString('base64');

export function activateFolderInWindowsExplorer(
	absolutePath: string,
): Promise<boolean> {
	if (activeActivationProcess !== null) {
		activeActivationProcess.kill();
		activeActivationProcess = null;
	}

	return new Promise((resolve) => {
		try {
			let activationProcess: ChildProcess | null = null;
			activationProcess = execFile(
				'powershell.exe',
				[
					'-NoLogo',
					'-NoProfile',
					'-NonInteractive',
					'-ExecutionPolicy',
					'Bypass',
					'-EncodedCommand',
					ENCODED_ACTIVATION_SCRIPT,
				],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						[TARGET_PATH_ENV]: absolutePath,
					},
					timeout: ACTIVATION_TIMEOUT_MS,
					windowsHide: true,
				},
				(error) => {
					if (activeActivationProcess === activationProcess) {
						activeActivationProcess = null;
					}
					resolve(error === null);
				},
			);
			activeActivationProcess = activationProcess;
		} catch {
			activeActivationProcess = null;
			resolve(false);
		}
	});
}
