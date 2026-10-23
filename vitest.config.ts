import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			electron: fileURLToPath(
				new URL('./tests/mocks/electron.ts', import.meta.url),
			),
			obsidian: fileURLToPath(
				new URL('./tests/mocks/obsidian.ts', import.meta.url),
			),
		},
	},
	test: {
		environment: 'happy-dom',
		clearMocks: true,
	},
});
