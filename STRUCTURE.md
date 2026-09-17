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
> 1659 行 / 59435 字节

私有方法以 `#` 开头，只在类内部使用。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 32 | `SVG_NS` | — |
| 37 | `PALETTE` | 最后是斜体的小 v 和 pro（习惯上这两个词类用斜体写）。 |
| 46 | `ITALIC_CHIPS` | — |
| 49 | `TIPS` | — |
| 51 | `HINT` | — |
| 58 | `ALIGN_TEXT` | 所以不可能出现"布局支持某个模式、界面上却没有按钮"的情况。 |
| 63 | `ALIGN_CHOICES` | — |
| 66 | `CENTER_TEXT` | 水平位置：两种模式，说明见 layout.js 的 CENTER_MODES |
| 70 | `CENTER_CHOICES` | — |
| 73 | `TEXT_MODES` | 两套等价的记法，随时可切换 |
| 78 | `TEXT_DEBOUNCE` | — |
| 80 | `makeMeasurer` | — |
| 95 | `download` | — |
| 105 | `stripUnsupported` | — |
| 111 | `offsetToLineCol` | — |
| 124 | `lineColToOffset` | — |
| 150 | `rulesToSvg` | 一行出图：**文本 → SVG 字符串**，不需要页面上先有一个编辑器实例。 |
| 1651 | `countSubtree` | — |

**类**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 162 | `SyntaxTreeEditor` | — |

**方法与字段**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 163 | `constructor` | — |
| 224 | `setValue` | 用括号记法设置整棵树。 |
| 238 | `setStyle` | 设置选中节点的字体样式。italic / bold / strike 会写进记法末尾的 |
| 257 | `markAllBlue` | — |
| 268 | `markWordsRed` | — |
| 279 | `markSelectedRed` | — |
| 289 | `markSelectedBlue` | — |
| 302 | `toggleSelectedItalic` | 节点斜体：切换选中节点的斜体（再点一次取消）。 |
| 310 | `toggleSelectedStrike` | — |
| 318 | `getValue` | — |
| 326 | `loadValue` | 载入一棵新树，但**保留撤销历史** —— 按 Ctrl+Z 可以退回载入之前的那棵树。 |
| 340 | `clear` | — |
| 345 | `setOptions` | — |
| 351 | `toSvgString` | — |
| 383 | `exportSvg` | — |
| 387 | `exportPng` | — |
| 413 | `#buildDom` | ------------------------------------------------------------ DOM 骨架 |
| 750 | `#reindex` | ------------------------------------------------------------ 渲染管线 |
| 758 | `#drawOptions` | drawTree 的选项。画布和导出共用这一份 —— 导出多传一个 `hideEscapes: true`， |
| 770 | `#relayout` | — |
| 808 | `#refresh` | — |
| 820 | `#serializeCurrent` | — |
| 825 | `#parseCurrent` | — |
| 829 | `#syncTextModeButtons` | — |
| 838 | `setTextMode` | — |
| 853 | `#buildCodeBox` | 代码框 = 左边一条装订线（行号）+ 右边真正的 textarea。 |
| 880 | `#syncGutter` | 按当前文本刷新装订线。 |
| 894 | `#syncGutterScroll` | — |
| 906 | `#repairRulesNumbers` | 规则记法里"编号就是行号"，所以在上面插一行、删一行都会让下面所有引用错位。 |
| 954 | `#syncTextareaSize` | — |
| 959 | `getRules` | — |
| 964 | `setRules` | — |
| 973 | `#syncCenterButtons` | — |
| 982 | `setCenter` | — |
| 989 | `#syncAlignButtons` | — |
| 1001 | `#syncStyleButtons` | 斜体 / 删除线那两个按钮是开关，所以要反映选中节点的当前状态。 |
| 1009 | `setAlign` | — |
| 1016 | `#writeText` | — |
| 1023 | `#emitChange` | — |
| 1034 | `#updateStatus` | — |
| 1095 | `#showError` | — |
| 1104 | `#clearError` | — |
| 1116 | `#select` | 切换选中态。 |
| 1132 | `#snapshot` | ------------------------------------------------------------ 历史 |
| 1140 | `#pushUndo` | — |
| 1147 | `#restore` | — |
| 1159 | `undo` | — |
| 1165 | `redo` | — |
| 1171 | `#mutate` | — |
| 1184 | `createRoot` | 在空白画布上创建根节点，并直接进入改名状态。 |
| 1202 | `addChild` | — |
| 1220 | `addSibling` | — |
| 1245 | `addLevel` | 下移（Tab）：给投射链增加一层投射层（详见 model.js 的 addPrimeLevel）。 |
| 1266 | `collapseLevel` | 上移（Shift+Tab）：下移的逆。要求母亲节点只有自己这一个女儿节点、 |
| 1276 | `#canMoveLeft` | — |
| 1288 | `#canMoveRight` | — |
| 1303 | `moveLeft` | 左移（Alt+← / Ctrl+←）：自己是最左边的女儿节点时，搬到母亲节点的左姊妹节点底下。 |
| 1311 | `moveRight` | 右移（Alt+→ / Ctrl+→）：自己是最右边的女儿节点时，搬到母亲节点的右姊妹节点底下。 |
| 1322 | `remove` | 删除选中的节点。 |
| 1363 | `#setNodeLabel` | 改标签（并且同步转义标记）。规则只有一条：标签**正好**是 %Empty 就是转义节点， |
| 1369 | `setLabel` | — |
| 1384 | `#startEdit` | ------------------------------------------------------------ 内联改名 |
| 1398 | `#positionEditor` | — |
| 1417 | `#commitEdit` | 提交改名。 |
| 1427 | `#cancelEdit` | — |
| 1441 | `#onCanvasDown` | ------------------------------------------------------------ 事件 |
| 1454 | `#onCanvasDblClick` | — |
| 1465 | `setTerms` | 换一套亲属称谓。**只改界面上的文字**（按钮名、提示行、装订线说明）， |
| 1472 | `#t` | — |
| 1478 | `#term` | — |
| 1483 | `#onKeyDown` | — |
| 1585 | `#onTextInput` | ------------------------------------------------------------ 文本面板 |
| 1615 | `#selectFromCaret` | — |
| 1637 | `#selectByOffset` | — |

### `src/layout.js`
> tidy tree 布局 + 三种垂直对齐。文字宽度靠注入的 measure()，不依赖 DOM。
> 228 行 / 8207 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 13 | `ALIGN_MODES` | ALIGN_MODES 是这三个取值的唯一来源，编辑器的按钮直接由它派生，不会走偏。 |
| 20 | `CENTER_MODES` | CENTER_MODES 是这两个取值的唯一来源，编辑器的按钮直接由它派生。 |
| 40 | `wordNodes` | 哪些节点算「词」—— 全项目唯一的判定，布局标记和编辑器的「词红」按钮都从这里取。 |
| 58 | `layout` | maxRow:number,info:Map<object,object>,items:object[],options:object}} |

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
> 335 行 / 13036 字节

术语统一用**母亲节点 / 姊妹节点 / 女儿节点**。节点结构 `{ id, label, sub, sup, arrow, children }`。

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 24 | `ESCAPE_LABEL` | 转义节点的标签。记法里**裸写**它（`%Empty`，精确大小写）表示"这一层不画方框"： |
| 26 | `node` | — |
| 32 | `walk` | — |
| 38 | `preorder` | — |
| 45 | `findParent` | — |
| 64 | `nodeIds` | 两套记法共用的节点编号。 |
| 74 | `addChild` | — |
| 83 | `removeNode` | — |
| 110 | `cloneSubtree` | 深拷贝一棵子树（含自己），每个节点都拿**新的 id**。 |
| 135 | `remapArrowTargets` | 把落在 map 里的箭头落点改指到对应的副本上。 |
| 147 | `primeChain` | 沿投射链往上走，返回 [n, n', n'', ...]（从下往上）。 |
| 160 | `canAddPrimeLevel` | — |
| 188 | `addPrimeLevel` | 下移（Tab）：给投射链增加一层投射层。 |
| 207 | `canCollapsePrimeLevel` | 能不能减一层投射。要求同时满足： |
| 229 | `collapsePrimeLevel` | 上移（Shift+Tab）：下移的逆。 |
| 271 | `moveNodeLeft` | 左移（Alt+←）。两个分支，和右移对称： |
| 310 | `moveNodeRight` | 右移（Alt+→）。和左移对称： |

### `src/notation.js`
> 括号记法 ↔ 模型：词法分析、递归下降解析、序列化、文本位置映射。
> 384 行 / 13292 字节

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
| 198 | `parseValue` | — |
| 234 | `tokenText` | — |
| 246 | `parse` | — |
| 277 | `NO_SPACE_BARE` | ---------------------------------------------------------------- 序列化 |
| 293 | `needsQuote` | 判断标签能不能不加引号地写出来。三种上下文规则不同： |
| 317 | `quote` | — |
| 333 | `serialize` | 模型 -> 括号记法。 |
| 381 | `toText` | — |

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
> 286 行 / 10726 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 10 | `NS` | 命中区域。事件用委托挂在 <svg> 上，节点增删不需要重新绑定。 |
| 12 | `el` | — |
| 18 | `COLORS` | — |
| 28 | `drawTree` | — |

### `src/rules.js`
> 规则记法 ↔ 模型：一行一条「母亲节点 → 女儿节点」。
> 325 行 / 10598 字节

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
| 273 | `serializeRules` | 模型 -> 规则记法 |
| 322 | `toRulesText` | — |

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
> 171 行 / 6115 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 35 | `COLOR_NAMES` | — |
| 44 | `COLOR_VALUES` | 颜色名 -> 实际色值。 |
| 60 | `DECL` | 字体样式声明：Italic(1, 3)、Bold(2)、Strike(4)。 |
| 67 | `COLOR_DECL` | 颜色声明：Red(1, 3)、Blue(6)。 |
| 70 | `parseIds` | — |
| 80 | `capitalize` | — |
| 89 | `splitStyleDecls` | 把尾部的样式声明切下来。 |
| 121 | `applyStyleDecls` | 按编号把样式打到节点上。 |
| 139 | `colorRank` | — |
| 145 | `styleDeclsText` | — |

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
> 1808 行 / 73489 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 17 | `t` | — |
| 28 | `sleep` | — |
| 30 | `mount` | — |
| 35 | `nodeGroups` | — |
| 39 | `hitRectOf` | — |
| 45 | `clickNode` | — |
| 49 | `dblClickNode` | — |
| 53 | `key` | — |
| 57 | `typeText` | — |
| 64 | `NODES_IN` | — |
| 694 | `ALIGN_TREE` | S 底下挂两棵不等深的子树，用来区分三种对齐 |
| 696 | `rowsOf` | 深度：S0 A1 B2 C3 x4 D1 E2 y3 |
| 854 | `MOVE_TREE` | 用户给的例子 |
| 855 | `AFTER_LEFT` | — |
| 856 | `AFTER_RIGHT` | — |
| 859 | `selectT` | — |
| 992 | `fillOf` | — |
| 999 | `declLines` | — |
| 1138 | `USER_RULES` | — |
| 1446 | `NEUTRAL` | — |
| 1447 | `FATHER` | — |
| 1564 | `ARROW_TREE` | — |

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
> 926 行 / 39348 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 27 | `t` | — |
| 38 | `roundtrip` | — |
| 43 | `dump` | — |
| 53 | `sameTree` | — |
| 57 | `stable` | — |
| 150 | `measure` | — |
| 152 | `layoutOf` | — |
| 204 | `ALIGN_TREE` | 深度：S0 A1 B2 C3 x4 D1 E2 y3 |
| 206 | `rowsOf` | — |
| 315 | `wordsOf` | 规则：叶子 + 母亲节点的唯一的女儿节点（也就是记法里写成裸标签的那种）才算"词" |
| 384 | `MOVE_TREE` | ② 自己是最边上的女儿 -> 搬到母亲节点那一侧的姊妹底下 |
| 386 | `moveFixture` | — |

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
> 154 行 / 6371 字节

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
| 86 | `replaceVerbatim` | 把 html 里的某个位置换成一段**原样插入**的文本。 |
| 90 | `buildHtml` | — |
| 136 | `buildStandalone` | 生成 standalone.html 的内容。 |
| 142 | `isMain` | 直接运行本文件时才写盘；被 import 时只导出函数 |

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
> 48 行 / 2274 字节

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

### `tools/render-rules.mjs`
> —
> 57 行 / 2279 字节

**函数**

| 行 | 名称 | 说明 |
| --- | --- | --- |
| 22 | `argv` | — |
| 23 | `positional` | — |
| 24 | `options` | — |
| 44 | `text` | — |
| 55 | `size` | — |

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
