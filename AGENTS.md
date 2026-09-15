# 给 AI agent 的项目说明

> 这份文件是手写的，但里面的 API 名字和行号取自源码。
> 改完代码跑 `npm.cmd test`，`tools/check-project.mjs` 会检查它有没有和源码脱节。
>
> 想要**完整的函数级行号索引**（每个文件每个函数在第几行），看 [`STRUCTURE.md`](STRUCTURE.md)。

## 这是什么

一个**零依赖、免构建**的语法树编辑器。8 个原生 ES Module（`src/`），一个构建脚本把它们
连同 CSS、示例图一起内联成 `Syntax Tree Editor Standalone.html` —— 双击即用，不联网、不起服务器。

图形和代码**双向同步**。没有框架、没有 bundler、没有 npm 依赖、没有测试框架（测试是手写的极简 runner）。

### 30 秒上手

- **唯一真相来源是模型**：节点是 `{ id, label, sub, sup, arrow, italic, bold, children }`
  （`node()` 在 `src/model.js`）
- **图形改动会写回文本；文本改动不回写图形** —— 否则每打一个字光标就会跳
- 两套记法读写**同一棵**模型树，位移箭头的编号也是**同一套**
- **Windows 上必须用 `npm.cmd`**（PowerShell 执行策略挡住 `npm.ps1`）

---

## 一、两套记法（这是项目的核心，改之前必须看懂）

### 括号记法（默认）

```
树     := 节点+
节点   := "[" 标签 节点* "]"      非叶子节点
       |  裸标签                   叶子节点
标签   := 文字 ("_" 下标)? ("^" 上标)?     含空格/引号/_/^ 时整体用双引号包住
箭头   := 叶子 " ->" 编号                  位移箭头
```

**必须知道的四点**

1. **相邻的裸标签会合并成一个多词叶子**。`[S NP VP]` 是**一个**叶子，标签是 `"NP VP"`；
   要两个叶子必须写 `[S [NP] [VP]]`。两种写法画出来一模一样，但结构含义不同。
   多词叶子渲染成**三角形**（`layout.js` 里 `triangles` 选项控制）。
2. **`[X]` 不是叶子** —— 它是"没有展开的范畴"，画成蓝色，且**不染红**。
3. 标签里**不能有双引号**（记法没有转义），编辑器输入时自动去掉。
4. 箭头只挂在**叶子**上。起点必须是叶子，落点可以是任何节点（含根，写 `->0`）。

### 规则记法

```
文本   := 边* 位移* 样式*              空行随便加
边     := 母亲编号 " " 母亲标签 " -> " 女儿标签
位移   := 起点编号 " --> " 落点编号
样式   := ("Italic" | "Bold") "(" 编号 ("," 编号)* ")"
```

**必须知道的四点**

1. **编号 = 行号**。根节点固定 0，其余节点的编号就是它第一次出现在箭头右边的那一行的行号。
   行号显示在左边装订线上（**不在文本里**，所以框选复制不会带上它）。
2. **编号写歪了也能解析**：`resolveMother()` 会退回按标签找，
   然后 `editor.js` 的 `#repairRulesNumbers()` 把行首编号改回正确值。这是有意设计的宽松。
3. 样式声明只能写在**末尾**、单独成行。两套记法都支持（括号记法写在整棵树之后）。
4. 规则记法**至少要有一条边**。孤立节点（`[X]`）在规则记法里是空的。

### 共用的编号

`model.js` 的 `nodeIds(root)` 是**唯一**的编号来源：根 0，其余按"第一次作为女儿出现的顺序"。
规则记法的行号、括号记法的 `->N`、`Italic(N)` 全都用它，所以三处的 N 指的是同一个节点。

---

## 二、公共 API

### 模块导出

| 模块 | 导出 |
| --- | --- |
| `src/model.js` | `node` `walk` `preorder` `findParent` `nodeIds` `addChild` `removeNode` `canAddPrimeLevel` `addPrimeLevel` `canCollapsePrimeLevel` `collapsePrimeLevel` `moveNodeLeft` `moveNodeRight` |
| `src/notation.js` | `parse` `serialize` `toText` `NotationError` |
| `src/rules.js` | `parseRules` `serializeRules` `toRulesText` `RuleError` |
| `src/style.js` | `splitStyleDecls` `applyStyleDecls` `styleDeclsText` |
| `src/layout.js` | `layout` `ALIGN_MODES` `CENTER_MODES` |
| `src/render.js` | `drawTree` |
| `src/main.js` | 无导出 —— 演示页的引导（例句、URL 参数、称谓切换）。**不是组件的一部分**，别往这里放逻辑 |

签名要点：

- `layout(root, measure, options)` → `{ width, height, nodeH, levelHeight, maxDepth, info, items, options }`。
  `measure(text, fontSize, fontFamily)` 由调用方注入，**所以 layout 不依赖 DOM**。
  `options.align` ∈ `ALIGN_MODES`（`depth` / `leaves` / `compact`），
  `options.center` ∈ `CENTER_MODES`（`mother` 默认 / `block`）。非法值静默退回默认。
- `drawTree(svg, lay, opts)` → `{ width, height, arrowBottoms }`。**会真的往 `svg` 里写节点**。

### `SyntaxTreeEditor`

```js
new SyntaxTreeEditor(elOrSelector, {
  value,          // 初始内容（括号记法）
  textMode,       // "bracket" | "rules"       默认 "bracket"
  align,          // "depth" | "leaves" | "compact"
  center,         // "mother" | "block"         默认 "mother"
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
| `setAlign(v)` / `setCenter(v)` / `setTerms(pairs)` / `setStyle({italic,bold})` | 改对齐、水平位置、界面称谓、选中节点的字体样式 |
| `createRoot()` `addChild()` `addSibling()` `addLevel()` `collapseLevel()` `moveLeft()` `moveRight()` `remove()` `setLabel(t)` | 结构编辑，都作用于当前选中节点 |
| `undo()` / `redo()` | 撤销 / 重做 |
| `toSvgString({background})` / `exportSvg()` / `exportPng()` | 导出 |
| 属性：`root` `selected` `lay` `size` `opts` `undoStack` `redoStack` `isEmpty` | 只读访问用 |

### ⚠️ 教程正文的术语不能随便写

网页顶部的「称谓」切换（母系 / 中性 / 父系）是靠**对教程正文做全局字符串替换**实现的
（`src/main.js` 的 `TERM_SETS` + `editor.js` 的 `setTerms()`）。替换表只认这几个词：

`母亲节点` `姊妹节点` `女儿节点` `母亲` `姊妹` `女儿`

所以新写的教程文字**必须沿用这几个词**，否则切换到父系时它们不会被替换，和周围文字不一致。
这个错误**不会报错**，只会在用户点按钮时才看出来。

另外：换称谓会重建文档 DOM，所以 `bindToc()` 每次都要重新绑定页内链接。

---

## 三、六条不能违反的约定

1. **模型是唯一真相来源，文本面板只是一个视图。** 任何时候都不许把文本当作状态。
2. **只有"图形改动"才写回文本**（`#refresh({ syncText: true })`）。
   文本输入走 `#refresh({ syncText: false })`，否则光标会被打断。
   **这是整个项目最容易搞错的地方。**
3. **所有结构改动都要经过 `#mutate()`** —— 它负责压历史快照 + 重绘。绕过它就撤销不了。
4. **撤销是文本快照**，不是操作日志。`#startEdit()` 会压一条，若标签没变则在提交时弹掉。
5. **共用编号只有一个来源**：`nodeIds()`。任何地方自己数编号都会和另一套记法对不上。
6. **要染红的"词"** = 叶子节点 **且** （是母亲节点唯一的女儿节点 **或** 带位移箭头）。
   纯结构判定，不认任何词类。

---

## 四、常见改动落在哪里

| 想做什么 | 改哪里 |
| --- | --- |
| 加一个范畴按钮 | `src/editor.js` 的 `PALETTE`；要斜体就加进 `ITALIC_CHIPS` |
| 加一种垂直对齐 | `src/layout.js` 的 `ALIGN_MODES` + `assignRows()`；再补 `editor.js` 的 `ALIGN_TEXT` |
| 加一种水平位置 | `src/layout.js` 的 `CENTER_MODES` + `place()`；再补 `editor.js` 的 `CENTER_TEXT` |
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

1. 改 `package.json` 的 `version` 和 `index.html` 页脚的版本号
2. `cmd /c "npm run build"` → `cmd /c "npm test"`
3. `git add .` → `git commit -m "vX.Y.Z"` → `git push`
4. 到 GitHub 的 Releases 新建 Release，tag 填 `vX.Y.Z`，把 `Syntax Tree Editor Standalone.html` 作为附件上传

> 推送前记得先开代理，Git 配了走 Clash 的本地端口。

### 不要做的事

- **不要手改 `Syntax Tree Editor Standalone.html`** —— 它是构建产物，下次构建就没了
- **不要把 `jssyntaxtree-master/`（GPL-2.0 的参考项目）提交进仓库** —— 根目录 `.gitignore` 已排除
- 不要加第三方依赖，这个项目的卖点就是零依赖单文件
