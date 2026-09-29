# 给 AI agent 的项目说明

> 这份文件是手写的，但里面的 API 名字和行号取自源码。
> 改完代码跑 `npm.cmd test`，`tools/check-project.mjs` 会检查它有没有和源码脱节。
>
> 想要**完整的函数级行号索引**（每个文件每个函数在第几行），看 [`STRUCTURE.md`](STRUCTURE.md)。

## 这是什么

一个**零依赖、免构建**的语法树编辑器。10 个原生 ES Module（`src/`），一个构建脚本把它们
连同 CSS、示例图一起内联成 `Syntax Tree Editor Standalone.html` —— 双击即用，不联网、不起服务器。

图形和代码**双向同步**。没有框架、没有 bundler、没有 npm 依赖、没有测试框架（测试是手写的极简 runner）。

### 30 秒上手

- **唯一真相来源是模型**：节点是 `{ id, label, sub, sup, arrow, italic, bold, strike, color, children }`
  （`node()` 在 `src/model.js`）
- **图形改动会写回文本；文本改动不回写图形** —— 否则每打一个字光标就会跳
- 两套记法读写**同一棵**模型树，但**位移箭头的编号不一样**（见下面「编号体系」一节）
- **Windows 上必须用 `npm.cmd`**（PowerShell 执行策略挡住 `npm.ps1`）

---

## 一、两套记法（这是项目的核心，改之前必须看懂）

### 括号记法（默认）

```
树     := 节点+
节点   := "[" 标签 节点* "]"      非叶子节点
       |  裸标签                   叶子节点
标签   := 文字 ("_" 下标)? ("^" 上标)?     含空格/引号/_/^ 时整体用双引号包住
箭头   := 叶子 " ->" 词序号                位移箭头（词序号 = 从左到右第几个词，从 1 开始）
```

**必须知道的四点**

1. **相邻的裸标签会合并成一个多词叶子**。`[S NP VP]` 是**一个**叶子，标签是 `"NP VP"`；
   要两个叶子必须写 `[S [NP] [VP]]`。两种写法画出来一模一样，但结构含义不同。
   多词叶子渲染成**三角形**（`layout.js` 里 `triangles` 选项控制）。
2. **`[X]` 表示"没有展开的范畴"，不是「词」** —— 默认和别的节点一样是蓝色，
   「单词标红」按钮也不会给它标红。判断依据见「约定」第 6 条。
   （源码里还有一两个作者要求**不公开**的内部特性，规格记在工作区 `HANDOVER.md` 里，不在本仓库；
   读源码时遇到没见过的东西，先去看那份笔记，别照着改写。）
3. 标签里**不能有双引号**（记法没有转义），编辑器输入时自动去掉。
4. 箭头只挂在**叶子**上，而且**起点和落点都必须是叶子** —— 词序号只能定位到叶子。
   这是对齐 jsSyntaxTree 的结果，它的箭头本来就只连词。要指向非叶子只能改用规则记法。
   （箭头序号数的是**所有叶子**，与染色说的「词」口径不同；为什么这不算问题见「编号体系」一节的说明。）

### 规则记法

```
文本   := 边* 位移* 样式*              空行随便加
边     := 母亲编号 " " 母亲标签 " -> " 女儿标签
位移   := 起点编号 " --> " 落点编号
样式   := ("Italic" | "Bold" | "Strike" | 颜色名) "(" 编号 ("," 编号)* ")"
颜色名 := "Red" | "Yellow" | "Blue" | "Green" | "Orange" | "Magenta" | "Purple" | "Black" | "White"
```

**必须知道的四点**

1. **编号 = 行号**。根节点固定 0，其余节点的编号就是它第一次出现在箭头右边的那一行的行号。
   行号显示在左边装订线上（**不在文本里**，所以框选复制不会带上它）。
2. **编号写歪了也能解析**：`resolveMother()` 会退回按标签找，
   然后 `editor.js` 的 `#repairRulesNumbers()` 把行首编号改回正确值。这是有意设计的宽松。
3. 样式声明只能写在**末尾**、单独成行。两套记法都支持（括号记法写在整棵树之后）。
   五类声明形式完全一样，括号里都可以列多个编号：`Italic(1, 3)` 斜体、`Bold(2)` 粗体、
   `Strike(4)` 删除线，以及**颜色名当声明词**的颜色声明 `Red(1, 3)`、`Blue(6)`。
   导出顺序固定为 Italic → Bold → Strike → 颜色（颜色之间按 `COLOR_NAMES` 的顺序）。
   声明词**大小写不敏感**（`ITALIC(1)` 与 `italic(1)` 等效），导出统一成首字母大写。
   颜色名共九种：`red` `yellow` `blue` `green` `orange` `magenta` `purple` `black` `white`。
   色值表在 `src/style.js` 的 `COLOR_VALUES`。
   一个节点只有一个颜色，被多条颜色声明命中时**靠后的那条有效**（冗余声明不再导出）；
   九种以外的颜色名（`Chartreuse(1)`）不算声明，会被当成树的内容而报解析错误。
4. 规则记法**至少要有一条边**。孤立节点（`[X]`）在规则记法里是空的。

### 编号体系（⪯ 这里有坑，两套记法不一样）

| 用途 | 括号记法 | 规则记法 |
| --- | --- | --- |
| **位移箭头** | **词序号**：从左到右第几个词，从 1 开始（与 jsSyntaxTree 的 column number 一致） | **节点编号**：根 0，其余 = 它第一次出现在箭头右边的那一行的行号 |
| **样式声明** Italic/Bold/Strike/颜色名 | 节点编号 | 节点编号 |

**节点编号的唯一来源是 `model.js` 的 `nodeIds(root)`**（根 0，其余按"第一次作为女儿出现的顺序"）。

**词序号的唯一来源是 `notation.js` 的 `leafOrdinals(root)`**，它只在括号记法的箭头里用。

⚠️ 这两种编号**不是一回事**，不要再假设"同一个数字在两套记法里指同一个节点"。
样式声明是唯一还共用节点编号的地方。

> 作者 2026-09-18 的口径（这条解释了为什么**不需要**去"统一口径"）：
> **下标/编号系统本来就是为规则记法设计的**；括号记法里那点"词序号"只是顺带的便利，
> 所以它和「词」的染色口径（`wordNodes()`）不一致**不算问题**，不必为它改语义。
> 论据：位置性的指代只在**有行号可看**的规则记法里才真正好用 —— 规则记法的编号就是**行号**，
> 用户照着左边的装订线数就行；括号记法是一行流式文本，没有行号，
> 那里出现的任何"第 n 个"都只能是约定，说服力天然弱一档。
> 所以：括号记法的箭头序号**够用就行**（现在是与 jsSyntaxTree 的 column number 对齐），
> 教程里点到为止，别为它牺牲规则记法那套编号的自洽。
> ⚠️ 反过来说：**规则记法那边不许动** —— 行号、`#repairRulesNumbers()`、
> "编号 = 行号"这条不变量都是设计核心（见 §一 规则记法「必须知道的四点」）。

---

## 二、公共 API

### 模块导出

| 模块 | 导出 |
| --- | --- |
| `src/model.js` | `node` `walk` `preorder` `findParent` `nodeIds` `cloneSubtree` `ESCAPE_LABEL` `addChild` `removeNode` `canAddPrimeLevel` `addPrimeLevel` `canCollapsePrimeLevel` `collapsePrimeLevel` `canForceCollapseLevel` `forceCollapseLevel` `moveNodeLeft` `moveNodeRight` |
| `src/i18n.js` | `STRINGS` `LANGS` `LANG_LABELS` `TERMS` `TERM_KINDS` `TERM_LABELS` `DEFAULT_TERM` `i18nText` `applyTerms` —— 界面文案表与三套称谓用词，纯数据加两个纯函数，不依赖 DOM |
| `src/docs-en.js` | `DOCS_EN` —— 教程正文（网页底部那一篇）的英文版，整篇 HTML 一个常量；**只导出、不 import**（扁平打包会去掉 import）。改它要守三条：`doc-*` 锚点与中文版一致、`example/*.svg` 原样保留、亲属称谓用 mother/sister/daughter |
| `src/notation.js` | `parse` `serialize` `toText` `NotationError` |
| `src/rules.js` | `parseRules` `serializeRules` `toRulesText` `RuleError` |
| `src/style.js` | `COLOR_NAMES` `COLOR_VALUES` `baselineColor` `splitStyleDecls` `applyStyleDecls` `styleDeclsText` |
| `src/layout.js` | `layout` `wordNodes` `ALIGN_MODES` `CENTER_MODES` |
| `src/render.js` | `drawTree` |
| `src/main.js` | 无导出 —— 演示页的引导（例句、URL 参数、称谓切换）。**不是组件的一部分**，别往这里放逻辑 |

签名要点：

- `layout(root, measure, options)` → `{ width, height, nodeH, levelHeight, maxDepth, info, items, options }`。
  `measure(text, fontSize, fontFamily)` 由调用方注入，**所以 layout 不依赖 DOM**。
  `options.align` ∈ `ALIGN_MODES`（`depth` / `leaves` / `compact`），
  `options.center` ∈ `CENTER_MODES`（`mother` 默认 / `block`）。非法值静默退回默认。
- `drawTree(svg, lay, opts)` → `{ width, height, arrowBottoms }`。**会真的往 `svg` 里写节点**。
- `wordNodes(root)` → 按前序排列的「词」节点数组，纯结构判定，不依赖 DOM。见「约定」第 6 条。

### 一行出图：`rulesToSvg(text, options)`

想只要一张图、不要界面时用它（`src/editor.js` 导出）：文本进、SVG 字符串出。
`options.mode` 默认 `"rules"`（规则记法），传 `"bracket"` 走括号记法；其余选项直接转给编辑器。
**需要 DOM** —— 浏览器里直接可用，Node 里先 `installDom()`（`test/dom-shim.mjs`），
命令行封装见 `tools/render-rules.mjs`。给 AI 的说明文档是 [`AI-INTRO.md`](AI-INTRO.md)。

### `SyntaxTreeEditor`

```js
new SyntaxTreeEditor(elOrSelector, {
  value,          // 初始内容（括号记法）
  textMode,       // "bracket" | "rules"       默认 "bracket"
  align,          // "depth" | "leaves" | "compact"
  center,         // "mother" | "block"         默认 "mother"
  lang,           // "zh" | "en"                默认 "zh"，只影响界面文字
  fontSize, fontFamily, vscale, colors, triangles, terminalLines, showText,
  onChange,       // ({ text, rules, mode, editor }) => void
})
```

| 方法 | 作用 |
| --- | --- |
| `setValue(text)` | 用括号记法整棵替换。**清空撤销历史**（当作"打开新文档"） |
| `loadValue(text)` | 同上，但**保留撤销历史**（当作"载入示例"，Ctrl+Z 能退回原来那棵） |
| `getValue()` / `getRules()` | 导出成两套记法的文本 |
| `setRules(text)` / `setTextMode(mode)` | 切换/写入规则记法 |
| `clear()` | 清成空白画布 |
| `setOptions(partial)` | 改选项后重绘 |
| `setAlign(v)` / `setCenter(v)` / `setTerms(pairs)` / `setLanguage(lang)` / `setStyle({italic,bold,strike})` | 改对齐、水平位置、界面称谓、界面语言（`"zh"`/`"en"`）、选中节点的字体样式。**只动界面文字，对树没有任何影响** |
| `createRoot()` `addChild()` `addSibling()` `addLevel()` `collapseLevel()` `forceCollapseLevel()` `moveLeft()` `moveRight()` `remove()` `setLabel(t)` | 结构编辑，都作用于当前选中节点。`collapseLevel()`（**上移**，`Shift+Tab`）是前提很严的"减一层"；`forceCollapseLevel()`（**强制上移**，`Alt+Shift+Tab`）不看那些前提，代价是**删掉该节点的所有姊妹节点**（连同子树）—— 唯一禁用条件是"选中节点是根节点"，做完选中的是**改名后的母亲节点** |
| `markAllBlue()` `markWordsRed()` `markSelectedRed()` `markSelectedBlue()` | 颜色标记（「标色」那一行的按钮）。**不引入新的染色机制**，只是增删颜色声明。`markWordsRed()`（**单词标红**）按作者 2026-09-18 的三步走：① 删掉所有**词**的颜色声明；② 看其余节点是否都只是蓝色；③ 都是蓝 ⇒ 连那些蓝色声明一起清掉（文本只剩树那一行），否则**只**删词上的、别的颜色全留。`markAllBlue()`（**全部标蓝**）先删掉所有声明、再给每个节点写蓝色 ⇒ 只留一句 `Blue(all)`。单个那两个只增删**选中节点自己**的声明，不碰别的节点。灰掉判定与实现共用同一套判断（见 `#canCleanWordColors`），没有变化时不压撤销历史 |
| `toggleSelectedItalic()` `toggleSelectedStrike()` | 同一行右边的两个字体开关：给选中节点切换斜体 / 删除线（等价于加或删一行 `Italic(编号)` / `Strike(编号)` 声明），再按一次取消。粗体刻意没有按钮，只能用声明写 |
| `undo()` / `redo()` | 撤销 / 重做 |
| `toSvgString({background})` / `exportSvg()` / `exportPng()` | 导出 |
| 属性：`root` `selected` `lay` `size` `opts` `undoStack` `redoStack` `isEmpty` | 只读访问用 |

### ⚠️ 教程正文的术语与界面文案

界面文案（含教程正文里的亲属称谓）靠**字符串替换**切换，三套用词的表在 `src/i18n.js` 的 `TERMS`
（中文与英文各三套），由 `main.js` 的 `setTerms()` + `editor.js` 的 `setTerms()` 应用。
替换表认的就是这几个词：

`母亲节点` `姊妹节点` `女儿节点` `母亲` `姊妹` `女儿`（英文对应 mother/sister/daughter）

所以新写的教程文字**必须沿用这几个词**，否则切换到中性/父系时它们不会被替换，和周围文字不一致。
这个错误**不会报错**，只会在用户点按钮时才看出来。

另外：换称谓会重建文档 DOM，所以 `bindToc()` 每次都要重新绑定页内链接。

### 🌐 语言与文案的两条硬规矩

1. **界面文案一律从 `src/i18n.js` 的 `STRINGS` 里取**（`#t(key)` / `i18nText(lang, key)`），
   不许在 `editor.js`、`main.js`、`index.html` 里写死中文或英文。
   `check-project.mjs` 会核对中英 key 一一对应；`editor.test.mjs` 里还有一条
   "英文界面里不许出现汉字"的扫描（含 tooltip 与空白画布那条路）。
2. **文案里的亲属称谓一律先写成"母亲"那套**（中文「母亲节点/姊妹节点/女儿节点」，
   英文 `mother node / sister node / daughter node`），再由 `TERMS` 往下替换 ——
   三套说法只维护一张表。英文替换按整词边界、大小写不敏感且保留原文大小写，
   并且**英文表里不写亲属词的复数**（写 `daughter nodes`，让长词规则去变 `child nodes`）。

---

## 三、六条不能违反的约定

1. **模型是唯一真相来源，文本面板只是一个视图。** 任何时候都不许把文本当作状态。
2. **只有"图形改动"才写回文本**（`#refresh({ syncText: true })`）。
   文本输入走 `#refresh({ syncText: false })`，否则光标会被打断。
   **这是整个项目最容易搞错的地方。**
3. **所有结构改动都要经过 `#mutate()`** —— 它负责压历史快照 + 重绘。绕过它就撤销不了。
4. **撤销是文本快照**，不是操作日志。`#startEdit()` 会压一条，若标签没变则在提交时弹掉。
5. **编号有两个来源，别搞混**：节点编号一律来自 `nodeIds()`，词序号一律来自 `leafOrdinals()`。
   两者的用途见「编号体系」一节 —— 它们**不是一回事**。
6. **词默认染红、范畴默认蓝**（`drawTree` 的 `opts.redWords`，默认开）。
   ⚠️ 模型里**没有**"隐式颜色声明"这个状态：没有任何声明时节点上就是没有颜色
   （`node.color == null`）。但**文本层有一条隐式基线**，写在 `src/style.js` 的文件头：
   `Blue(all)` + `Red(words)` 两行，永远不出现在文本里，只在后台生效，
   文本里写的颜色声明按顺序排在它们后面（所以是覆盖）。基线与默认画法必须始终一致 ——
   两边的"词红、其余蓝"都从 `style.js` 的 `baselineColor()` 取（`render.js` 再用 `BASELINE_FILL` 换色值）。
   **函数式入口 `rulesToSvg()` 与命令行默认 `redWords: false`**
   （出全蓝的图）—— 作者定的：界面好看优先，机器出的图干净优先；这只改**画法**，不改基线。
   ⚠️ 基线的色值**就是颜色声明的色值**（`render.js` 的 `BASELINE_FILL` 直接取 `COLOR_VALUES`，
   而 `COLOR_VALUES.red` / `.blue` 就是原来默认画法用的 `#CC0000` / `#0000CC`），
   所以手写 `Blue(words)` 与什么都不写看起来一样，不会出现"一棵树两种蓝"；改色值只改 `COLOR_VALUES` 一处。
   「词」= 叶子节点 **且**（是母亲节点唯一的女儿节点 **或** 带位移箭头），纯结构判定，
   不认任何词类；**唯一来源是 `layout.js` 的 `wordNodes(root)`**（"单词标红"按钮与 `words` 关键词都用它）。
   ⚠️ 它和箭头用的「词序号」（`notation.js` 的 `leafOrdinals`，数**所有**叶子，
   包括 `[Y]`、`[X']` 这类空范畴）**口径不同**，别混用。
7. **颜色声明的括号里可以写两个关键词**（`style.js` 的 `TARGET_KEYWORDS`）：
   `all` = 所有节点，`words` = 所有「词」（口径就是 `wordNodes()`），可混写、可重复、大小写不敏感。
   导出时"整组 = 全部节点"写 `all`、"整组包含全部词"写 `words`（再跟上多出来的编号），其余列编号。
   ⚠️ 关键词只在**整棵树建好之后**展开，所以 `splitStyleDecls` 只负责认，`applyStyleDecls` 才展开。

---

## 四、常见改动落在哪里

| 想做什么 | 改哪里 |
| --- | --- |
| 加一个范畴按钮 | `src/editor.js` 的 `PALETTE`；要斜体就加进 `ITALIC_CHIPS` |
| 加一种垂直对齐 | `src/layout.js` 的 `ALIGN_MODES` + `assignRows()`；再补 `editor.js` 的 `ALIGN_TEXT` |
| 加一种水平位置 | `src/layout.js` 的 `CENTER_MODES` + `place()`；再补 `editor.js` 的 `CENTER_TEXT` |
| 加一种颜色 | `src/style.js` 的 `COLOR_NAMES` + `COLOR_VALUES`（两处都要加；`COLOR_NAMES` 的顺序就是导出的顺序）。颜色声明由 `COLOR_DECL` 正则从 `COLOR_NAMES` 现拼，不用另改 |
| 改键位 | `src/editor.js` 的 `#onKeyDown()` 和 `#buildDom()` 里的按钮 `key` 参数 |
| 加一种记法 | 新建一个像 `notation.js` 的模块，导出 `parse`/`serialize`，再接到 `editor.js` 的 `TEXT_MODES` |
| 改教程正文 | `index.html` 的 `<section class="card docs">`。**术语必须用「母亲节点 / 姊妹节点 / 女儿节点」**（见上方警告），且**目录锚点必须和正文 id 配对** |
| 改样式 | `style.css`（编辑器用 `.ste-` 前缀，教程用 `.docs` 前缀） |
| 加示例图 | 加进 `tools/gen-examples.mjs` 的 `CASES`，跑 `node tools/gen-examples.mjs`。**只丢 SVG 进 `example/` 不够** —— 构建靠这个模式内联 |

---

## 五、怎么验证

```cmd
cmd /c "npm test"        ← 四套测试 + 一致性自检
cmd /c "npm run build"   ← 重新生成单文件版
```

| 套件 | 负责 |
| --- | --- |
| `test/smoke.mjs` | 纯逻辑：模型、两套记法、布局、箭头。**不需要浏览器** |
| `test/rules.test.mjs` | 规则记法的解析/序列化/错误信息 |
| `test/editor.test.mjs` | 交互层，跑在 `test/dom-shim.mjs` 这个最小 DOM 垫片上 |
| `test/standalone.test.mjs` | 单文件版：模块没漏、内联后真的能跑、没有外部引用 |
| `tools/check-project.mjs` | 不变量：文档和文件结构对得上、构建产物是最新的、图片引用存在 |

**改完代码一定要 `npm run build`** —— `check-project.mjs` 会拿磁盘上的单文件版和"重新构建一遍"
的结果逐字节比对，忘了构建会直接报错。这是故意的。

### 发版流程

1. 在 `CHANGELOG.md` 顶部添加新版本一节（中英对照）
2. 改 `package.json` 的 `version` 和 `index.html` 页脚的版本号（两者保持一致）
3. `cmd /c "npm run build"` → `cmd /c "npm test"`
4. `git add .` → `git commit -m "vX.Y.Z"` → `git push`
5. 到 GitHub 的 Releases 新建 Release，tag 填 `vX.Y.Z`，把 `Syntax Tree Editor Standalone.html` 作为附件上传

> 只改版本号、**不建 tag、不发 Release** 的版本是内部开发号（`CHANGELOG.md` 里要写明"未发布"）。
> 推送前记得先开代理，Git 配了走 Clash 的本地端口。

## 六、最近实现的方法、踩过的坑、以及当前的问题

接手之前先看这一节 —— 它记的是"从代码里看不出来"的东西。

### 6.1 可复用的手法

1. **几何约束用"自由度"去满足，别去改布局。**
   内部特性的连线要求"上下共线 180°"：做法是**先走链拿到端点 → 只画一条直线 → 让分叉点落在这条直线上**。
   分叉点在直线上的**位置是自由的**，拿它去满足别的几何要求（"同侧侧枝彼此平行"、"左枝斜率 = -右枝斜率"
   这种镜像关系）—— **一次布局都不用重算**。规则在 `src/render.js` 的 `drawEscape()` 里，
   注释解释了三种退化情形（竖直的链、向右的侧枝、解落在直线之外）都退回"分叉点取本层 cx"。
2. **新规则若在常见情形下与老规则数学等价，老测试就不用改。**
   例：单层转义节点时"左枝斜率 = -右枝斜率"与"分叉点取两女儿中点"**完全等价**（同排、落差相同），
   所以换成镜像规则后，那条「分叉点在女儿正中间」的老用例照样通过 —— 这不是放宽断言，是真等价。
   定新规则前先算一下这个等价性，能省一轮回归。
3. **画布与导出可以有两份布局。** 导出时 `toSvgString()` 会按 `hideEscapes` **重算一次布局**
   （转义节点按 0 宽排版），结果放在 `exportLay` 上供调用方取坐标；画布那份 `lay` 完全不受影响。
   ⚠️ 写测试时别拿 `lay` 的坐标去对导出图里的线段。
4. **文案的三条规矩**（详见上面「🌐 语言与文案的两条硬规矩」）：一律走 `src/i18n.js`、
   亲属称谓先写"母亲"那套、英文替换按整词边界并保留原文大小写。
5. **自检是三道闸**，改完一定要 `npm test`：`check-project.mjs` 核对中英 key 一一对应、
   版本号三处一致（`package.json` / 页脚 / `CHANGELOG` 顶部）、文档与文件结构不脱节；
   `editor.test.mjs` 里有一条"英文界面里不许出现汉字"的扫描（含 tooltip 与空白画布那条路）。

### 6.2 踩过的坑（症状 → 原因 → 规矩）

| 症状 | 原因 | 规矩 |
| --- | --- | --- |
| 单文件版报 `i18nText is not defined` | 扁平打包会**整条去掉 `import`**，`import { text as i18nText }` 的别名不存在 | 跨模块的名字必须**同名**，不许用 `as`；名字要够独特（`text` 这种短名字到处都在当局部变量） |
| 几何改动"像没生效"，日志一行不打 | 把**模型节点**当有坐标用（`d.cx` / `d.y`），算出 `NaN`；而"解不出来就退回老办法"的分支把 NaN 静默吞了 | 坐标一律 `info.get(n).cx` / `.y`；判断前先排除 `NaN`；**看到"代码没生效"先怀疑 NaN** |
| 嵌套的转义节点整支连线丢失 | 递归/特判写在了"提前 `return`"**之后**，而内层那支恰好就是被提前返回的那支 | 分支多的时候，**特判顺序就是正确性**；"共线那一支"这类提前返回要放最后 |
| 单文件版测试「HTTP 提示删干净了」失败 | 那句提示的文案进了 `i18n.js`，而文案表会被内联进产物 | 测"元素在不在"，别测"某句话在不在"；文案表里的字符串必然出现在产物里 |
| 英文界面里混着中文（漏一句） | 页面静态文案忘了挂 `data-i18n` | 改完界面**开浏览器扫一眼**；`main.js` 的接管没有任何测试覆盖，只能靠肉眼 |
| `README.md` 被写坏（15191 字节 vs 正常 13031） | 用 PowerShell 的 `-replace \| Set-Content` 改文本文件 | **改文本文件只用编辑工具**；弄坏了用 `git checkout --` 回滚重做 |
| 批量截图只出一张就退出 | Edge 往 stderr 打无害日志，`$ErrorActionPreference = "Stop"` 把它当致命错误 | 跑无头浏览器时设 `Continue`，或把那一路 stderr 丢掉 |
| 截图底部被切掉 | 界面加了新控件，窗口高度没跟着加 | 界面每加一行，截图窗口高度 +50px 左右 |

### 6.3 当前的问题 / 待办

1. **教程正文中英两版都在维护中**（v1.2.3 起）：中文那份在 `index.html` 的 `<section class="card docs">`，
   英文那份是 `src/docs-en.js` 里的 `DOCS_EN` 常量。改任意一版都要**同步另一版**，
   而且 `doc-*` 锚点必须两边一致 —— `check-project.mjs` 有专门一节在比。
   位置与文件结构见 `src/docs-en.js` 顶部的注释。
2. **`screenshots/` 六张**：界面每变一次（语言切换挪到页头右上角、英文称谓改用
   Maternal / Neutral / Paternal、底部加了三个链接、工具栏多了「强制上移」）都要重拍；
   配方在 `HANDOVER.md` 第六部分。
3. **内部特性（转义节点 / `%Empty`）的规格不在本仓库** —— 作者要求不公开，规格与来龙去脉记在
   工作区 `HANDOVER.md` 第九部分 ⑤。上面 6.1 第 1 条讲的是它的**渲染手法**（不含语法）；
   本文件只留这个名字，不给语法，README / 教程 / CHANGELOG 里一个字都没有。
4. **版本号**：`package.json` 与页脚是 `1.2.5`（内部开发号，未发布）；对外最新仍是 `1.2.0`。
   三处一致性（`package.json` / 页脚 / `CHANGELOG` 顶部）由自检强制。

### 不要做的事

- **不要手改 `Syntax Tree Editor Standalone.html`** —— 它是构建产物，下次构建就没了
- **不要把 `reference/jssyntaxtree-master/`（GPL-2.0 的参考项目）拷进本项目** ——
  它本来就在仓库之外，工作区根目录的 `.gitignore` 也已排除整个 `reference/`
- 不要加第三方依赖，这个项目的卖点就是零依赖单文件
