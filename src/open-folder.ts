import { shell } from 'electron';
import { stat } from 'node:fs/promises';
import {
	App,
	FileSystemAdapter,
	Notice,
	Platform,
	normalizePath,
} from 'obsidian';

const NOTICE_DURATION_MS = 5000;

export async function openFolderInSystemExplorer(
	app: App,
	vaultRelativePath: string,
): Promise<void> {
	try {
		if (!Platform.isWin) {
			throw new Error('此插件目前仅支持 Windows。');
		}

		const adapter = app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error('当前仓库不是本地文件系统仓库，无法解析文件夹路径。');
		}

		const normalizedPath = normalizePath(vaultRelativePath);
		const absolutePath = adapter.getFullPath(normalizedPath);
		const folderStat = await stat(absolutePath);

		if (!folderStat.isDirectory()) {
			throw new Error('目标路径不是文件夹。');
		}

		const errorMessage = await shell.openPath(absolutePath);
		if (errorMessage) {
			throw new Error(errorMessage);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`无法打开文件夹：${message}`, NOTICE_DURATION_MS);
	}
}

