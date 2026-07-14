import { App, setIcon } from 'obsidian';
import { openFolderInSystemExplorer } from './open-folder';

const FILE_EXPLORER_VIEW_TYPE = 'file-explorer';
const FOLDER_ROW_SELECTOR = '.nav-folder-title[data-path]';
const BUTTON_CLASS = 'folder-open-button';
const HOST_CLASS = 'folder-open-button-host';
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

function isHtmlElement(element: Element): element is HTMLElement {
	return element.namespaceURI === HTML_NAMESPACE;
}

export class FolderButtonController {
	private readonly observers = new Map<HTMLElement, MutationObserver>();
	private active = false;

	constructor(private readonly app: App) {}

	start(): void {
		if (this.active) {
			return;
		}

		this.active = true;
		this.refreshFileExplorerViews();
	}

	refreshFileExplorerViews(): void {
		if (!this.active) {
			return;
		}

		const currentRoots = new Set(
			this.app.workspace
				.getLeavesOfType(FILE_EXPLORER_VIEW_TYPE)
				.map((leaf) => leaf.view.containerEl),
		);

		for (const [root, observer] of this.observers) {
			if (!currentRoots.has(root) || !root.isConnected) {
				observer.disconnect();
				this.observers.delete(root);
			}
		}

		for (const root of currentRoots) {
			if (this.observers.has(root)) {
				continue;
			}

			this.decorateTree(root);
			const observer = new MutationObserver((mutations) => {
				this.handleMutations(mutations);
			});
			observer.observe(root, { childList: true, subtree: true });
			this.observers.set(root, observer);
		}
	}

	stop(): void {
		this.active = false;

		for (const [root, observer] of this.observers) {
			observer.disconnect();
			this.removeButtons(root);
		}

		this.observers.clear();
	}

	private handleMutations(mutations: MutationRecord[]): void {
		for (const mutation of mutations) {
			const addedNodes = Array.from(mutation.addedNodes);
			for (const addedNode of addedNodes) {
				if (addedNode.nodeType === Node.ELEMENT_NODE) {
					this.decorateTree(addedNode as HTMLElement);
				}
			}
		}
	}

	private decorateTree(scope: HTMLElement): void {
		if (scope.matches(FOLDER_ROW_SELECTOR)) {
			this.decorateFolderRow(scope);
		}

		const rows = Array.from(scope.querySelectorAll(FOLDER_ROW_SELECTOR));
		for (const row of rows) {
			if (isHtmlElement(row)) {
				this.decorateFolderRow(row);
			}
		}
	}

	private decorateFolderRow(row: HTMLElement): void {
		if (row.querySelector(`:scope > .${BUTTON_CLASS}`)) {
			return;
		}

		row.classList.add(HOST_CLASS);
		const button = row.createEl('button', {
			cls: BUTTON_CLASS,
			attr: {
				type: 'button',
				'aria-label': '在系统资源管理器中打开',
				title: '在系统资源管理器中打开',
			},
		});
		setIcon(button, 'folder-open');

		button.addEventListener('pointerdown', (event) => {
			event.stopPropagation();
		});

		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();

			const folderPath = row.getAttribute('data-path');
			if (folderPath !== null) {
				void openFolderInSystemExplorer(this.app, folderPath);
			}
		});
	}

	private removeButtons(root: HTMLElement): void {
		const buttons = Array.from(root.querySelectorAll(`.${BUTTON_CLASS}`));
		for (const button of buttons) {
			button.remove();
		}

		const hosts = Array.from(root.querySelectorAll(`.${HOST_CLASS}`));
		for (const host of hosts) {
			host.classList.remove(HOST_CLASS);
		}
	}
}
