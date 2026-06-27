# Everything Markdown

Everything Markdown 是一个 Windows 桌面工具，用于把本地文件转换为 Markdown。应用基于 Electron 构建，转换能力由 Microsoft MarkItDown 提供。

![软件界面](docs/screenshot.png)

## 功能

- 支持将常见办公文档和文本类文件转换为 `.md` 文件。
- 可选择源文件和 Markdown 输出目录。
- 输出文件不会覆盖已有文件，会自动追加编号，例如 `report (1).md`。
- 发布版已内置 Python 转换器，普通用户不需要单独安装 Python 或 Node.js。

## 支持格式

当前支持：

```text
PDF, DOCX, PPTX, XLSX, HTML, HTM, CSV, JSON, XML, TXT
```

## 直接使用

普通用户可以在 GitHub Releases 中下载 Windows 便携版：

```text
Everything Markdown 0.1.0.exe
```

下载后双击运行即可。

## 开发环境

需要安装：

- Node.js 20+
- Python 3.11+

安装依赖：

```powershell
npm install
python -m pip install -r requirements.txt
```

本地运行：

```powershell
npm start
```

运行测试：

```powershell
npm test
```

## 构建 Windows 便携版

```powershell
npm run dist:win
```

构建完成后，便携版应用会生成到 `release/` 目录。
