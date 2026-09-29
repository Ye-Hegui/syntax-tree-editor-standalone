# 目录与函数索引
这份文件由 `tools/gen-structure.mjs` 自动生成，行号取自源码。
改了源码之后跑 `node tools/gen-structure.mjs` 重新生成；`npm test` 会检查它是不是最新的。

## 顶层（工作区）

```
Syntax Tree Helper/
├── README.md              工作区说明：哪部分是自己写的、哪部分是参考项目
├── Todolist.md            待办清单（简明版）
├── HANDOVER.md            交接笔记（本地，不在仓库里）
├── Syntax Tree Editor Standalone/    ⭐ 正式项目（下面详细展开）
├── disk_v1.2.0/           网盘版 v1.2.0 快照（不要动）
├── reference/             只读参考（jsSyntaxTree，GPL-2.0）
└── archive/               过期与一次性产物
```

## Syntax Tree Editor Standalone/

```
Syntax Tree Editor Standalone/
├── Syntax Tree Editor Standalone.html   双击即用的单文件版（构建产物）
├── index.html         演示页 + 使用教程
├── style.css          全部样式
├── package.json       build / test / serve
├── README.md          项目说明（面向使用者，中英对照）
├── AGENTS.md          给 AI agent 的项目说明
├── AI-INTRO.md        给 AI 的规则记法说明与出图入口
├── CHANGELOG.md       更新日志
├── STRUCTURE.md       本文件（自动生成）
├── LICENSE            MIT
├── .gitignore / .gitattributes
├── src/               9 个模块
├── test/              4 个测试套件 + DOM 垫片
├── tools/             构建、自检、生成示例图与索引、文本出图
├── screenshots/       手工截图（README 用）
└── example/           教程配图（生成，构建时内联）
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

### `src/docs-en.js`
> —
> 528 行 / 30275 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 19 | `DOCS_EN` | 教程正文（网页底部「使用方法」那一篇）的英文版。 |

### `src/editor.js`
> 核心组件 SyntaxTreeEditor：交互、快捷键、撤销、双向同步、空白画布、装订线。
> 1804 行 / 68735 字节

私有方法以 `#` 开头，只在类内部使用。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 36 | `SVG_NS` | — |
| 41 | `PALETTE` | 最后是斜体的小 v 和 pro（习惯上这两个词类用斜体写）。 |
| 50 | `ITALIC_CHIPS` | — |
| 57 | `ALIGN_CHOICES` | 所以不可能出现"布局支持某个模式、界面上却没有按钮"的情况。 |
| 60 | `CENTER_CHOICES` | 水平位置：两种模式，说明见 layout.js 的 CENTER_MODES |
| 63 | `TEXT_MODES` | 两套等价的记法，随时可切换 |
| 68 | `TEXT_DEBOUNCE` | — |
| 70 | `makeMeasurer` | — |
| 85 | `download` | — |
| 95 | `stripUnsupported` | — |
| 101 | `offsetToLineCol` | — |
| 114 | `lineColToOffset` | — |
| 143 | `rulesToSvg` | 一行出图：**文本 → SVG 字符串**，不需要页面上先有一个编辑器实例。 |
| 1796 | `countSubtree` | — |

**类**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 156 | `SyntaxTreeEditor` | — |

**方法与字段**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 157 | `constructor` | — |
| 222 | `setValue` | 用括号记法设置整棵树。 |
| 236 | `setStyle` | 设置选中节点的字体样式。italic / bold / strike 会写进记法末尾的 |
| 272 | `#isDeclaredBlue` | — |
| 277 | `#hasOtherColorThan` | — |
| 282 | `#hasAnyColor` | — |
| 291 | `#canCleanWordColors` | 「单词标红」还做不做得成事（灰掉判定要和 `markWordsRed()` 完全一致，否则会出现 |
| 302 | `markAllBlue` | 全蓝：**清掉所有颜色声明，然后只写一句** —— 每个节点都写上蓝色声明，导出正好是 `Blue(all)`。 |
| 329 | `markWordsRed` | 单词标红（作者 2026-09-18 定的三步，实现严格照做）： |
| 351 | `markSelectedRed` | — |
| 361 | `markSelectedBlue` | — |
| 374 | `toggleSelectedItalic` | 节点斜体：切换选中节点的斜体（再点一次取消）。 |
| 382 | `toggleSelectedStrike` | — |
| 390 | `getValue` | — |
| 398 | `loadValue` | 载入一棵新树，但**保留撤销历史** —— 按 Ctrl+Z 可以退回载入之前的那棵树。 |
| 412 | `clear` | — |
| 417 | `setOptions` | — |
| 423 | `toSvgString` | — |
| 458 | `exportSvg` | — |
| 462 | `exportPng` | — |
| 488 | `#buildDom` | ------------------------------------------------------------ DOM 骨架 |
| 828 | `#reindex` | ------------------------------------------------------------ 渲染管线 |
| 837 | `#layoutOptions` | layout 的选项。画布与导出共用这一份 —— 导出多传一个 `hideEscapes: true`， |
| 852 | `#drawOptions` | drawTree 的选项。画布和导出共用这一份 —— 导出多传一个 `hideEscapes: true`， |
| 865 | `#relayout` | — |
| 899 | `#refresh` | — |
| 911 | `#serializeCurrent` | — |
| 916 | `#parseCurrent` | — |
| 920 | `#syncTextModeButtons` | — |
| 929 | `setTextMode` | — |
| 944 | `#buildCodeBox` | 代码框 = 左边一条装订线（行号）+ 右边真正的 textarea。 |
| 971 | `#syncGutter` | 按当前文本刷新装订线。 |
| 985 | `#syncGutterScroll` | — |
| 997 | `#repairRulesNumbers` | 规则记法里"编号就是行号"，所以在上面插一行、删一行都会让下面所有引用错位。 |
| 1045 | `#syncTextareaSize` | — |
| 1050 | `getRules` | — |
| 1055 | `setRules` | — |
| 1064 | `#syncCenterButtons` | — |
| 1073 | `setCenter` | — |
| 1080 | `#syncAlignButtons` | — |
| 1092 | `#syncStyleButtons` | 斜体 / 删除线那两个按钮是开关，所以要反映选中节点的当前状态。 |
| 1100 | `setAlign` | — |
| 1107 | `#writeText` | — |
| 1114 | `#emitChange` | — |
| 1125 | `#updateStatus` | — |
| 1200 | `#showError` | — |
| 1209 | `#clearError` | — |
| 1221 | `#select` | 切换选中态。 |
| 1237 | `#snapshot` | ------------------------------------------------------------ 历史 |
| 1245 | `#pushUndo` | — |
| 1252 | `#restore` | — |
| 1264 | `undo` | — |
| 1270 | `redo` | — |
| 1276 | `#mutate` | — |
| 1289 | `createRoot` | 在空白画布上创建根节点，并直接进入改名状态。 |
| 1307 | `addChild` | — |
| 1325 | `addSibling` | — |
| 1350 | `addLevel` | 下移（Tab）：给投射链增加一层投射层（详见 model.js 的 addPrimeLevel）。 |
| 1371 | `collapseLevel` | 上移（Shift+Tab）：下移的逆。要求母亲节点只有自己这一个女儿节点、 |
| 1388 | `forceCollapseLevel` | 强制上移（Alt+Shift+Tab）：不看「上移」那些严格前提，把选中节点这一格整个抽掉 —— |
| 1398 | `#canMoveLeft` | — |
| 1410 | `#canMoveRight` | — |
| 1425 | `moveLeft` | 左移（Alt+← / Ctrl+←）：自己是最左边的女儿节点时，搬到母亲节点的左姊妹节点底下。 |
| 1433 | `moveRight` | 右移（Alt+→ / Ctrl+→）：自己是最右边的女儿节点时，搬到母亲节点的右姊妹节点底下。 |
| 1444 | `remove` | 删除选中的节点。 |
| 1485 | `#setNodeLabel` | 改标签（并且同步转义标记）。规则只有一条：标签**正好**是 %Empty 就是转义节点， |
| 1491 | `setLabel` | — |
| 1506 | `#startEdit` | ------------------------------------------------------------ 内联改名 |
| 1520 | `#positionEditor` | — |
| 1539 | `#commitEdit` | 提交改名。 |
| 1549 | `#cancelEdit` | — |
| 1563 | `#onCanvasDown` | ------------------------------------------------------------ 事件 |
| 1576 | `#onCanvasDblClick` | — |
| 1587 | `setTerms` | 换一套亲属称谓。**只改界面上的文字**（按钮名、提示行、装订线说明）， |
| 1597 | `setLanguage` | 换界面语言。**只改界面上的文字**，对树没有任何影响。 |
| 1604 | `#t` | — |
| 1609 | `#relabel` | — |
| 1621 | `#term` | 界面文案要在切换语言/称谓时重新生成的，都登记在这里。 |
| 1626 | `#onKeyDown` | — |
| 1730 | `#onTextInput` | ------------------------------------------------------------ 文本面板 |
| 1760 | `#selectFromCaret` | — |
| 1782 | `#selectByOffset` | — |

### `src/i18n.js`
> —
> 379 行 / 18851 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 18 | `LANGS` | 界面文案表 + 「称谓」用词表。 |
| 21 | `LANG_LABELS` | — |
| 27 | `TERMS` | 三套「称谓」。同一棵树、同一个界面，只是换一种叫法，对树本身没有任何影响。 |
| 75 | `TERM_KINDS` | 中文就是原来的「母系 / 中性 / 父系」。 |
| 76 | `TERM_LABELS` | — |
| 90 | `DEFAULT_TERM` | 每种语言**默认**用哪套称谓（作者 2026-09-17 定）： |
| 92 | `STRINGS` | — |
| 338 | `i18nText` | 取一条文案，并把 `{name}` 占位符换成实参。 |
| 362 | `applyTerms` | 把称谓替换应用到一句话上。 |

### `src/layout.js`
> tidy tree 布局 + 三种垂直对齐。文字宽度靠注入的 measure()，不依赖 DOM。
> 232 行 / 8545 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 13 | `ALIGN_MODES` | ALIGN_MODES 是这三个取值的唯一来源，编辑器的按钮直接由它派生，不会走偏。 |
| 20 | `CENTER_MODES` | CENTER_MODES 是这两个取值的唯一来源，编辑器的按钮直接由它派生。 |
| 40 | `wordNodes` | 哪些节点算「词」—— 全项目唯一的判定，布局标记和编辑器的「词红」按钮都从这里取。 |
| 58 | `layout` | maxRow:number,info:Map<object,object>,items:object[],options:object}} |

### `src/main.js`
> 演示页引导：例句、URL 参数。
> 174 行 / 7474 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 5 | `EXAMPLES` | — |
| 26 | `params` | index.html?lang=en                      预置界面语言：zh / en（截图和分享都用得上） |
| 28 | `initialValue` | — |
| 39 | `initialLang` | — |
| 44 | `editor` | — |
| 83 | `applyPageText` | — |
| 100 | `bindToc` | — |
| 111 | `docsEl` | — |
| 114 | `docsHtml` | 每次切换都从快照出发重算，来回切不会串味（换称谓也是同一套机制）。 |
| 124 | `docsFor` | 教程正文目前有中英两份；`DOCS_LANG` 指哪一份就渲染哪一份。 |
| 132 | `applyTermsAndLanguage` | — |
| 146 | `setTerms` | — |
| 151 | `setLang` | — |

### `src/model.js`
> 数据模型 + 所有结构操作。不依赖 DOM，是唯一真相来源。
> 407 行 / 16119 字节

术语统一用**母亲节点 / 姊妹节点 / 女儿节点**。节点结构 `{ id, label, sub, sup, arrow, children }`。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 24 | `ESCAPE_LABEL` | 转义节点的标签。记法里**裸写**它（`%Empty`，精确大小写）表示"这一层不画方框"： |
| 34 | `isEscapeLabel` | 这个标签算不算转义节点：`%Empty` 后面**可以跟任意个撇**（`%Empty'`、`%Empty''` …）。 |
| 38 | `node` | — |
| 44 | `walk` | — |
| 50 | `preorder` | — |
| 57 | `findParent` | — |
| 76 | `nodeIds` | 两套记法共用的节点编号。 |
| 86 | `addChild` | — |
| 95 | `removeNode` | — |
| 122 | `cloneSubtree` | 深拷贝一棵子树（含自己），每个节点都拿**新的 id**。 |
| 147 | `remapArrowTargets` | 把落在 map 里的箭头落点改指到对应的副本上。 |
| 159 | `primeChain` | 沿投射链往上走，返回 [n, n', n'', ...]（从下往上）。 |
| 172 | `canAddPrimeLevel` | — |
| 200 | `addPrimeLevel` | 下移（Tab）：给投射链增加一层投射层。 |
| 219 | `canCollapsePrimeLevel` | 能不能减一层投射。要求同时满足： |
| 241 | `collapsePrimeLevel` | 上移（Shift+Tab）：下移的逆。 |
| 276 | `canForceCollapseLevel` | 能不能强制上移。唯一的条件是：**选中节点不能是根节点**（必须有母亲节点可改）。 |
| 307 | `forceCollapseLevel` | 强制上移（Alt+Shift+Tab）：把"母亲节点"这一格的名字换成选中节点的名字， |
| 343 | `moveNodeLeft` | 左移（Alt+←）。两个分支，和右移对称： |
| 382 | `moveNodeRight` | 右移（Alt+→）。和左移对称： |

### `src/notation.js`
> 括号记法 ↔ 模型：词法分析、递归下降解析、序列化、文本位置映射。
> 385 行 / 13373 字节

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
| 199 | `parseValue` | — |
| 235 | `tokenText` | — |
| 247 | `parse` | — |
| 278 | `NO_SPACE_BARE` | ---------------------------------------------------------------- 序列化 |
| 294 | `needsQuote` | 判断标签能不能不加引号地写出来。三种上下文规则不同： |
| 318 | `quote` | — |
| 334 | `serialize` | 模型 -> 括号记法。 |
| 382 | `toText` | — |

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
> 409 行 / 17710 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 10 | `NS` | 命中区域。事件用委托挂在 <svg> 上，节点增删不需要重新绑定。 |
| 12 | `el` | — |
| 19 | `COLORS` | 不用颜色声明时画布上的三种颜色。词红 / 范畴蓝的色值**不在这里**，见下面的 BASELINE_FILL |
| 33 | `BASELINE_FILL` | 基线的色值：style.js 的 baselineColor() 说"这个节点该红还是该蓝"，这里说"红/蓝长什么样"。 |
| 38 | `drawTree` | — |

### `src/rules.js`
> 规则记法 ↔ 模型：一行一条「母亲节点 → 女儿节点」。
> 326 行 / 10676 字节

编号 = 行号，所以插行/删行会让下面引用错位；编辑器会自动改回去。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 39 | `RULE_WS` | — |
| 42 | `parseLabelToken` | — |
| 99 | `makeNode` | — |
| 108 | `parseLine` | — |
| 156 | `resolveMother` | 找这一行的母亲节点。 |
| 178 | `parseRules` | 规则记法 -> 模型。 |
| 256 | `tokenOf` | — |
| 274 | `serializeRules` | 模型 -> 规则记法 |
| 323 | `toRulesText` | — |

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
> 285 行 / 11666 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 54 | `COLOR_NAMES` | — |
| 67 | `COLOR_VALUES` | 颜色名 -> 实际色值。 |
| 83 | `DECL` | 字体样式声明：Italic(1, 3)、Bold(2)、Strike(4)。 |
| 90 | `COLOR_DECL` | 颜色声明：Red(1, 3)、Blue(6)。 |
| 101 | `TARGET_KEYWORDS` | 括号里的两个关键词（大小写不敏感）。它们和编号一样是"项"，可以混写： |
| 111 | `parseIds` | 括号里的项列表 -> { ids, targets }。 |
| 129 | `capitalize` | — |
| 139 | `splitStyleDecls` | 把尾部的样式声明切下来。 |
| 176 | `applyStyleDecls` | 按编号把样式打到节点上。 |
| 201 | `colorRank` | — |
| 216 | `baselineColor` | 隐式基线：没有显式颜色声明时，一个节点在画布上是什么颜色。 |
| 227 | `styleDeclsText` | 生成尾部的声明行；这棵树没有任何样式时返回空字符串。 |
| 274 | `colorItems` | 一组的括号内容：优先用关键词，用不了才列编号。 |

---

## test/ —— 测试

### `test/dom-shim.mjs`
> 最小 DOM 垫片，让编辑器能在 Node 里跑起来。
> 319 行 / 8675 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 233 | `makeEvent` | — |
| 247 | `ctx2d` | — |
| 270 | `doc` | — |
| 307 | `escapeXML` | — |
| 312 | `installDom` | — |

**类**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 8 | `ClassList` | 内联改名、快捷键、撤销重做、双向同步。视觉呈现仍需人眼确认。 |
| 40 | `El` | — |
| 296 | `XMLSerializer` | — |

**方法与字段**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 9 | `constructor` | — |
| 12 | `#list` | — |
| 15 | `#set` | — |
| 18 | `add` | — |
| 23 | `remove` | — |
| 26 | `contains` | — |
| 30 | `toggle` | — |
| 41 | `constructor` | — |
| 60 | `setAttribute` | --- 属性 |
| 63 | `getAttribute` | — |
| 98 | `appendChild` | --- 树结构 |
| 103 | `append` | — |
| 106 | `insertBefore` | — |
| 113 | `removeChild` | — |
| 119 | `remove` | — |
| 122 | `replaceChildren` | — |
| 138 | `#matchesSimple` | 在垫片里被忽略掉的，别改成抛错。 |
| 142 | `matches` | — |
| 158 | `closest` | — |
| 166 | `#descendants` | — |
| 173 | `querySelectorAll` | — |
| 177 | `querySelector` | — |
| 182 | `addEventListener` | --- 事件 |
| 186 | `removeEventListener` | — |
| 190 | `dispatchEvent` | — |
| 203 | `click` | — |
| 208 | `focus` | --- 焦点 |
| 211 | `blur` | — |
| 215 | `select` | — |
| 219 | `setSelectionRange` | — |
| 224 | `cloneNode` | — |
| 297 | `serializeToString` | — |

### `test/editor.test.mjs`
> 交互层测试（跑在 DOM 垫片上）。
> 2266 行 / 98744 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 19 | `t` | — |
| 30 | `sleep` | — |
| 32 | `mount` | — |
| 37 | `nodeGroups` | — |
| 41 | `hitRectOf` | — |
| 47 | `clickNode` | — |
| 51 | `dblClickNode` | — |
| 55 | `key` | — |
| 59 | `typeText` | — |
| 66 | `NODES_IN` | — |
| 737 | `ALIGN_TREE` | S 底下挂两棵不等深的子树，用来区分三种对齐 |
| 739 | `rowsOf` | 深度：S0 A1 B2 C3 x4 D1 E2 y3 |
| 897 | `MOVE_TREE` | 用户给的例子 |
| 898 | `AFTER_LEFT` | — |
| 899 | `AFTER_RIGHT` | — |
| 902 | `selectT` | — |
| 1035 | `fillOf` | — |
| 1042 | `declLines` | — |
| 1331 | `USER_RULES` | — |
| 1642 | `NEUTRAL` | — |
| 1643 | `FATHER` | — |
| 1760 | `ARROW_TREE` | — |

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
> 1139 行 / 50683 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 29 | `t` | — |
| 40 | `roundtrip` | — |
| 45 | `dump` | — |
| 55 | `sameTree` | — |
| 59 | `stable` | — |
| 152 | `measure` | — |
| 154 | `layoutOf` | — |
| 206 | `ALIGN_TREE` | 深度：S0 A1 B2 C3 x4 D1 E2 y3 |
| 208 | `rowsOf` | — |
| 317 | `wordsOf` | 规则：叶子 + 母亲节点的唯一的女儿节点（也就是记法里写成裸标签的那种）才算"词" |
| 386 | `MOVE_TREE` | ② 自己是最边上的女儿 -> 搬到母亲节点那一侧的姊妹底下 |
| 388 | `moveFixture` | — |
| 612 | `TREE` | 这几条用同一棵树：[S [NP Dogs] [VP barks]] —— 词是 Dogs、barks，NP / VP / S 是范畴 |
| 613 | `colorOf` | — |
| 614 | `colorMap` | — |

### `test/standalone.test.mjs`
> 单文件构建产物测试：模块没漏、内联后真的能跑。
> 143 行 / 5943 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 14 | `doc` | — |
| 19 | `t` | — |
| 30 | `HTML` | — |
| 32 | `scriptMatch` | — |
| 33 | `bundle` | — |
| 104 | `host` | — |

---

## tools/ —— 工具

### `tools/build-standalone.mjs`
> 把 7 个模块内联成那个单文件版。
> 157 行 / 6635 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 13 | `ROOT` | — |
| 16 | `OUT_NAME` | — |
| 20 | `MODULES` | 唯一会立刻跑的是 main.js，所以扁平拼接是安全的。 |
| 33 | `read` | — |
| 36 | `stripImports` | — |
| 41 | `stripExports` | — |
| 46 | `topLevelNames` | — |
| 54 | `buildBundle` | — |
| 88 | `replaceVerbatim` | 把 html 里的某个位置换成一段**原样插入**的文本。 |
| 92 | `buildHtml` | — |
| 139 | `buildStandalone` | 生成 standalone.html 的内容。 |
| 145 | `isMain` | 直接运行本文件时才写盘；被 import 时只导出函数 |

### `tools/check-project.mjs`
> 一致性自检：文档 / 文件结构 / 构建产物不许对不上。
> 219 行 / 9272 字节

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
> 50 行 / 2440 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 13 | `ROOT` | — |
| 14 | `OUT_DIR` | — |
| 17 | `CASES` | — |

### `tools/gen-structure.mjs`
> 生成这份 STRUCTURE.md。
> 184 行 / 9750 字节

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

### `tools/render-rules.mjs`
> —
> 59 行 / 2442 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 23 | `argv` | — |
| 24 | `positional` | — |
| 25 | `options` | — |
| 46 | `text` | — |
| 57 | `size` | — |

---

## screenshots/ —— 手工截图（README 用）

### `screenshots/align-compact.png`
> —

### `screenshots/align-depth.png`
> —

### `screenshots/align-leaves.png`
> —

### `screenshots/blank.png`
> —

### `screenshots/overview.png`
> —

### `screenshots/rules-gutter.png`
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
