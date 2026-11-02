import { Plugin } from 'obsidian';
import { FolderButtonController } from './folder-button-controller';
import {
	disposeWindowsExplorerIntegration,
	prepareWindowsExplorerIntegration,
} from './windows-explorer';

export default class FolderOpenButtonPlugin extends Plugin {
	private controller: FolderButtonController | null = null;

	onload(): void {
		void prepareWindowsExplorerIntegration();
		this.controller = new FolderButtonController(this.app);

		this.app.workspace.onLayoutReady(() => {
			this.controller?.start();
		});

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.controller?.refreshFileExplorerViews();
			}),
		);
	}

	onunload(): void {
		this.controller?.stop();
		this.controller = null;
		void disposeWindowsExplorerIntegration();
	}
}

