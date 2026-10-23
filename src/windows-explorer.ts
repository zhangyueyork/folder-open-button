import { execFile } from 'node:child_process';

const TARGET_PATH_ENV = 'OBSIDIAN_FOLDER_OPEN_BUTTON_TARGET';
const ACTIVATION_TIMEOUT_MS = 4000;

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

$windowHandle = Find-ExplorerWindow $targetPath
if ($windowHandle -eq [IntPtr]::Zero) {
    $shell.Explore($targetPath)

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 50
        $windowHandle = Find-ExplorerWindow $targetPath
        if ($windowHandle -ne [IntPtr]::Zero) {
            break
        }
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
	return new Promise((resolve) => {
		execFile(
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
				resolve(error === null);
			},
		);
	});
}
