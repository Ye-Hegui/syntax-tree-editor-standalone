# Syntax Tree Editor Standalone

简单而轻量化的句法树编辑器，图形与代码双向同步，双击一个 HTML 文件即可使用。
A simple and lightweight syntax tree editor. Diagram and code stay in sync — just double-click one HTML file.

> 本项目由 deepseek 辅助开发。
> This project is developed with the assistance of DeepSeek.

![编辑器截图](screenshots/overview.png)

## 这是什么 / What this is

在图上点击、改名、增删节点会同步修改代码；编辑代码，图也会立刻随之修改。
Clicking, renaming, adding or deleting nodes on the diagram updates the code accordingly; editing the code updates the diagram immediately.

整个编辑器是**一个 HTML 文件**：样式、脚本、示例图全部内联。不需要联网、不需要安装、不需要起服务器。底层是 8 个原生 ES Module，零第三方依赖。
The whole editor is **a single HTML file**: styles, scripts and example images are all inlined. No network, no installation, no server needed. Underneath are 8 plain ES Modules with zero third-party dependencies.

## 怎么用 / How to use

到 [Releases](../../releases/latest) 下载 `Syntax Tree Editor Standalone.html`，双击即可。
Download `Syntax Tree Editor Standalone.html` from [Releases](../../releases/latest) and double-click it.

## 功能 / Features

- 两套记法（括号 / 规则），双向同步，随时切换 · Two notations (bracket / rule), bidirectionally synced
- 三种垂直对齐，两种水平位置 · Three vertical alignments, two horizontal positions
- 方向键选中：↑ 母亲节点、↓ 最左女儿节点、← → 左右姊妹节点 · Arrow-key selection
- 结构操作：下移、上移、左移、右移、增删节点 · Structural edits: move down / up / left / right, add and delete
- 位移箭头、斜体 / 粗体 / 删除线 / 九种颜色，多词叶子自动画成三角 · Movement arrows, italic / bold / strikethrough / nine colours, multi-word leaves drawn as triangles
- 一键标色：全部标蓝、单词标红、节点标红、节点标蓝；节点斜体 / 节点删除线是开关 · One-click colouring (all blue, words red, node red, node blue) plus per-node italic and strikethrough toggles
- 导出 SVG / 两倍 PNG，完整撤销重做 · Export SVG / 2x PNG, full undo and redo

各操作的详细用法见编辑器页面底部的「使用方法」。
Detailed instructions for each operation are in the "使用方法" section at the bottom of the editor page.

## 界面 / Screenshots

| 按层级 / Depth | 词对齐底部 / Words bottom | 整树贴底 / Tree bottom |
| --- | --- | --- |
| ![按层级](screenshots/align-depth.png) | ![词对齐底部](screenshots/align-leaves.png) | ![整树贴底](screenshots/align-compact.png) |

| 空白画布 / Blank canvas | 规则记法与装订线 / Rule notation and gutter |
| --- | --- |
| ![空白画布](screenshots/blank.png) | ![规则记法](screenshots/rules-gutter.png) |

## 两套记法 / The two notations

括号记法沿用语言学通行的写法，适合整棵粘贴：
Bracket notation follows the convention common in linguistics and is best for pasting a whole tree:

```
[CP [NP what_i] [C' [C is_j] [IP [NP a syntax tree] [I' [I t_j ->6] [VP [V t_j ->6] [NP t_i ->3]]]]]]]
```

规则记法为本项目设计的记录方法，每行写一条边，适合逐条核对，绘制箭头更为直观：
Rule notation is a recording method designed by this project. It writes one edge per line, which is easier to check line by line and more intuitive for drawing arrows:

```
0 XP -> D
0 XP -> X'
1 D -> w1
2 X' -> X
2 X' -> Y
4 X -> w2
5 Y -> w3
```

两套记法读写同一棵树，但**位移箭头的编号方式不同**：括号记法用**词序号**（从左到右第几个词，从 1 开始，与 jsSyntaxTree 一致），规则记法用**节点编号**（根为 0，其余按首次出现在箭头右边的那一行的行号）。样式声明两套记法都用节点编号。
Both notations read and write the same tree, but **arrows are numbered differently**: bracket notation uses **word order** (the Nth word from the left, 1-based, matching jsSyntaxTree), while rule notation uses **node numbers** (root 0, then the line on which a node first appears right of an arrow). Style declarations use node numbers in both.

## 当组件用 / Using it as a component

（尚未经过大量测试。）
(Not yet extensively tested.)

只要一张图、不要界面的话，一个函数就够（规则记法文本 → SVG 字符串，详见 [`AI-INTRO.md`](AI-INTRO.md)）：
For a diagram without any UI, one call is enough (rules text in, SVG string out — see [`AI-INTRO.md`](AI-INTRO.md)):

```js
import { rulesToSvg } from "./src/editor.js";

const svg = rulesToSvg("0 S -> NP\n0 S -> VP\n1 NP -> Dogs\n2 VP -> barks");
```

Node 里连浏览器都不需要：`node tools/render-rules.mjs 树.txt 树.svg`。
No browser needed under Node either: `node tools/render-rules.mjs tree.txt tree.svg`.

界面可以切换**中文 / English**，以及三套**称谓**（母系 / 中性 / 父系 —— 英文下是
mother node / parent node / father node 那三套）。两件事都只改界面文字，对树没有任何影响：
The UI can switch between **中文 and English**, and between three **term sets** (mother / neutral /
father — in English: mother node, parent node, father node). Both only change the wording, never the tree:

```js
new SyntaxTreeEditor("#tree-editor", { value: "[S [NP Dogs]]", lang: "en" });
editor.setLanguage("en");      // 也可以事后切换
editor.setTerms(TERMS.en.neutral);   // 称谓用 src/i18n.js 里的三套表
```

演示页上还支持 `index.html?lang=en` 直接预置语言。界面的全部文案在 [`src/i18n.js`](src/i18n.js)，
中英各一套、key 一一对应（自检会核对）。
The demo page also accepts `index.html?lang=en`. All UI strings live in [`src/i18n.js`](src/i18n.js),
one table per language with matching keys (checked by the self-test).

```js
import { SyntaxTreeEditor } from "./src/editor.js";

const editor = new SyntaxTreeEditor("#host", {
  value: "[S [NP Dogs] [VP barks]]",
  onChange: ({ text, rules }) => console.log(text),
});

editor.getValue();     // 括号记法 / bracket notation
editor.getRules();     // 规则记法 / rule notation
editor.addChild();     // 结构编辑 / structural edit
editor.toSvgString();  // 导出 / export
```

完整 API、两套记法的语法定义、以及「改一个功能要动哪几个文件」，见 [`AGENTS.md`](AGENTS.md)。函数级行号索引见 [`STRUCTURE.md`](STRUCTURE.md)。
The full API, the grammar of both notations and a guide to which files to touch are in [`AGENTS.md`](AGENTS.md); function-level line numbers are in [`STRUCTURE.md`](STRUCTURE.md).

## 开发 / Development

```
npm.cmd run build    重新生成单文件版 / rebuild the standalone file
npm.cmd test         四套测试 + 一致性自检 / four test suites plus the self-check
```

| 测试套件 / Test suite | 负责 / Responsibility |
| --- | --- |
| `test/smoke.mjs`（111 项） | 纯逻辑：模型、两套记法、布局、箭头，不需要浏览器<br>Pure logic: model, both notations, layout, arrows; no browser needed |
| `test/rules.test.mjs`（31 项） | 规则记法的解析、序列化、错误信息<br>Rule notation parsing, serialisation and errors |
| `test/editor.test.mjs`（172 项） | 交互层，跑在最小 DOM 垫片上<br>Interaction layer, on a minimal DOM shim |
| `test/standalone.test.mjs`（13 项） | 单文件版：模块没有遗漏、内联后可以运行<br>Standalone file: nothing missing, still runnable after inlining |

修改 `src/`、`index.html` 或 `style.css` 之后必须重新构建。`npm.cmd test` 会将磁盘上的构建产物与重新构建的结果逐字节比对，缺少重新构建将直接报错。
A rebuild is required after modifying `src/`, `index.html` or `style.css`. `npm.cmd test` compares the build output on disk with a freshly built result byte by byte, and reports an error when the rebuild is missing.

`Syntax Tree Editor Standalone.html` 为构建产物，不应手动修改。
`Syntax Tree Editor Standalone.html` is a build output and should not be edited manually.

## 文件结构 / File structure

```
Syntax Tree Editor Standalone.html   交付物，双击即用（构建产物）/ deliverable, double-click to run (build output)
index.html                           编辑器页面与使用方法 / editor page and instructions
style.css                            全部样式 / all styles
package.json                         build / test / serve
AGENTS.md                            给 AI agent 的项目说明 / project notes for AI agents
AI-INTRO.md                          给 AI 的规则记法说明与出图入口 / rules-notation guide for AI
STRUCTURE.md                         函数级行号索引 / function-level line index
CHANGELOG.md                         更新日志 / changelog
src/model.js                         数据模型与结构操作，不依赖 DOM / data model and tree ops, DOM-free
src/notation.js                      括号记法 ↔ 模型 / bracket notation to model
src/rules.js                         规则记法 ↔ 模型 / rule notation to model
src/style.js                         斜体 / 粗体 / 删除线 / 颜色声明 / italic, bold, strikethrough and colour declarations
src/layout.js                        布局与对齐，不依赖 DOM / layout and alignment, DOM-free
src/render.js                        渲染为可交互 SVG / renders an interactive SVG
src/i18n.js                          界面文案表（中/英）与三套称谓用词 / UI strings (zh/en) and the term sets
src/docs-en.js                       教程正文的英文版 / English version of the tutorial body
src/editor.js                        核心组件 SyntaxTreeEditor / the core component
src/main.js                          演示页引导 / demo page bootstrap
test/smoke.mjs                       纯逻辑测试 / pure logic tests
test/rules.test.mjs                  规则记法测试 / rule notation tests
test/editor.test.mjs                 交互层测试 / interaction layer tests
test/standalone.test.mjs             构建产物测试 / build output tests
test/dom-shim.mjs                    最小 DOM 垫片 / minimal DOM shim
tools/build-standalone.mjs           内联成单文件版 / inlines the modules
tools/check-project.mjs              一致性自检 / consistency self-check
tools/gen-examples.mjs               生成示例图 / generates the example images
tools/gen-structure.mjs              生成 STRUCTURE.md / generates STRUCTURE.md
tools/render-rules.mjs               规则记法文本直接出 SVG / rules text to SVG, no browser
screenshots/                         手工截图，被本文件引用 / hand-taken, referenced by this file
example/                             教程配图，生成后在构建时内联 / tutorial figures, generated then inlined
```

## 文档地图与生成物 / Docs map and generated files

哪份文件是给谁看的、哪些是生成出来的：

| 文件 / File | 给谁 / For | 手写还是生成 / Hand-written or generated |
| --- | --- | --- |
| `README.md` | 使用者 / users | 手写 / hand-written |
| `index.html` 的教程 / tutorial | 使用者 / users | 手写 / hand-written |
| `AGENTS.md` | AI agent（改代码前必读 / read before editing） | 手写 / hand-written |
| `AI-INTRO.md` | AI agent（只讲规则记法与出图 / notation + rendering only） | 手写 / hand-written |
| `CHANGELOG.md` | 发布记录 / release notes | 手写 / hand-written |
| `STRUCTURE.md` | 查行号 / line-number index | **生成**：`node tools/gen-structure.mjs` |
| `Syntax Tree Editor Standalone.html` | 交付物 / deliverable | **生成**：`npm run build` |
| `example/*.svg` | 教程配图 / tutorial figures | **生成**：`node tools/gen-examples.mjs` |
| `screenshots/*.png` | 本文件的截图 / screenshots for this README | 手工，界面一变要重拍 / manual, retake after UI changes |

改哪一类文件、之后要跑什么：

| 改了什么 / Changed | 之后必须跑 / Then run |
| --- | --- |
| `src/`、`index.html`、`style.css` | `npm run build` + `npm test` |
| 测试用例数量 / number of test cases | 同步本文件里的 `（N 项）`，再 `npm test` |
| 教程正文 / tutorial text | `npm test`（自检校锚点与图片引用） |
| `example/` 的配图（改绘图逻辑 / drawing logic） | `node tools/gen-examples.mjs` + `npm run build` |
| 界面外观 / UI appearance | 重拍 `screenshots/`，再 `npm test` |
| `screenshots/` 里的图 / screenshots | `npm test`（自检查孤儿图与引用） |

## 已知限制 / Known limitations

- 图上不能直接画箭头，只能在代码面板写声明 · Arrows must be declared in the code panel, not drawn on the diagram
- 不能拖拽节点 · Nodes cannot be dragged
- 标签里不能有双引号，记法没有转义写法 · Labels cannot contain double quotes; no escape syntax
- 规则记法至少要有一条边，孤立节点在规则记法里是空的 · Rule notation needs at least one edge; a lone node is empty in it
- 尚不支持英文界面，将在后续版本中开发 · An English interface is not yet supported; it is planned for a future release
  （**已实现**：界面与教程正文现在都是中英双语，页头右上角随时切换。
  见 [`CHANGELOG.md`](CHANGELOG.md) 的 v1.2.2 与 v1.2.3 两节 · **Done**: the UI *and* the tutorial body
  are bilingual now, switched from the top-right of the page — see the v1.2.2 and v1.2.3 entries in
  [`CHANGELOG.md`](CHANGELOG.md)）

## 许可证 / License

以 **MIT 许可证**发布，全文见 [`LICENSE`](LICENSE)。可自由使用、修改、再分发，包括商用，只需保留版权声明；软件按原样提供，不附带任何担保。
Released under the **MIT License**, see [`LICENSE`](LICENSE). Free to use, modify and redistribute, including commercially, as long as the copyright notice is kept; provided as is, without warranty of any kind.

输入格式沿用 phpSyntaxTree / jsSyntaxTree 通行的括号记法。本项目为独立实现，未使用其源码。
The input format follows the bracket notation common to phpSyntaxTree / jsSyntaxTree. This is an independent implementation and uses none of their source code.

## 链接 / Links

- **项目地址 / Repository**：<https://github.com/Ye-Hegui/syntax-tree-editor-standalone/>
- **在线使用 / Live demo**：<https://ye-hegui.github.io/syntax-tree-editor-standalone/>
- **组件下载 / Download**：<https://disk.pku.edu.cn/link/AADCFA80E10F2B4D49B2FA4A8A0C9BB2CF>

想在本地跑：双击单文件版 `Syntax Tree Editor Standalone.html` 即可（不联网、不起服务器）；
开发时用 `npm.cmd run serve`（或任意静态服务器）打开 `index.html`。
To run it locally, just double-click `Syntax Tree Editor Standalone.html` (no network, no server needed);
for development, open `index.html` through `npm.cmd run serve` (or any static server).