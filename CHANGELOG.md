# 更新日志 / Changelog

版本号采用语义化版本。`v1.2.1`、`v1.2.2`、`v1.2.3`、`v1.2.4` 都是**内部开发号，没有对外发布**；对外发布的最新版本仍是 `v1.2.0`。
Version numbers follow semantic versioning. `v1.2.1`, `v1.2.2`, `v1.2.3` and `v1.2.4` are all **internal development numbers and have not been released**; the latest published version is still `v1.2.0`.

## v1.2.4（内部开发版，未发布 / internal, unreleased）

这个版本**只有一件事：颜色基线** —— 颜色声明的括号里新增 `all` / `words` 两个关键词，
并修掉「全部标蓝」点了还是红的那个 bug。

### 修复 / Fixed

- **「全部标蓝」点了之后词还是红的**：旧语义是"标蓝 = 删掉颜色声明"，而删掉之后词回到默认画法的红，
  所以那个按钮在词上等于没作用。现在"标蓝"是**写上**蓝色声明，`Blue(words)` 正好把词也刷蓝 ·
  **"All blue" left the words red**: it used to delete colour declarations, which sent words back to the
  default red, making the button a no-op for them. Both blue buttons now *write* a blue declaration, and
  `Blue(words)` is exactly what paints the words blue

### 新增 / Added

- **颜色声明支持两个关键词**：`all`（所有节点）与 `words`（所有「词」，判定与「单词标红」完全一致），
  可与编号混写、可重复、大小写不敏感（`Blue(words, 0)`、`BLUE(ALL)` 都认）·
  **Two keywords in colour declarations**: `all` (every node) and `words` (every word, the same test the
  "Words red" button uses). They mix freely with numbers, may repeat, and are case-insensitive
  (`Blue(words, 0)`, `BLUE(ALL)`)
- **文本层有了一条隐式基线**：`Blue(all)` + `Red(words)` 两行先在后台生效，用户写的声明排在它们后面，
  所以后写的覆盖先写的（这正是 `Blue(words)` = 全蓝的原因）。**基线永远不出现在文本里**，
  用户写什么就显示什么；模型没有新增任何状态（`color == null` 就是"跟着基线走"）·
  **A text-level implicit baseline**: `Blue(all)` then `Red(words)` act behind the scenes first, and any
  declarations you write come after them, so later ones win (which is why `Blue(words)` means all blue).
  The baseline never appears in the text — what you write is what you see — and the model gains no new
  state: `color == null` still means "follow the baseline"
- **导出自动挑最短写法**：整棵树同色写 `Blue(all)`，整组词同色写 `Blue(words)`（再跟上同色的其它编号），
  其余情况照旧逐列编号 ·
  **Exports pick the shortest form**: `Blue(all)` when a whole tree shares one colour, `Blue(words)` when a
  whole set of words does (plus the numbers of any same-coloured non-word nodes), a plain number list otherwise
- 教程正文与「标色」两个按钮的提示补上了新写法与基线说明（中英两版同步）·
  The tutorial and the two blue tooltips document the new forms and the baseline (both languages kept in sync)

### 改动 / Changed

- **基线的红蓝 = 声明写出来的红蓝**：默认画法不再另用一套色值，改成一**共用同一张色值表**，
  以原来基线那两个为准（`Red` = `#CC0000`、`Blue` = `#0000CC`，画布外观不变）。
  所以什么都不写（靠基线）和手写 `Blue(words)` 看起来完全一样，不会出现"一棵树两种蓝" ·
  **The baseline red and blue are now the declaration values**: the default rendering and the colour
  declarations share one table, keeping the original baseline values (`Red` = `#CC0000`,
  `Blue` = `#0000CC`; the canvas looks unchanged), so relying on the baseline and writing `Blue(words)`
  by hand look identical — never two blues in one tree
- 「全部标蓝」现在先**删掉所有颜色声明**，然后只留一句 `Blue(all)`（词也一起蓝，整棵树同一个蓝）·
  "All blue" now drops every colour declaration first and leaves a single `Blue(all)` — the whole tree is
  one blue, words included
- 「单词标红」同样是**先删掉所有颜色声明、再只写一句** `Red(words)`，所以不会再残留
  「全部标蓝」写下的那些编号声明；单个那两个按钮（节点标红 / 节点标蓝）只动选中节点自己的声明 ·
  "Words red" likewise drops every colour declaration and leaves a single `Red(words)`, so the number
  declarations written by "All blue" no longer linger. The two single-node buttons keep touching only the
  selected node's own declaration
- 「节点标蓝」从"删掉该节点的颜色声明"改成"给该节点写上蓝色声明"；四个按钮的灰掉判定改用
  **蓝色声明**（靠基线蓝但没有声明的节点仍然可点 —— 点一下确实会改变文本）· "Node blue" now writes a
  blue declaration instead of deleting one, and the four buttons grey out from the **blue declaration**
  (a node that is blue only by the baseline can still be clicked, because clicking does change the text)
- 基线与默认画法的"词红、其余蓝"现在**只有一个来源**（`style.js` 的 `baselineColor()` 决定"该红还是该蓝"、
  `COLOR_VALUES` 决定色值），渲染、按钮判定与测试都从这里取 ·
  The baseline and the default rendering now share a single source (`baselineColor()` in `style.js` decides
  red-or-blue, `COLOR_VALUES` supplies the value), used by the renderer, the button logic and the tests
- `screenshots/` 六张**不用重拍**（默认画布的颜色回到原样）·
  The six screenshots needed no retake (the default canvas keeps its original colours)

## v1.2.3（内部开发版，未发布 / internal, unreleased）

这个版本**只有一件事：把教程正文翻译成英文**，语言切换从此覆盖整个页面。

### 新增 / Added

- **教程正文（网页底部「使用方法」那一篇）的英文版**，整篇放在 `src/docs-en.js`（一个 HTML 常量）；
  切到英文时界面与正文一起变，切回中文一并复原 · **English version of the tutorial body**, kept as a single HTML constant in `src/docs-en.js`; switching to English translates both the UI and the tutorial
- 自检新增一条：中英两版教程的 `doc-*` 锚点必须一一对应，且各自的目录锚点都要能对上 ·
  A new self-check: both tutorial versions must carry the same `doc-*` anchors, and each version's table of contents must resolve

### 改动 / Changed

- 教程正文改用"按语言整体替换 innerHTML"的方式切换（和原有的「称谓」切换是同一套机制），
  换完重新绑定目录；正文的称谓替换表**按正文自己的语言**取 ·
  The tutorial now swaps wholesale per language (the same mechanism the term switch already used), re-binding the table of contents afterwards; the term table is chosen by the tutorial's own language
- `v1.2.2` 里那条「教程正文尚未翻译」的已知限制**已解除** ·
  The “tutorial not translated yet” limitation noted under v1.2.2 is now resolved

## v1.2.2（内部开发版，未发布 / internal, unreleased）

这个版本**只有一件事：界面语言切换（中文 / English）**。

### 新增 / Added

- **界面语言切换**：演示页顶部新增「语言」一行（中文 / English），编辑器也支持 `setLanguage("zh" | "en")` 与 `lang` 选项；界面文案全部走 `src/i18n.js` 的文案表（85 条 key，中英一一对应，自检会核对）· **UI language switch**: a new "Language" row on the demo page (中文 / English), plus `setLanguage("zh" | "en")` and a `lang` option on the editor. Every UI string now comes from the table in `src/i18n.js` (85 keys, one-to-one between the two languages, checked by the self-test)
- **称谓与语言正确叠加**：文案先按语言取、再套称谓；中文三套（母系 / 中性 / 父系）与英文三套（mother / neutral / father）各自地道 —— 英文用 mother node / sister node / daughter node、parent / sibling / child、father / brother / child · **Terms and language compose correctly**: text is picked by language first, then the term set is applied. Chinese keeps its three sets and English gets its own idiomatic three: mother node / sister node / daughter node, parent / sibling / child, father / brother / child
- 组件选项 `lang`、方法 `setLanguage()`、演示页的 `?lang=en` 预置 · The `lang` option, the `setLanguage()` method, and `?lang=en` on the demo page
- 英文替换按**整词边界**、大小写不敏感且保留原文大小写（按钮 `＋ Sister` 与说明里的 `a sister node` 各自正确）· English term replacement is word-bounded, case-insensitive and keeps the original capitalisation

### 已知限制 / Known limitations

- **教程正文（网页底部「使用方法」那一整篇）还没有英文版**：切到英文时界面全变英文，但这一篇仍是中文。英文版会随后续版本补上，届时 `main.js` 的 `DOCS_LANG` 改成跟着界面语言走即可 · **The tutorial body is not translated yet**: switching to English translates the whole UI, but the "Instructions" section at the bottom stays Chinese. The English version will follow in a later release; wiring it up only means letting `DOCS_LANG` in `main.js` follow the UI language.

## v1.2.1（内部开发版，未发布 / internal, unreleased）

### 新增 / Added

- 颜色声明 `Red(1, 3)`，与 `Italic(1, 3)` 写法一致，共九种颜色；一个节点一个颜色，被多条声明命中时以靠后的为准 · Colour declarations `Red(1, 3)` in the same shape as `Italic(1, 3)`, with nine colours; one colour per node, the later declaration wins
- 「标色」一行的按钮：全部标蓝、单词标红、节点标红、节点标蓝 · A "标色" row of buttons: all blue, words red, node red, node blue
- 同一行的「节点斜体」「节点删除线」开关：只作用于选中节点，按一下加上、再按一下取消（粗体不提供按钮）· "节点斜体" / "节点删除线" toggles on the same row, applying to the selected node only; bold has no button
- 删除线声明 `Strike(N)` · Strikethrough declaration `Strike(N)`
- 给 AI / 脚本的入口：`rulesToSvg(text)`（文本进、SVG 字符串出）与命令行 `node tools/render-rules.mjs 树.txt 树.svg`；配套说明文档 `AI-INTRO.md` · An entry point for AI and scripts: `rulesToSvg(text)` (text in, SVG string out) and the CLI `node tools/render-rules.mjs tree.txt tree.svg`, documented in `AI-INTRO.md`
- 称谓切换补齐三处遗漏（水平位置按钮、空白画布提示、垂直对齐的说明文字）· Three omissions in term switching fixed (horizontal-position button, blank-canvas hint, vertical-alignment tooltip)

### 改动 / Changed

- 默认画法：编辑器画布上词染红、范畴用蓝（`redWords` 选项，默认开）；函数式入口 `rulesToSvg()` 与命令行默认全蓝。模型里没有隐式颜色声明 · Default rendering: words red and categories blue on the editor canvas (the `redWords` option, on by default), while the functional entry point and the CLI default to all blue; the model still carries no implicit colour declarations
- 括号记法的位移箭头 `->N` 改用**词序号**（与 jsSyntaxTree 的 column number 一致）；规则记法的 `-->N` 仍用节点编号 · Bracket-notation arrows now take a **word ordinal** (matching jsSyntaxTree's column number), while rule-notation arrows keep node numbers
- 下移改为给投射链顶端套一层自己的副本：整棵子树原样下沉一层，链顶其余的女儿节点不再被提到新层；上移按同一套语义调整 · Move-down now wraps the top of the projection chain in a copy of itself, so the whole subtree sinks one level and other daughters are no longer lifted; move-up follows the same semantics
- 声明词一律**大小写不敏感**（`ITALIC(1)` 与 `italic(1)` 等效，以前只有颜色名不敏感），导出统一成首字母大写 · Declaration words are case-insensitive (`ITALIC(1)` equals `italic(1)`; previously only colour names were), exported capitalised
- 「标色」那一行改用方角小按钮，和下面的范畴快捷标签区分开；按钮分成「整树」与「单个节点」两组 · The "标色" row now uses square buttons, deliberately unlike the category chips below it, grouped into whole-tree and single-node pairs
- 九种以外的颜色名不再被静默忽略，而是报解析错误 · Colour names outside the nine are now a parse error instead of being silently ignored

### 修复 / Fixed

- 连续按 Tab 时选中框停在原地（现在跟着被选中节点的副本走，每次往下走一层）· The selection box stayed put when Tab was pressed repeatedly; it now follows the copy of the selected node, one level down each time
- `setStyle({ strike })` 参数文档里写了、代码里没有实现 · `setStyle({ strike })` was documented but not implemented
- 构建脚本以字符串形式做替换，`String.replace` 的 `$` 记号会把整页 HTML 注入脚本，产物变成语法错误 · The build script used string replacement, and `String.replace`'s `$` patterns injected the whole page into the script, turning the build output into a syntax error
- 教程「注意事项」列表的 `<ul>` 被 `</ol>` 关闭 · The tutorial's notes list closed a `<ul>` with `</ol>`

### 文档与资源 / Docs and assets

- 教程第 4 节（下移）、第 5 节（上移）、第 7 节（字体与颜色）与「注意事项」按新行为重写 · Tutorial sections 4 (move down), 5 (move up), 7 (fonts and colours) and the notes list rewritten
- 六张截图重拍，示例图全部重新生成 · Six screenshots retaken and every example figure regenerated
- 测试套件扩充：下移 / 上移、颜色声明、副本 id 与箭头落点等用例 · Test suite expanded with cases for move down / up, colour declarations, copy ids and arrow targets

## v1.2.0（2026-09-15 发布 / released）

- 首个公开发布版：两套记法（括号 / 规则）双向同步、三种垂直对齐与两种水平位置、方向键选中、下移 / 上移 / 左移 / 右移 / 增删节点、位移箭头、斜体标注、多词叶子绘制成三角形、导出 SVG 与两倍 PNG、完整撤销重做 · First public release: two notations (bracket / rule) kept in sync, three vertical alignments and two horizontal positions, arrow-key selection, move down / up / left / right, adding and deleting nodes, movement arrows, italic labels, multi-word leaves drawn as triangles, SVG and 2x PNG export, full undo and redo
