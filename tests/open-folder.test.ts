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
	probeAndActivateFolderInWindowsExplorer: probeMock,
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
		probeMock.mockResolvedValue('not-found');
		statMock.mockResolvedValue({ isDirectory: () => true });
	});

	it('opens a missing folder before starting non-blocking activation', async () => {
		const callOrder: string[] = [];
		probeMock.mockImplementation(() => {
			callOrder.push('probe');
			return Promise.resolve('not-found');
		});
		openPathMock.mockImplementation(() => {
			callOrder.push('open');
			return Promise.resolve('');
		});
		activateMock.mockImplementation(() => {
			callOrder.push('activate');
			return new Promise(() => undefined);
		});

		await openFolderInSystemExplorer(createApp(), '项目/含 空格&符号');

		expect(callOrder).toEqual(['probe', 'open', 'activate']);
		expect(openPathMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\含 空格&符号',
		);
		expect(activateMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\含 空格&符号',
		);
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

	it('keeps a successful open independent from activation failure', async () => {
		activateMock.mockResolvedValue(false);
		openPathMock.mockResolvedValue('');

		await openFolderInSystemExplorer(createApp(), '项目/子目录');

		expect(openPathMock).toHaveBeenCalledWith(
			'C:\\My Vault\\项目\\子目录',
		);
	});
});
