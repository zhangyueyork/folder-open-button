export function setIcon(element: HTMLElement, icon: string): void {
	element.dataset.icon = icon;
}

export class FileSystemAdapter {
	constructor(private readonly basePath = 'C:\\Vault') {}

	getFullPath(path: string): string {
		return `${this.basePath}\\${path.replaceAll('/', '\\')}`;
	}
}

export const Platform = {
	isWin: true,
};

export function normalizePath(path: string): string {
	return path.replaceAll('\\', '/');
}

export class Notice {
	constructor(
		public readonly message: string,
		public readonly duration: number,
	) {}
}

