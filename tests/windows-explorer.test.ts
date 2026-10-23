import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
	execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
	default: { execFile: execFileMock },
	execFile: execFileMock,
}));

import { activateFolderInWindowsExplorer } from '../src/windows-explorer';

describe('activateFolderInWindowsExplorer', () => {
	beforeEach(() => {
		execFileMock.mockReset();
	});

	it('passes the path through the environment instead of script arguments', async () => {
		execFileMock.mockImplementation((...parameters: unknown[]) => {
			const callback = parameters.at(-1) as (error: Error | null) => void;
			callback(null);
			return {};
		});
		const path = 'C:\\中文 目录\\a&b';

		await expect(activateFolderInWindowsExplorer(path)).resolves.toBe(true);

		const [executable, arguments_, options] = execFileMock.mock.calls[0] ?? [];
		expect(executable).toBe('powershell.exe');
		expect(arguments_).not.toContain(path);
		expect(options).toMatchObject({
			timeout: 4000,
			windowsHide: true,
			env: {
				OBSIDIAN_FOLDER_OPEN_BUTTON_TARGET: path,
			},
		});
	});

	it('reports failure so the caller can use its fallback', async () => {
		execFileMock.mockImplementation((...parameters: unknown[]) => {
			const callback = parameters.at(-1) as (error: Error | null) => void;
			callback(new Error('PowerShell unavailable'));
			return {};
		});

		await expect(
			activateFolderInWindowsExplorer('C:\\folder'),
		).resolves.toBe(false);
	});
});
