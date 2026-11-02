import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock, unlinkMock, writeFileMock } = vi.hoisted(() => ({
	execFileMock: vi.fn(),
	unlinkMock: vi.fn(),
	writeFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
	default: { execFile: execFileMock },
	execFile: execFileMock,
}));

vi.mock('node:fs/promises', () => ({
	default: { unlink: unlinkMock, writeFile: writeFileMock },
	unlink: unlinkMock,
	writeFile: writeFileMock,
}));

import {
	activateFolderInWindowsExplorer,
	probeAndActivateFolderInWindowsExplorer,
} from '../src/windows-explorer';

describe('activateFolderInWindowsExplorer', () => {
	beforeEach(() => {
		execFileMock.mockReset();
		unlinkMock.mockReset();
		writeFileMock.mockReset();
		writeFileMock.mockResolvedValue(undefined);
	});

	it('probes the exact path with the lightweight Windows script host', async () => {
		execFileMock.mockImplementation((...parameters: unknown[]) => {
			const callback = parameters.at(-1) as (error: Error | null) => void;
			queueMicrotask(() => callback(null));
			return { kill: vi.fn() };
		});
		const path = 'C:\\中文 目录\\a&b';

		await expect(
			probeAndActivateFolderInWindowsExplorer(path),
		).resolves.toBe('activated');

		const [executable, arguments_, options] = execFileMock.mock.calls[0] ?? [];
		expect(executable).toBe('cscript.exe');
		expect(arguments_).toContain(path);
		expect(options).toMatchObject({ timeout: 1200, windowsHide: true });
	});

	it('distinguishes a missing window from a found window that could not focus', async () => {
		const exitCodes = [2, 3];
		execFileMock.mockImplementation((...parameters: unknown[]) => {
			const callback = parameters.at(-1) as (
				error: (Error & { code?: number }) | null,
			) => void;
			const code = exitCodes.shift();
			const error = Object.assign(new Error('cscript exit'), { code });
			queueMicrotask(() => callback(error));
			return { kill: vi.fn() };
		});

		await expect(
			probeAndActivateFolderInWindowsExplorer('C:\\missing'),
		).resolves.toBe('not-found');
		await expect(
			probeAndActivateFolderInWindowsExplorer('C:\\existing'),
		).resolves.toBe('found');
	});

	it('passes the path through the environment instead of script arguments', async () => {
		execFileMock.mockImplementation((...parameters: unknown[]) => {
			const callback = parameters.at(-1) as (error: Error | null) => void;
			queueMicrotask(() => callback(null));
			return { kill: vi.fn() };
		});
		const path = 'C:\\中文 目录\\a&b';

		await expect(activateFolderInWindowsExplorer(path)).resolves.toBe(true);

		const [executable, arguments_, options] = execFileMock.mock.calls[0] ?? [];
		expect(executable).toBe('powershell.exe');
		expect(arguments_).not.toContain(path);
		expect(options).toMatchObject({
			timeout: 2500,
			windowsHide: true,
			env: {
				OBSIDIAN_FOLDER_OPEN_BUTTON_TARGET: path,
			},
		});
	});

	it('reports failure so the caller can use its fallback', async () => {
		execFileMock.mockImplementation((...parameters: unknown[]) => {
			const callback = parameters.at(-1) as (error: Error | null) => void;
			queueMicrotask(() => callback(new Error('PowerShell unavailable')));
			return { kill: vi.fn() };
		});

		await expect(
			activateFolderInWindowsExplorer('C:\\folder'),
		).resolves.toBe(false);
	});

	it('cancels an older activation request before starting a new one', async () => {
		const callbacks: Array<(error: Error | null) => void> = [];
		const processes = [{ kill: vi.fn() }, { kill: vi.fn() }];
		execFileMock.mockImplementation((...parameters: unknown[]) => {
			callbacks.push(parameters.at(-1) as (error: Error | null) => void);
			return processes[callbacks.length - 1];
		});

		const firstResult = activateFolderInWindowsExplorer('C:\\first');
		const secondResult = activateFolderInWindowsExplorer('C:\\second');

		expect(processes[0]?.kill).toHaveBeenCalledOnce();
		expect(processes[1]?.kill).not.toHaveBeenCalled();

		callbacks[0]?.(new Error('Cancelled'));
		callbacks[1]?.(null);
		await expect(firstResult).resolves.toBe(false);
		await expect(secondResult).resolves.toBe(true);
	});
});
