import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, DomElementInfo } from 'obsidian';

const { openFolderMock } = vi.hoisted(() => ({
	openFolderMock: vi.fn(),
}));

vi.mock('../src/open-folder', () => ({
	openFolderInSystemExplorer: openFolderMock,
}));

import { FolderButtonController } from '../src/folder-button-controller';

beforeAll(() => {
	HTMLElement.prototype.createEl = function createEl<
		K extends keyof HTMLElementTagNameMap,
	>(tag: K, options?: DomElementInfo | string): HTMLElementTagNameMap[K] {
		const element = this.ownerDocument.createElement(tag);
		if (typeof options === 'string') {
			element.className = options;
		} else if (options) {
			if (options.cls) {
				element.className = Array.isArray(options.cls)
					? options.cls.join(' ')
					: options.cls;
			}
			for (const [name, value] of Object.entries(options.attr ?? {})) {
				element.setAttribute(name, String(value));
			}
		}
		this.append(element);
		return element;
	};
});

function createFolderRow(path: string): HTMLElement {
	const row = document.createElement('div');
	row.className = 'nav-folder-title';
	row.dataset.path = path;
	return row;
}

function createApp(root: HTMLElement): App {
	return {
		workspace: {
			getLeavesOfType: vi.fn(() => [
				{
					view: { containerEl: root },
				},
			]),
		},
	} as unknown as App;
}

describe('FolderButtonController', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		openFolderMock.mockReset();
	});

	it('adds one button to each folder row and opens the latest row path', () => {
		const root = document.createElement('div');
		const row = createFolderRow('项目/资料');
		root.append(row);
		document.body.append(root);
		const app = createApp(root);
		const controller = new FolderButtonController(app);
		const rowClick = vi.fn();
		row.addEventListener('click', rowClick);

		controller.start();
		controller.refreshFileExplorerViews();

		const buttons = row.querySelectorAll<HTMLButtonElement>(
			'.folder-open-button',
		);
		expect(buttons).toHaveLength(1);
		expect(buttons[0]?.dataset.icon).toBe('folder-open');

		row.dataset.path = '项目/重命名后的资料';
		buttons[0]?.click();

		expect(openFolderMock).toHaveBeenCalledOnce();
		expect(openFolderMock).toHaveBeenCalledWith(
			app,
			'项目/重命名后的资料',
		);
		expect(rowClick).not.toHaveBeenCalled();

		controller.stop();
	});

	it('decorates dynamically added folders and cleans up on stop', async () => {
		const root = document.createElement('div');
		document.body.append(root);
		const controller = new FolderButtonController(createApp(root));
		controller.start();

		const row = createFolderRow('新增文件夹');
		root.append(row);

		await vi.waitFor(() => {
			expect(row.querySelector('.folder-open-button')).not.toBeNull();
		});

		controller.stop();
		expect(row.querySelector('.folder-open-button')).toBeNull();
		expect(row.classList.contains('folder-open-button-host')).toBe(false);
	});
});
