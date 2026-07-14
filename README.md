# Folder Open Button

在 Obsidian 原生文件列表的文件夹行右侧添加一个悬停按钮。点击按钮后，Windows 资源管理器会直接进入对应文件夹，不需要打开右键菜单，也不会触发文件夹展开或折叠。

项目地址：<https://github.com/zhangyueyork/folder-open-button>

## 功能

- 鼠标悬停文件夹行时显示“打开文件夹”图标。
- 点击后直接在 Windows 资源管理器中进入该文件夹。
- 支持中文、空格和特殊字符路径。
- 自动处理新增、重命名及重新渲染的文件夹行。
- 不联网，不读取笔记内容，不执行拼接的 Shell 命令。

## 安装

### 使用发布包

1. 从 [GitHub Releases](https://github.com/zhangyueyork/folder-open-button/releases) 下载 `folder-open-button.zip` 并解压。
2. 将解压得到的 `folder-open-button` 文件夹复制到：

   ```text
   <你的仓库>/.obsidian/plugins/
   ```

3. 重启 Obsidian，或执行“重新加载应用”。
4. 打开 **设置 → 第三方插件**，启用 **Folder Open Button**。

### 从源码构建

需要 Node.js 18 或更高版本：

```bash
npm install
npm run build
```

构建完成后，将项目根目录中的以下文件复制到 `.obsidian/plugins/folder-open-button/`：

- `manifest.json`
- `main.js`
- `styles.css`

## 使用

将鼠标移动到左侧文件列表中的任意文件夹行，行末会出现一个文件夹图标。点击该图标即可直接打开对应的 Windows 文件夹。

## 兼容性

- 仅支持 Windows 桌面版 Obsidian。
- 最低 Obsidian 版本：1.5.0。
- 插件依赖 Obsidian 原生文件列表的 DOM 结构。未来 Obsidian 大版本若修改文件列表，插件可能需要更新。
