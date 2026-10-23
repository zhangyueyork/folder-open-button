# Changelog

## 1.0.1 - 2026-10-23

### Fixed

- Restore and foreground an existing Windows Explorer window for the selected folder instead of leaving it flashing on the taskbar.
- Fall back to Electron's folder-opening API when native foreground activation is unavailable.

## 1.0.0 - 2026-07-14

### Features

- Add a hover button to each folder row in Obsidian's native file explorer.
- Open the selected folder directly in Windows File Explorer without expanding or collapsing the folder tree.
- Support dynamically added and renamed folders, multiple file explorer views, and clean plugin unloading.
- Handle Chinese characters, spaces, and special characters in folder paths without constructing shell commands.

### Documentation

- Add Chinese installation, usage, compatibility, architecture, and security documentation.

### Tests

- Add automated coverage for button deduplication, event isolation, renamed paths, dynamic folders, and cleanup.

