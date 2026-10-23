import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { FileSystemAdapter } from 'obsidian';

const { activateMock, openPathMock, statMock } = vi.hoisted(() => ({
	activateMock: vi.fn(),
	openPathMock: vi.fn(),
	statMock: vi.fn(),
}));

vi.mock('electron', () => ({
	shell: { openPath: openPathMock },
}));

vi.mock('node:fs/promises', () => ({
	default: { stat: statMock },
	stat: statMock,
}));

vi.mock('../src/windows-explorer', () => ({
	activateFolderInWindowsExplorer: activateMock,
}));

import { openFolderInSystemExplorer } from '../src/open-folder';

function createApp(): App {
	return {
		vault: {
			adapter: new FileSystemAdapter('C:\\My Vault'),
		},
	} as unknown as App;
}

describe('openFolderInSystemExplorer', () => {
	beforeEach(() => {
		activateMock.mockReset();
		openPathMock.mockReset();
		statMock.mockReset();
		statMock.mockResolvedValue({ isDirectory: () => true });
	});

	it('activates Explorer without calling the fallback', async () => {
		activateMock.mockResolvedValue(true);

		await openFolderInSystemExplorer(createApp(), '项目/含 空格&符号');

		expect(activateMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\含 空格&符号',
		);
		expect(openPathMock).not.toHaveBeenCalled();
	});

	it('falls back to Electron when foreground activation fails', async () => {
		activateMock.mockResolvedValue(false);
		openPathMock.mockResolvedValue('');

		await openFolderInSystemExplorer(createApp(), '项目/子目录');

		expect(openPathMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\子目录',
		);
	});
});
