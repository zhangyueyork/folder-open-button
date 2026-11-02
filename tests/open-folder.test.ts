import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { FileSystemAdapter } from 'obsidian';

const { activateMock, openPathMock, probeMock, statMock } = vi.hoisted(() => ({
	activateMock: vi.fn(),
	openPathMock: vi.fn(),
	probeMock: vi.fn(),
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
	openOrActivateFolderInWindowsExplorer: probeMock,
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
		probeMock.mockReset();
		statMock.mockReset();
		probeMock.mockResolvedValue('activated');
		statMock.mockResolvedValue({ isDirectory: () => true });
	});

	it('uses the Windows helper to open and activate a missing folder', async () => {
		const callOrder: string[] = [];
		probeMock.mockImplementation(() => {
			callOrder.push('open-or-activate');
			return Promise.resolve('activated');
		});

		await openFolderInSystemExplorer(createApp(), '项目/含 空格&符号');

		expect(callOrder).toEqual(['open-or-activate']);
		expect(openPathMock).not.toHaveBeenCalled();
		expect(activateMock).not.toHaveBeenCalled();
	});

	it('activates an existing folder without opening a duplicate', async () => {
		probeMock.mockResolvedValue('activated');

		await openFolderInSystemExplorer(createApp(), '项目/已打开');

		expect(openPathMock).not.toHaveBeenCalled();
		expect(activateMock).not.toHaveBeenCalled();
	});

	it('uses the strong focus fallback without opening a duplicate', async () => {
		probeMock.mockResolvedValue('found');
		activateMock.mockResolvedValue(true);

		await openFolderInSystemExplorer(createApp(), '项目/已打开');

		expect(openPathMock).not.toHaveBeenCalled();
		expect(activateMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\已打开',
		);
	});

	it('does not duplicate a new window whose COM handle appears late', async () => {
		probeMock.mockResolvedValue('open-requested');
		activateMock.mockResolvedValue(true);

		await openFolderInSystemExplorer(createApp(), '项目/新目录');

		expect(openPathMock).not.toHaveBeenCalled();
		expect(activateMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\新目录',
		);
	});

	it('strongly reactivates a newly created window after initialization', async () => {
		probeMock.mockResolvedValue('opened');
		activateMock.mockResolvedValue(true);

		await openFolderInSystemExplorer(createApp(), '项目/新目录');

		expect(openPathMock).not.toHaveBeenCalled();
		expect(activateMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\新目录',
		);
	});

	it('falls back to Electron when Windows Script Host is unavailable', async () => {
		probeMock.mockResolvedValue('unavailable');
		activateMock.mockResolvedValue(false);
		openPathMock.mockResolvedValue('');

		await openFolderInSystemExplorer(createApp(), '项目/子目录');

		expect(openPathMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\子目录',
		);
	});
});
