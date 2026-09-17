# 目录与函数索引
这份文件由 `tools/gen-structure.mjs` 自动生成，行号取自源码。
改了源码之后跑 `node tools/gen-structure.mjs` 重新生成；`npm test` 会检查它是不是最新的。

## 顶层

```
Syntax Tree Helper/
├── README.md              工作区总览：哪部分是自己写的、哪部分是参考项目
├── editor/                ⭐ 正式项目（下面详细展开）
├── jssyntaxtree-master/   参考项目（jsSyntaxTree v1.4，GPL-2.0），一行没动
└── jssyntaxtree-master.zip
```

## Syntax Tree Editor Standalone/

```
Syntax Tree Editor Standalone/
├── Syntax Tree Editor Standalone.html   双击即用的单文件版（构建产物）
├── index.html         演示页
├── style.css          全部样式
├── package.json       build / test / serve
├── README.md          项目说明
├── .gitignore
├── src/               7 个模块
├── test/              4 个测试套件 + DOM 垫片
├── tools/             构建、自检、生成本文件
└── docs/              截图
```

---

## 入口与样式

### `index.html`
> 演示页 + 「使用方法」文档（分级目录、九个章节）。需要 HTTP 打开，见 README。

### `style.css`
> 全部样式。编辑器部分用 `.ste-` 前缀，文档部分用 `.docs` 前缀。

### `package.json`
> 只提供三个命令：`build` / `test` / `serve`。零依赖。

### `README.md`
> 项目说明：设计取舍、快捷键、两套记法、已知限制。

### `.gitignore`
> 忽略临时文件。单文件版是交付物，**不**忽略。

### `Syntax Tree Editor Standalone.html`
> ⭐ 交付的单文件版，双击即用。由 tools/build-standalone.mjs 生成，**不要手改**。

---

## src/ —— 源码

### `src/editor.js`
> 核心组件 SyntaxTreeEditor：交互、快捷键、撤销、双向同步、空白画布、装订线。
> 1412 行 / 49036 字节

私有方法以 `#` 开头，只在类内部使用。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 30 | `SVG_NS` | — |
| 35 | `PALETTE` | 最后是斜体的小 v 和 pro（习惯上这两个词类用斜体写）。 |
| 44 | `ITALIC_CHIPS` | — |
| 47 | `TIPS` | — |
| 49 | `HINT` | — |
| 56 | `ALIGN_TEXT` | 所以不可能出现"布局支持某个模式、界面上却没有按钮"的情况。 |
| 61 | `ALIGN_CHOICES` | — |
| 64 | `CENTER_TEXT` | 水平位置：两种模式，说明见 layout.js 的 CENTER_MODES |
| 68 | `CENTER_CHOICES` | — |
| 71 | `TEXT_MODES` | 两套等价的记法，随时可切换 |
| 76 | `TEXT_DEBOUNCE` | — |
| 78 | `makeMeasurer` | — |
| 93 | `download` | — |
| 103 | `stripUnsupported` | — |
| 109 | `offsetToLineCol` | — |
| 122 | `lineColToOffset` | — |
| 1404 | `countSubtree` | — |

**类**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 130 | `SyntaxTreeEditor` | — |

**方法与字段**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 131 | `constructor` | — |
| 192 | `setValue` | 用括号记法设置整棵树。 |
| 205 | `setStyle` | 设置选中节点的字体样式。italic / bold 会写进记法末尾的 Italic(...) / Bold(...) 声明里。 |
| 215 | `getValue` | — |
| 223 | `loadValue` | 载入一棵新树，但**保留撤销历史** —— 按 Ctrl+Z 可以退回载入之前的那棵树。 |
| 237 | `clear` | — |
| 242 | `setOptions` | — |
| 248 | `toSvgString` | — |
| 267 | `exportSvg` | — |
| 271 | `exportPng` | — |
| 297 | `#buildDom` | ------------------------------------------------------------ DOM 骨架 |
| 562 | `#reindex` | ------------------------------------------------------------ 渲染管线 |
| 566 | `#relayout` | — |
| 611 | `#refresh` | — |
| 623 | `#serializeCurrent` | — |
| 628 | `#parseCurrent` | — |
| 632 | `#syncTextModeButtons` | — |
| 641 | `setTextMode` | — |
| 656 | `#buildCodeBox` | 代码框 = 左边一条装订线（行号）+ 右边真正的 textarea。 |
| 683 | `#syncGutter` | 按当前文本刷新装订线。 |
| 697 | `#syncGutterScroll` | — |
| 709 | `#repairRulesNumbers` | 规则记法里"编号就是行号"，所以在上面插一行、删一行都会让下面所有引用错位。 |
| 757 | `#syncTextareaSize` | — |
| 762 | `getRules` | — |
| 767 | `setRules` | — |
| 776 | `#syncCenterButtons` | — |
| 785 | `setCenter` | — |
| 792 | `#syncAlignButtons` | — |
| 801 | `setAlign` | — |
| 808 | `#writeText` | — |
| 815 | `#emitChange` | — |
| 826 | `#updateStatus` | — |
| 871 | `#showError` | — |
| 880 | `#clearError` | — |
| 892 | `#select` | 切换选中态。 |
| 908 | `#snapshot` | ------------------------------------------------------------ 历史 |
| 916 | `#pushUndo` | — |
| 923 | `#restore` | — |
| 935 | `undo` | — |
| 941 | `redo` | — |
| 947 | `#mutate` | — |
| 960 | `createRoot` | 在空白画布上创建根节点，并直接进入改名状态。 |
| 978 | `addChild` | — |
| 994 | `addSibling` | — |
| 1016 | `addLevel` | 下移（Tab）：在投射链的最顶端之上插入一个新的投射层， |
| 1029 | `collapseLevel` | 上移（Shift+Tab）：下移的逆。要求母亲节点只有自己这一个女儿节点、 |
| 1039 | `#canMoveLeft` | — |
| 1051 | `#canMoveRight` | — |
| 1066 | `moveLeft` | 左移（Alt+← / Ctrl+←）：自己是最左边的女儿节点时，搬到母亲节点的左姊妹节点底下。 |
| 1074 | `moveRight` | 右移（Alt+→ / Ctrl+→）：自己是最右边的女儿节点时，搬到母亲节点的右姊妹节点底下。 |
| 1085 | `remove` | 删除选中的节点。 |
| 1123 | `setLabel` | — |
| 1138 | `#startEdit` | ------------------------------------------------------------ 内联改名 |
| 1152 | `#positionEditor` | — |
| 1171 | `#commitEdit` | 提交改名。 |
| 1181 | `#cancelEdit` | — |
| 1194 | `#onCanvasDown` | ------------------------------------------------------------ 事件 |
| 1207 | `#onCanvasDblClick` | — |
| 1218 | `setTerms` | 换一套亲属称谓。**只改界面上的文字**（按钮名、提示行、装订线说明）， |
| 1225 | `#t` | — |
| 1231 | `#term` | — |
| 1236 | `#onKeyDown` | — |
| 1338 | `#onTextInput` | ------------------------------------------------------------ 文本面板 |
| 1368 | `#selectFromCaret` | — |
| 1390 | `#selectByOffset` | — |

### `src/layout.js`
> tidy tree 布局 + 三种垂直对齐。文字宽度靠注入的 measure()，不依赖 DOM。
> 210 行 / 7365 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 13 | `ALIGN_MODES` | ALIGN_MODES 是这三个取值的唯一来源，编辑器的按钮直接由它派生，不会走偏。 |
| 20 | `CENTER_MODES` | CENTER_MODES 是这两个取值的唯一来源，编辑器的按钮直接由它派生。 |
| 29 | `layout` | maxRow:number,info:Map<object,object>,items:object[],options:object}} |

### `src/main.js`
> 演示页引导：例句、URL 参数。
> 115 行 / 4486 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 3 | `EXAMPLES` | — |
| 23 | `params` | index.html?textmode=rules               预置代码框记法：bracket / rules |
| 25 | `initialValue` | — |
| 35 | `editor` | — |
| 57 | `TERM_SETS` | 从左到右逐条替换，所以长词（"女儿节点"）必须排在短词（"女儿"）前面。 |
| 79 | `bindToc` | — |
| 90 | `docsEl` | — |
| 92 | `docsBase` | 留一份母系原文，每次切换都从它出发，来回切不会串味 |
| 94 | `setTerms` | — |

### `src/model.js`
> 数据模型 + 所有结构操作。不依赖 DOM，是唯一真相来源。
> 273 行 / 10238 字节

术语统一用**母亲节点 / 姊妹节点 / 女儿节点**。节点结构 `{ id, label, sub, sup, arrow, children }`。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 16 | `node` | — |
| 21 | `walk` | — |
| 27 | `preorder` | — |
| 34 | `findParent` | — |
| 53 | `nodeIds` | 两套记法共用的节点编号。 |
| 63 | `addChild` | — |
| 72 | `removeNode` | — |
| 93 | `primeChain` | 沿投射链往上走，返回 [n, n', n'', ...]（从下往上）。 |
| 106 | `canAddPrimeLevel` | — |
| 128 | `addPrimeLevel` | 下移（Tab）：给投射链增加一层投射层。 |
| 148 | `canCollapsePrimeLevel` | 能不能减一层投射。要求同时满足： |
| 167 | `collapsePrimeLevel` | 上移（Shift+Tab）：下移的逆。 |
| 209 | `moveNodeLeft` | 左移（Alt+←）。两个分支，和右移对称： |
| 248 | `moveNodeRight` | 右移（Alt+→）。和左移对称： |

### `src/notation.js`
> 括号记法 ↔ 模型：词法分析、递归下降解析、序列化、文本位置映射。
> 369 行 / 12199 字节

括号记法的箭头用**词序号**（从左到右第几个词，从 1 开始，与 jsSyntaxTree 一致），样式声明用**节点编号**。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 27 | `leafOrdinals` | 叶子节点的「词序号」：从左到右第几个词，从 1 开始。 |
| 47 | `WS` | — |
| 48 | `CTRL` | — |
| 50 | `OPEN` | — |
| 51 | `CLOSE` | — |
| 52 | `STRING` | — |
| 53 | `QUOTED` | — |
| 54 | `NUMBER` | — |
| 55 | `SUB` | — |
| 56 | `SUP` | — |
| 57 | `MOVEMENT` | — |
| 59 | `VALUE_TOKENS` | — |
| 63 | `tokenize` | ---------------------------------------------------------------- 词法分析 |
| 142 | `parseSubSup` | ---------------------------------------------------------------- 语法分析 |
| 152 | `parseNode` | — |
| 187 | `parseValue` | — |
| 220 | `tokenText` | — |
| 232 | `parse` | — |
| 263 | `NO_SPACE_BARE` | ---------------------------------------------------------------- 序列化 |
| 279 | `needsQuote` | 判断标签能不能不加引号地写出来。三种上下文规则不同： |
| 303 | `quote` | — |
| 319 | `serialize` | 模型 -> 括号记法。 |
| 366 | `toText` | — |

**类**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 39 | `NotationError` | — |

**方法与字段**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 40 | `constructor` | — |

### `src/render.js`
> 把布局结果画成可交互 SVG。视觉属性全部内联，导出的图脱离页面也能看。
> 207 行 / 6965 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 10 | `NS` | 命中区域。事件用委托挂在 <svg> 上，节点增删不需要重新绑定。 |
| 12 | `el` | — |
| 18 | `COLORS` | — |
| 29 | `drawTree` | — |

### `src/rules.js`
> 规则记法 ↔ 模型：一行一条「母亲节点 → 女儿节点」。
> 310 行 / 9711 字节

编号 = 行号，所以插行/删行会让下面引用错位；编辑器会自动改回去。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 39 | `RULE_WS` | — |
| 42 | `parseLabelToken` | — |
| 97 | `makeNode` | — |
| 104 | `parseLine` | — |
| 152 | `resolveMother` | 找这一行的母亲节点。 |
| 174 | `parseRules` | 规则记法 -> 模型。 |
| 243 | `tokenOf` | — |
| 258 | `serializeRules` | 模型 -> 规则记法 |
| 307 | `toRulesText` | — |

**类**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 31 | `RuleError` | — |

**方法与字段**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 32 | `constructor` | — |

### `src/style.js`
> —
> 132 行 / 4101 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 29 | `DECL` | — |
| 33 | `COLOR_DECL` | Color(4, red) |
| 36 | `COLOR_NAMES` | — |
| 45 | `COLOR_VALUES` | 颜色名 -> 实际色值。 |
| 61 | `splitStyleDecls` | 把尾部的样式声明切下来。 |
| 92 | `applyStyleDecls` | — |
| 111 | `styleDeclsText` | — |

---

## test/ —— 测试

### `test/dom-shim.mjs`
> 最小 DOM 垫片，让编辑器能在 Node 里跑起来。
> 290 行 / 7325 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 204 | `makeEvent` | — |
| 218 | `ctx2d` | — |
| 241 | `doc` | — |
| 278 | `escapeXML` | — |
| 283 | `installDom` | — |

**类**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 8 | `ClassList` | 内联改名、快捷键、撤销重做、双向同步。视觉呈现仍需人眼确认。 |
| 33 | `El` | — |
| 267 | `XMLSerializer` | — |

**方法与字段**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 9 | `constructor` | — |
| 12 | `#list` | — |
| 15 | `#set` | — |
| 18 | `add` | — |
| 23 | `remove` | — |
| 26 | `contains` | — |
| 34 | `constructor` | — |
| 53 | `setAttribute` | --- 属性 |
| 56 | `getAttribute` | — |
| 91 | `appendChild` | --- 树结构 |
| 96 | `append` | — |
| 99 | `insertBefore` | — |
| 106 | `removeChild` | — |
| 112 | `remove` | — |
| 115 | `replaceChildren` | — |
| 125 | `matches` | --- 选择器 |
| 129 | `closest` | — |
| 137 | `#descendants` | — |
| 144 | `querySelectorAll` | — |
| 148 | `querySelector` | — |
| 153 | `addEventListener` | --- 事件 |
| 157 | `removeEventListener` | — |
| 161 | `dispatchEvent` | — |
| 174 | `click` | — |
| 179 | `focus` | --- 焦点 |
| 182 | `blur` | — |
| 186 | `select` | — |
| 190 | `setSelectionRange` | — |
| 195 | `cloneNode` | — |
| 268 | `serializeToString` | — |

### `test/editor.test.mjs`
> 交互层测试（跑在 DOM 垫片上）。
> 1496 行 / 58079 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 15 | `t` | — |
| 26 | `sleep` | — |
| 28 | `mount` | — |
| 33 | `nodeGroups` | — |
| 37 | `hitRectOf` | — |
| 43 | `clickNode` | — |
| 47 | `dblClickNode` | — |
| 51 | `key` | — |
| 55 | `typeText` | — |
| 62 | `NODES_IN` | — |
| 660 | `ALIGN_TREE` | S 底下挂两棵不等深的子树，用来区分三种对齐 |
| 662 | `rowsOf` | 深度：S0 A1 B2 C3 x4 D1 E2 y3 |
| 820 | `MOVE_TREE` | 用户给的例子 |
| 821 | `AFTER_LEFT` | — |
| 822 | `AFTER_RIGHT` | — |
| 825 | `selectT` | — |
| 958 | `fillOf` | — |
| 1003 | `USER_RULES` | — |
| 1292 | `NEUTRAL` | — |
| 1293 | `FATHER` | — |
| 1410 | `ARROW_TREE` | — |

### `test/rules.test.mjs`
> 规则记法测试。
> 310 行 / 10564 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 12 | `t` | — |
| 35 | `USER_RULES` | 注意：行号不在文本里，由编辑器左侧的装订线显示 |
| 45 | `USER_TREE` | — |

### `test/smoke.mjs`
> 纯逻辑测试（不需要浏览器）。
> 750 行 / 30061 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 25 | `t` | — |
| 36 | `roundtrip` | — |
| 41 | `dump` | — |
| 51 | `sameTree` | — |
| 55 | `stable` | — |
| 148 | `measure` | — |
| 150 | `layoutOf` | — |
| 202 | `ALIGN_TREE` | 深度：S0 A1 B2 C3 x4 D1 E2 y3 |
| 204 | `rowsOf` | — |
| 313 | `wordsOf` | 规则：叶子 + 母亲节点的唯一的女儿节点（也就是记法里写成裸标签的那种）才算"词" |
| 365 | `MOVE_TREE` | ② 自己是最边上的女儿 -> 搬到母亲节点那一侧的姊妹底下 |
| 367 | `moveFixture` | — |

### `test/standalone.test.mjs`
> 单文件构建产物测试：模块没漏、内联后真的能跑。
> 145 行 / 5880 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 14 | `doc` | — |
| 19 | `t` | — |
| 30 | `HTML` | — |
| 32 | `scriptMatch` | — |
| 33 | `bundle` | — |
| 106 | `host` | — |

---

## tools/ —— 工具

### `tools/build-standalone.mjs`
> 把 7 个模块内联成那个单文件版。
> 136 行 / 5440 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 13 | `ROOT` | — |
| 16 | `OUT_NAME` | — |
| 20 | `MODULES` | 唯一会立刻跑的是 main.js，所以扁平拼接是安全的。 |
| 31 | `read` | — |
| 34 | `stripImports` | — |
| 39 | `stripExports` | — |
| 44 | `topLevelNames` | — |
| 52 | `buildBundle` | — |
| 78 | `buildHtml` | — |
| 118 | `buildStandalone` | 生成 standalone.html 的内容。 |
| 124 | `isMain` | 直接运行本文件时才写盘；被 import 时只导出函数 |

### `tools/check-project.mjs`
> 一致性自检：文档 / 文件结构 / 构建产物不许对不上。
> 147 行 / 6013 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 13 | `ROOT` | — |
| 14 | `read` | — |
| 17 | `fail` | — |
| 21 | `pass` | — |
| 22 | `section` | — |
| 24 | `README` | — |
| 25 | `INDEX` | — |
| 36 | `referenced` | — |
| 50 | `countCases` | 测试都是顶层 `t(...)` / `await t(...)` 调用，数调用点即可 |
| 76 | `treeSection` | — |
| 87 | `onDisk` | — |

### `tools/gen-examples.mjs`
> —
> 48 行 / 2182 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 13 | `ROOT` | — |
| 14 | `OUT_DIR` | — |
| 17 | `CASES` | — |

### `tools/gen-structure.mjs`
> 生成这份 STRUCTURE.md。
> 184 行 / 8948 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 11 | `ROOT` | — |
| 12 | `read` | — |
| 15 | `PURPOSE` | — |
| 43 | `NOTES` | — |
| 51 | `docAbove` | — |
| 72 | `esc` | — |
| 77 | `topLevel` | — |
| 90 | `methods` | — |
| 122 | `table` | — |
| 131 | `out` | ---------------------------------------------------------------- 组装 |
| 142 | `groups` | — |
| 181 | `md` | — |

---

## docs/ —— 截图

### `docs/align-compact.png`
> —

### `docs/align-depth.png`
> —

### `docs/align-leaves.png`
> —

### `docs/blank.png`
> —

### `docs/overview.png`
> —

### `docs/rules-gutter.png`
> —

---

## 常用命令
| 命令 | 作用 |
| --- | --- |
| `npm test` | 四个测试套件 + 一致性自检 |
| `npm run build` | 重新生成 `standalone.html` |
| `npm run check` | 只跑一致性自检 |
| `node tools/gen-structure.mjs` | 重新生成这份目录 |
| `npm run serve` | 起本地 HTTP 服务（演示页需要） |
