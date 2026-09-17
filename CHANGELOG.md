# 更新日志 / Changelog

版本号采用语义化版本。`v1.2.1` 是**内部开发号，没有对外发布**；对外发布的最新版本仍是 `v1.2.0`。
Version numbers follow semantic versioning. `v1.2.1` is an **internal development number and has not been released**; the latest published version is still `v1.2.0`.

## v1.2.1（内部开发版，未发布 / internal, unreleased）

### 新增 / Added

- 颜色声明 `Red(1, 3)`，与 `Italic(1, 3)` 写法一致，共九种颜色；一个节点一个颜色，被多条声明命中时以靠后的为准 · Colour declarations `Red(1, 3)` in the same shape as `Italic(1, 3)`, with nine colours; one colour per node, the later declaration wins
- 「标色」一行的按钮：全部标蓝、单词标红、节点标红、节点标蓝 · A "标色" row of buttons: all blue, words red, node red, node blue
- 同一行的「节点斜体」「节点删除线」开关：只作用于选中节点，按一下加上、再按一下取消（粗体不提供按钮）· "节点斜体" / "节点删除线" toggles on the same row, applying to the selected node only; bold has no button
- 删除线声明 `Strike(N)` · Strikethrough declaration `Strike(N)`
- 给 AI / 脚本的入口：`rulesToSvg(text)`（文本进、SVG 字符串出）与命令行 `node tools/render-rules.mjs 树.txt 树.svg`；配套说明文档 `AI-INTRO.md` · An entry point for AI and scripts: `rulesToSvg(text)` (text in, SVG string out) and the CLI `node tools/render-rules.mjs tree.txt tree.svg`, documented in `AI-INTRO.md`
- 称谓切换补齐三处遗漏（水平位置按钮、空白画布提示、垂直对齐的说明文字）· Three omissions in term switching fixed (horizontal-position button, blank-canvas hint, vertical-alignment tooltip)

### 改动 / Changed

- 整棵树默认绘制成蓝色，「只有词才染红」的自动判定取消；红色等颜色只能来自声明 · The tree is blue by default and the automatic "only words are red" rule is gone, so colour comes from declarations only
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
