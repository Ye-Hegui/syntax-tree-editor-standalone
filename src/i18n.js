/**
 * 界面文案表 + 「称谓」用词表。
 *
 * 两条规矩：
 *
 * 1. **文案一律以 key 取用**（`STRINGS[lang][key]`），键名两边完全一致 ——
 *    缺一条就会在另一种语言下露出另一种语言，所以两边必须同增同减
 *    （`tools/check-project.mjs` 会核对两边键集合相同）。
 * 2. **文案里的亲属称谓一律写"母亲"那套**（中文写母亲节点/姊妹节点/女儿节点，
 *    英文写 mother node / sister node / daughter node），再由 `TERMS` 往下换。
 *    也就是说"母系"是基准写法，中性/父系都是替换出来的 —— 这样三套说法只要维护一张表。
 *
 * ⚠️ 替换是**按整词从长到短**做的（`editor.js` 的 `#t()`），所以：
 *   - 同一套里长词必须排在短词前面（"女儿节点" 在 "女儿" 之前）；
 *   - 英文按整词边界替换，避免误伤（例如 "child" 不会命中 "childrenhood" 之类）。
 */

export const LANGS = ["zh", "en"];

/** 语言按钮上的名字（用各语言自己的写法，不翻译） */
export const LANG_LABELS = { zh: "中文", en: "English" };

/**
 * 三套「称谓」。同一棵树、同一个界面，只是换一种叫法，对树本身没有任何影响。
 * 中文原来的三套来自 `src/main.js`（母系是原文，所以是 null）。
 */
export const TERMS = {
  zh: {
    mother: null, // 母系 = 文案原文，不用替换
    neutral: [
      ["母亲节点", "上级节点"],
      ["姊妹节点", "同级节点"],
      ["女儿节点", "下级节点"],
      ["母亲", "上级"],
      ["姊妹", "同级"],
      ["女儿", "下级"],
    ],
    father: [
      ["母亲节点", "父节点"],
      ["姊妹节点", "兄弟节点"],
      ["女儿节点", "子节点"],
      ["母亲", "父"],
      ["姊妹", "兄弟"],
      ["女儿", "子"],
    ],
  },
  en: {
    mother: null, // 英文文案本来就是 mother / sister / daughter 那套
    neutral: [
      ["mother node", "parent node"],
      ["sister node", "sibling node"],
      ["daughter node", "child node"],
      ["mother", "parent"],
      ["sister", "sibling"],
      ["daughter", "child"],
    ],
    father: [
      ["mother node", "father node"],
      ["sister node", "brother node"],
      ["daughter node", "child node"],
      ["mother", "father"],
      ["sister", "brother"],
      ["daughter", "child"],
    ],
  },
};

/** 三个称谓按钮的标签（顺序固定：母系 → 中性 → 父系）
 *
 *  中文就是原来的「母系 / 中性 / 父系」。
 *  英文用 **Maternal / Neutral / Paternal** —— 这正是"母系 / 父系"的英文说法
 *  （maternal line / paternal line），比 Mother / Father 准确：按钮选的是**术语体系**，
 *  不是某个节点的称呼。（作者 2026-09-17 定）
 */
export const TERM_KINDS = ["mother", "neutral", "father"];
export const TERM_LABELS = {
  zh: { mother: "母系", neutral: "中性", father: "父系" },
  en: { mother: "Maternal", neutral: "Neutral", father: "Paternal" },
};

/**
 * 每种语言**默认**用哪套称谓（作者 2026-09-17 定）：
 *
 *   · 中文默认「母系」—— 中文语法教学里最常用的说法；
 *   · 英文默认「中性」（parent / sibling / child）—— 这是当代英语语言学里的通行说法，
 *     mother / daughter / sister 那套偏生成语法传统，留给需要的人自己选。
 *
 * 切换语言时会把称谓重置成该语言的默认值（见 `main.js` 的 `setLang()`）。
 */
export const DEFAULT_TERM = { zh: "mother", en: "neutral" };

export const STRINGS = {
  zh: {
    // ---- 工具栏按钮（label 是按钮上的字，key 是按钮右下角那行快捷键小字）----
    "btn.child": "＋女儿节点",
    "btn.child.root": "＋根节点",
    "btn.sibling": "＋姊妹节点",
    "btn.level.add": "下移",
    "btn.level.remove": "上移",
    "btn.level.force": "强制上移",
    "btn.move.left": "左移",
    "btn.move.right": "右移",
    "btn.remove": "删除",
    "btn.undo": "撤销",
    "btn.redo": "重做",
    "btn.svg.key": "矢量图",
    "btn.png.key": "位图",

    // ---- 工具栏 tooltip ----
    "tip.child": "给选中的节点增加一个女儿节点",
    "tip.sibling": "增加一个姊妹节点",
    "tip.level.add": "增加一层投射层，选中的节点连同它支配的整棵子树一起下沉一层",
    "tip.level.remove": "去掉紧挨着自己上面的那一层投射层",
    "tip.level.force":
      "强制上移：删掉它的所有姊妹节点，把它的女儿节点升到母亲节点底下，母亲节点改用它的名字，再删掉它自己",
    "tip.move.left": "如果有左姊妹节点就和它交换位置；如果自己是最左边的女儿节点，就搬到母亲节点的左姊妹节点底下",
    "tip.move.right": "如果有右姊妹节点就和它交换位置；如果自己是最右边的女儿节点，就搬到母亲节点的右姊妹节点底下",
    "tip.remove": "删除该节点及其整棵子树",
    "tip.undo": "撤销上一步",
    "tip.redo": "重做被撤销的一步",
    "tip.svg": "导出 SVG 矢量图",
    "tip.png": "导出 PNG 位图",
    "tip.chip": "把标签设为 {label}",

    // ---- 垂直对齐 ----
    "align.label": "垂直对齐",
    "align.depth": "按层级",
    "align.depth.hint": "每个节点都待在自己的层级行上，同一层的节点等高（默认）",
    "align.leaves": "词对齐底部",
    "align.leaves.hint": "所有叶子（词）落到最下面一行等高，中间节点保持原来的层级",
    "align.compact": "整树贴底",
    "align.compact.hint": "叶子节点对齐到底部后，中间节点也尽量下移贴着女儿节点，整棵树压到底线",

    // ---- 水平位置 ----
    "center.label": "水平位置",
    "center.mother": "母亲节点居中",
    "center.mother.hint": "母亲节点正好落在最左和最右那两个女儿节点的正中间（默认）",
    "center.block": "节点整体居中",
    "center.block.hint": "母亲节点居中于所有女儿节点的包围盒，整棵树看起来更平衡",

    // ---- 标色与字体样式 ----
    "style.label": "标色",
    "style.allBlue": "全部标蓝",
    "style.allBlue.hint": "删掉所有颜色声明，只留一行 Blue(all)：整棵树同一个蓝",
    "style.wordsRed": "单词标红",
    "style.wordsRed.hint": '删掉所有"词"的颜色声明（词回到默认的红）；其余节点若本来都只是蓝色，就连那些声明一起清掉，否则只删词上的（词 = 裸标签的叶子节点，或带位移箭头的叶子节点）',
    "style.nodeRed": "节点标红",
    "style.nodeRed.hint": "把选中的节点标成红色（选中的是词或范畴都可以）",
    "style.nodeBlue": "节点标蓝",
    "style.nodeBlue.hint": "给选中的节点写上蓝色声明（等价于加一行 Blue(编号)）",
    "style.nodeItalic": "节点斜体",
    "style.nodeItalic.hint": "给选中的节点切换斜体（等价于在末尾加或删一行 Italic(编号) 声明）",
    "style.nodeStrike": "节点删除线",
    "style.nodeStrike.hint": "给选中的节点切换删除线（等价于在末尾加或删一行 Strike(编号) 声明）",

    // ---- 画布与代码框 ----
    "canvas.blank.title": "空白画布",
    "canvas.blank.hint": "点画布任意处创建根节点。然后按 Enter 增加女儿节点、按 Shift+Enter 增加姊妹节点、按 Tab 增加一层投射层。",
    "canvas.blank.btn": "＋ 创建根节点",
    "code.caption": "源代码 —— 和上面的图双向同步",
    "code.mode.bracket": "括号记法",
    "code.mode.bracket.hint": "方括号嵌套式，适合整棵粘贴",
    "code.mode.rules": "规则记法",
    "code.mode.rules.hint": "一行一条母亲 -> 女儿，适合逐条核对",
    "code.gutter.title": "行号 = 本行引入的女儿节点编号（根节点是 0）",
    "hint.tips": "复制粘贴源代码用括号记法，画箭头建议用规则记法。 ",
    "hint.keys":
      "Enter 加女儿节点 · Shift+Enter 加姊妹节点 · Tab 下移(加一层投射) · Shift+Tab 上移 · " +
      "Alt+Shift+Tab 强制上移 · " +
      "↑ 母亲节点 · ↓ 第一个女儿节点 · ←→ 姊妹节点，到边了跨到堂表姊妹节点 · " +
      "F2 或双击改名 · Alt+←/→ 左移右移",

    // ---- 状态栏 ----
    "status.blank": "空白画布 —— 还没有任何节点",
    "status.none": "未选中任何节点",
    "status.leaf": "叶子节点",
    "status.branch": "非叶子节点",
    "status.emptyLabel": "(空标签)",
    "status.selected": "已选中第 {i} 个（共 {n} 个）：{label} · {kind} · 子树共 {m} 个节点",

    // ---- 错误提示 ----
    "err.atChar": "第 {n} 个字符附近：{message}",
    "err.atLine": "第 {n} 行：{message}",
    "err.mount": "SyntaxTreeEditor: 找不到挂载点",
    "err.png": "SVG 转 PNG 失败",

    // ---- 演示页（index.html）上的控件 ----
    "page.subtitle": "简单而轻量化的句法树编辑器",
    "page.note":
      "这个页面用的是 ES Modules，必须通过 HTTP 打开（http://127.0.0.1:8123/）。" +
      "直接双击本文件会被浏览器的 CORS 规则拦掉，编辑器不会出现 —— " +
      "想双击就用同目录下的 Syntax Tree Editor Standalone.html（单文件内联版，功能一样）。",
    "page.lang.label": "语言",
    "page.terms.label": "称谓",
    "page.terms.hint": "只改界面上的说法，不影响树的任何行为",
    "page.examples.label": "示例：",
    "page.examples.0": "经典结构",
    "page.examples.1": "CP 例句",
    "page.examples.2": "三角例句",
    "page.examples.3": "移位例句",
    "page.examples.4": "空白画布",
    "page.docs.title": "使用方法",
    "page.toc.title": "目录",
    "page.footer": "独立的编辑器实现，输入格式沿用 phpSyntaxTree / jsSyntaxTree 通行的括号记法；代码为本项目自写，不包含原项目源码。",
    "page.licence": "以 MIT 许可证发布",
    "page.link.repo": "项目地址",
    "page.link.online": "在线使用",
    "page.link.download": "组件下载",
  },

  en: {
    // ---- toolbar buttons ----
    "btn.child": "＋ Daughter",
    "btn.child.root": "＋ Root",
    "btn.sibling": "＋ Sister",
    "btn.level.add": "Move down",
    "btn.level.remove": "Move up",
    "btn.level.force": "Force up",
    "btn.move.left": "Move left",
    "btn.move.right": "Move right",
    "btn.remove": "Delete",
    "btn.undo": "Undo",
    "btn.redo": "Redo",
    "btn.svg.key": "Vector",
    "btn.png.key": "Bitmap",

    // ---- toolbar tooltips ----
    "tip.child": "Add a daughter node to the selected node",
    "tip.sibling": "Add a sister node",
    "tip.level.add": "Add a projection level: the selected node and its whole subtree move down one level",
    "tip.level.remove": "Remove the projection level directly above this node",
    "tip.level.force":
      "Force up: delete all its sister nodes, lift its daughter nodes under the mother node, rename the mother after it, then delete it",
    "tip.move.left": "Swap with the left sister, or move under the mother's left sister if already leftmost",
    "tip.move.right": "Swap with the right sister, or move under the mother's right sister if already rightmost",
    "tip.remove": "Delete this node and its whole subtree",
    "tip.undo": "Undo the last step",
    "tip.redo": "Redo the step that was undone",
    "tip.svg": "Export as an SVG vector image",
    "tip.png": "Export as a PNG bitmap",
    "tip.chip": "Set the label to {label}",

    // ---- vertical alignment ----
    "align.label": "Vertical",
    "align.depth": "By depth",
    "align.depth.hint": "Every node sits on its own depth row; nodes at the same depth share a line (default)",
    "align.leaves": "Words at bottom",
    "align.leaves.hint": "All leaves (words) drop to the bottom line; inner nodes keep their depth",
    "align.compact": "Tree at bottom",
    "align.compact.hint": "Leaves go to the bottom, then inner nodes slide down to hug their daughter nodes",

    // ---- horizontal position ----
    "center.label": "Horizontal",
    "center.mother": "Mother centred",
    "center.mother.hint": "The mother sits exactly between the leftmost and rightmost daughter nodes (default)",
    "center.block": "Block centred",
    "center.block.hint": "The mother is centred over the bounding box of all its daughter nodes",

    // ---- colour and font style ----
    "style.label": "Colour",
    "style.allBlue": "All blue",
    "style.allBlue.hint": "Drop every colour declaration and leave a single Blue(all): one blue for the whole tree",
    "style.wordsRed": "Words red",
    "style.wordsRed.hint": "Drop the colour declarations on every word (they fall back to the default red). If all the other nodes were only blue, those declarations go too; otherwise only the words are touched (a word is a bare-label leaf, or a leaf carrying a movement arrow)",
    "style.nodeRed": "Node red",
    "style.nodeRed.hint": "Colour the selected node red (a word or a category)",
    "style.nodeBlue": "Node blue",
    "style.nodeBlue.hint": "Write a blue declaration for the selected node — same as adding Blue(number)",
    "style.nodeItalic": "Node italic",
    "style.nodeItalic.hint": "Toggle italic on the selected node (adds or removes an Italic(N) declaration)",
    "style.nodeStrike": "Node strike",
    "style.nodeStrike.hint": "Toggle strikethrough on the selected node (adds or removes a Strike(N) declaration)",

    // ---- canvas and code box ----
    "canvas.blank.title": "Blank canvas",
    "canvas.blank.hint": "Click anywhere on the canvas to create a root node. Then Enter adds a daughter, Shift+Enter adds a sister, Tab adds a projection level.",
    "canvas.blank.btn": "＋ Create root node",
    "code.caption": "Source — synced both ways with the diagram",
    "code.mode.bracket": "Bracket",
    "code.mode.bracket.hint": "Nested brackets; best for pasting a whole tree",
    "code.mode.rules": "Rules",
    "code.mode.rules.hint": "One mother -> daughter edge per line; best for checking edge by edge",
    "code.gutter.title": "Line number = the node this line introduces (the root is 0)",
    "hint.tips": "Use bracket notation for pasting source; rule notation for drawing arrows. ",
    "hint.keys":
      "Enter adds a daughter · Shift+Enter adds a sister · Tab adds a level · Shift+Tab removes one · " +
      "Alt+Shift+Tab forces one up · " +
      "↑ mother · ↓ leftmost daughter · ←→ sister nodes, crossing to cousins at the edges · " +
      "F2 or double-click renames · Alt+←/→ move left/right",

    // ---- status bar ----
    "status.blank": "Blank canvas — no nodes yet",
    "status.none": "No node selected",
    "status.leaf": "leaf node",
    "status.branch": "non-leaf node",
    "status.emptyLabel": "(empty label)",
    "status.selected": "Node {i} of {n}: {label} · {kind} · {m} nodes in this subtree",

    // ---- errors ----
    "err.atChar": "Near character {n}: {message}",
    "err.atLine": "Line {n}: {message}",
    "err.mount": "SyntaxTreeEditor: mount point not found",
    "err.png": "Failed to convert SVG to PNG",

    // ---- controls on the demo page (index.html) ----
    "page.subtitle": "A small, lightweight syntax tree editor",
    "page.note":
      "This page uses ES Modules, so it must be served over HTTP (http://127.0.0.1:8123/). " +
      "Opening the file directly is blocked by the browser's CORS rules and the editor will not appear — " +
      "to double-click, use Syntax Tree Editor Standalone.html in the same folder (single-file build, same features).",
    "page.lang.label": "Language",
    "page.terms.label": "Terms",
    "page.terms.hint": "Wording only; the tree is unaffected",
    "page.examples.label": "Examples:",
    "page.examples.0": "Classic",
    "page.examples.1": "CP example",
    "page.examples.2": "Triangle",
    "page.examples.3": "Movement",
    "page.examples.4": "Blank",
    "page.docs.title": "Instructions",
    "page.toc.title": "Contents",
    "page.footer": "An independent implementation. The input format follows the bracket notation common to phpSyntaxTree / jsSyntaxTree; all code is original.",
    "page.licence": "released under the MIT licence",
    "page.link.repo": "Repository",
    "page.link.online": "Live demo",
    "page.link.download": "Download",
  },
};

/**
 * 取一条文案，并把 `{name}` 占位符换成实参。
 * `vars` 里的值会先转成字符串；缺的占位符原样留着（方便一眼看出漏了哪个）。
 *
 * ⚠️ 名字起得这么长是有意的：`tools/build-standalone.mjs` 把模块**扁平拼接**成一个脚本，
 * `import ... as ...` 的别名会被整条去掉，所以这个函数在各模块里必须叫同一个名字，
 * 而 `text` 这种短名字到处都在当局部变量用（`setValue(text)` 之类），会撞上。
 */
export function i18nText(lang, key, vars = null) {
  const table = STRINGS[lang] || STRINGS.zh;
  let s = table[key];
  if (s == null) s = STRINGS.zh[key] != null ? STRINGS.zh[key] : key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (whole, name) => (vars[name] == null ? whole : String(vars[name])));
}

/**
 * 把称谓替换应用到一句话上。
 *
 * `pairs` 为 null（母系）时原样返回。中文直接替换（中文没有词边界，所以同一套里必须
 * 长词在前 —— 表里已经这么排了）。
 *
 * 英文有两件事要小心，否则会出洋相：
 *   1. **按整词边界**替换，`smother` 里的 `mother` 不许动；
 *   2. **大小写不敏感、但要保留原样的大小写** —— 按钮上是 "＋ Sister"（首字母大写），
 *      说明文字里是 "a sister node"（小写），替换后要各自保持原样，
 *      所以 "Sister" -> "Sibling"、MOTHER -> PARENT。
 *
 * ⚠️ 英文表里**不要写亲属词的复数**（daughters / sisters…）—— 复数靠长词规则处理：
 * 写成 "daughter nodes" 就会被 `daughter node -> child node` 换成 "child nodes"。
 * 这也是表里为什么长词排在短词前面。
 */
export function applyTerms(lang, pairs, s) {
  if (!pairs || !pairs.length) return s;
  let out = s;
  for (const [from, to] of pairs) {
    if (lang !== "en") {
      out = out.split(from).join(to);
      continue;
    }
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${esc}\\b`, "gi"), (m) => {
      if (m === m.toUpperCase() && m !== m.toLowerCase()) return to.toUpperCase();
      if (m[0] === m[0].toUpperCase()) return to.charAt(0).toUpperCase() + to.slice(1);
      return to;
    });
  }
  return out;
}
