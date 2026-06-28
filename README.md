# Everything Markdown

Everything Markdown 是一个 Windows 桌面工具，用来把本地文件转换成 Markdown。应用基于 Electron 构建，转换能力由 Microsoft MarkItDown 提供。

## 功能

- 支持将常见办公文档和文本类文件转换为 `.md` 文件。
- 支持批量添加文件，并按队列顺序转换。
- 支持拖拽文件到窗口中快速添加。
- 可以选择 Markdown 输出目录，并记住上次选择的输出目录。
- 输出文件不会覆盖已有文件，会自动追加编号，例如 `report (1).md`。
- 发布版内置 Python 转换器，普通用户不需要单独安装 Python 或 Node.js。
- Windows 安装版启动更快，不再使用单文件便携包。
- 安装时可以取消安装，也可以选择安装路径。
- 安装器每次打开默认回到标准安装路径，不会自动沿用上次选择的路径。
- 顶栏支持中文和英文切换，默认中文。
- 顶栏支持 System、Light、Dark 三种主题模式，深色模式已优化显示层级和对比度。
- `Edit > Uninstall Everything Markdown` 可以启动官方卸载器，并显示卸载进度。

## 支持格式

```text
PDF, DOCX, PPTX, XLSX, HTML, HTM, CSV, JSON, XML, TXT
```

## 版本更新

### 0.1.6

- 优化深色模式显示，调整背景、面板、按钮、状态标签和格式标签的层级与对比度。
- 更新 Windows 安装包版本为 `Everything Markdown Setup 0.1.6.exe`。

## 普通用户教程

### 1. 下载并安装

在 GitHub Releases 中下载 Windows 安装版：

```text
Everything Markdown Setup 0.1.6.exe
```

双击安装包后，按安装向导操作即可。安装过程中可以选择安装路径，也可以取消安装。

### 2. 选择需要转换的文件

打开软件后，可以用两种方式添加源文件：

- 点击“选择文件”，从文件选择窗口中选择一个或多个文件。
- 直接把文件拖到软件窗口左侧的文件区域。

如果文件格式受支持，文件会进入转换队列；如果格式暂不支持，队列中会显示失败状态。

### 3. 选择 Markdown 保存位置

点击“选择文件夹”，选择生成的 `.md` 文件要保存到哪个目录。

软件会记住上一次选择的输出目录，下次打开时会自动带出来。

### 4. 开始转换

源文件和输出目录都选好后，点击“转换为 Markdown”。

转换完成后，界面会显示转换结果。点击“打开输出目录”可以在资源管理器中打开生成文件所在目录。

### 5. 切换语言和主题

在窗口右上角的顶栏控件中切换：

- `语言`：选择中文或 English，主页面文字会立即切换。
- `颜色`：选择 System、Light 或 Dark。

### 6. 卸载软件

在顶部菜单中打开：

```text
Edit > Uninstall Everything Markdown
```

点击后会先弹出确认窗口。确认卸载后，会启动软件自带的官方卸载器并显示卸载进度。卸载器只会删除 Everything Markdown 的安装文件，不会删除你选择过、转换过或保存在电脑上的其他文件。

## 开发环境教程

### 1. 准备环境

需要安装：

- Node.js 20+
- Python 3.11+

### 2. 安装依赖

在项目根目录执行：

```powershell
npm install
python -m pip install -r requirements.txt
```

### 3. 本地运行

```powershell
npm start
```

开发模式下不会使用打包后的内置转换器，而是调用 `scripts/convert.py`。因此本地运行前需要先安装 `requirements.txt` 中的 Python 依赖。

### 4. 运行测试

```powershell
npm test
```

当前测试覆盖了文件格式识别、输出路径生成、目录可写性检查、队列转换、Windows 安装器配置、卸载入口安全性、菜单偏好设置、语言切换和主题切换等逻辑。

## 打包 Windows 安装版

执行：

```powershell
npm run dist:win
```

该命令会先用 PyInstaller 构建内置转换器，再用 electron-builder 生成 Windows 安装版。

构建完成后，产物会生成到 `release/` 目录：

```text
release/Everything Markdown Setup 0.1.6.exe
```

`release/` 目录不会提交到 Git 仓库。发布 GitHub Release 时，只需要把安装包作为 Release 附件上传。

## 常见问题

### 转换失败怎么办？

先确认源文件存在、没有被其他程序独占，并且输出目录可写。如果是开发模式，还需要确认已经执行：

```powershell
python -m pip install -r requirements.txt
```

### 为什么生成的 Markdown 内容不完整？

转换结果取决于 MarkItDown 对源文件的解析能力。复杂排版、扫描版 PDF、图片中的文字、特殊表格或嵌入对象可能无法完整还原。

### 会不会覆盖原来的 Markdown 文件？

不会。目标文件已经存在时，软件会自动生成带编号的新文件。
