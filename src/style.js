// 斜体 / 粗体 / 删除线 / 颜色的声明（两套记法共用的写法）
//
// 声明写在**最后**，单独成行，括号里是节点的编号 ——
// 编号就是两套记法共用的那一套（根节点 0，其余 = 第一次作为女儿节点出现的行号）。
//
//   Italic(1, 3)
//   Bold(2)
//   Strike(4)
//   Red(5, 7)
//   Blue(6)
//
// 五类声明的形式完全一样：声明词 + 一对括号，括号里可以列多个编号，用逗号隔开。
// 颜色名自己就是声明词（Red / Blue / ...），所以不需要 Color 前缀。
// 声明词大小写不敏感（`ITALIC(1)` 和 `italic(1)` 都认），导出统一成首字母大写。
//
// 括号里的项除了编号，还可以用两个关键词（大小写不敏感，可混写、可重复）：
//
//   all     所有节点          —— Blue(all) 就是整棵树蓝
//   words   所有「词」        —— Blue(words, 0) 把词和 0 号一起标蓝
//
// 关键词的「词」口径与 layout.js 的 wordNodes(root) 完全一致。
//
// 颜色求值顺序里有两行**隐式基线**（永远不写进文本，只在后台生效）：
//
//   Blue(all)      先给所有节点刷蓝
//   Red(words)     再把「词」刷红
//   ⋯⋯             文本里的颜色声明按出现顺序排在这两行之后（所以后写的赢 = 覆盖）
//
// 模型里没有"基线"这个状态：node.color == null 就是"跟着基线走"，
// 而默认画法（render.js）本来就是"词红、其余蓝"，两边必须始终一致。
// 所以 `Blue(words)` 的效果正好是"把词也刷蓝" —— 这正是「全部标蓝」按钮要的。
//
// 规则记法里接在所有边和位移箭头后面：
//
//   0 XP -> D
//   1 D  -> w1
//
//   2 --> 1
//
//   Italic(1, 3)
//
// 括号记法里同样写在末尾（括号记法没有行号的概念，所以只能靠这套编号来指认节点）：
//
//   [S [NP Dogs] [VP barks]]
//   Italic(3)
//
// 两套记法都用同一套编号，所以同一个声明在两边指的是同一个节点。

import { nodeIds } from "./model.js";
import { wordNodes } from "./layout.js";

/** 可用的颜色名（全部用英语小写）。顺序就是导出时颜色声明的先后顺序。 */
export const COLOR_NAMES = [
  "red", "yellow", "blue", "green", "orange", "magenta", "purple", "black", "white",
];

/**
 * 颜色名 -> 实际色值。
 * 这是唯一来源：style.js 负责语法，render.js 从这里取色。
 * 黄色和白色特意选了在浅色背景上仍能看清的色值。
 */
export const COLOR_VALUES = {
  red: "#d32f2f",
  yellow: "#e0a000",
  blue: "#1565c0",
  green: "#2e7d32",
  orange: "#e65100",
  magenta: "#c2185b",
  purple: "#6a1b9a",
  black: "#1a1a1a",
  white: "#ffffff",
};

/**
 * 字体样式声明：Italic(1, 3)、Bold(2)、Strike(4)。
 * 声明词**大小写不敏感**（`ITALIC(1)`、`italic(1)` 都认），导出统一成首字母大写。
 */
const DECL = /^\s*(Italic|Bold|Strike)\s*\(([^)]*)\)\s*$/i;

/**
 * 颜色声明：Red(1, 3)、Blue(6)。
 * 认得的颜色名只有 COLOR_NAMES 里的九个（大小写不敏感）——
 * 写了别的颜色名（Chartreuse(3)）不会被当成声明，会当成树的内容，从而报解析错误。
 */
const COLOR_DECL = new RegExp(`^\\s*(${COLOR_NAMES.join("|")})\\s*\\(([^)]*)\\)\\s*$`, "i");

/**
 * 括号里的两个关键词（大小写不敏感）。它们和编号一样是"项"，可以混写：
 *
 *   all     所有节点          —— 展开成 nodeIds(root) 的全部节点
 *   words   所有「词」        —— 展开成 layout.js 的 wordNodes(root)，口径完全一致
 *
 * `Blue(all)` = 整棵树蓝；`Blue(words)` 落在隐式基线（词红、其余蓝）之后，
 * 所以正好是"把词也刷蓝"（见文件末尾「隐式基线」那段）。
 */
const TARGET_KEYWORDS = ["all", "words"];

/**
 * 括号里的项列表 -> { ids, targets }。
 * 编号：空项、非整数、负数一律丢掉（一直是这个规矩）；
 * 关键词：trim + 小写后命中 TARGET_KEYWORDS 才认，去重后按出现顺序留在 targets 里。
 * 认不出来的东西静默丢掉 —— 只针对括号里的内容，颜色声明词本身仍受严格检查。
 *
 * @returns {{ids: number[], targets: string[]}}
 */
function parseIds(s) {
  const ids = [];
  const targets = [];
  for (const item of s.split(",")) {
    const raw = item.trim();
    if (raw === "") continue;
    const lower = raw.toLowerCase();
    if (TARGET_KEYWORDS.includes(lower)) {
      if (!targets.includes(lower)) targets.push(lower);
      continue;
    }
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0) ids.push(n);
  }
  return { ids, targets };
}

/** red -> Red、ITALIC -> Italic。声明词大小写不敏感，内部和导出一律用规范写法 */
function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * 把尾部的样式声明切下来。
 * @returns {{tree: string, decls: Array<{kind: string, ids: number[], color?: string, targets: string[]}>}}
 *   kind 是 "Italic" / "Bold" / "Strike" / "Color"；颜色声明额外带 color（小写颜色名）；
 *   targets 是括号里的关键词（"all" / "words"，去重），没有关键词时是空数组
 */
export function splitStyleDecls(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const decls = [];
  let end = lines.length;

  // 声明只能出现在末尾，所以从后往前认
  while (end > 0 && lines[end - 1].trim() === "") end--;
  while (end > 0) {
    const m = DECL.exec(lines[end - 1]);
    if (m) {
      // 声明词大小写不敏感，内部统一成 Italic / Bold / Strike 三种规范写法
      const { ids, targets } = parseIds(m[2]);
      decls.unshift({ kind: capitalize(m[1]), ids, targets });
      end--;
      continue;
    }

    const c = COLOR_DECL.exec(lines[end - 1]);
    if (!c) break;
    const { ids, targets } = parseIds(c[2]);
    decls.unshift({ kind: "Color", ids, targets, color: c[1].toLowerCase() });
    end--;
  }

  return { tree: lines.slice(0, end).join("\n"), decls };
}

/**
 * 按编号把样式打到节点上。
 *
 * 颜色是**一个节点一个颜色**，而同一个节点可以被多条颜色声明命中。
 * 这里按声明在文本里出现的先后依次赋值，所以**靠后的那条有效**；
 * 冗余的声明会在下一次图形改动写回文本时自然消失（导出只认节点上的那一个颜色）。
 *
 * 括号里的关键词在这里展开成编号：`all` -> 所有节点，`words` -> wordNodes(root)。
 * 展开必须在**整棵树建好之后**做 —— 两套记法都是在末尾调用本函数，位置正合适。
 */
export function applyStyleDecls(root, decls) {
  if (!root || !decls.length) return;
  const byId = new Map();
  for (const [node, id] of nodeIds(root)) byId.set(id, node);

  // 关键词展开出来的节点对象（展开结果与声明无关，所以只算一次）
  const expanded = { all: [], words: [] };
  for (const t of TARGET_KEYWORDS) {
    if (t === "all") expanded.all = [...byId.values()];
    else expanded.words = wordNodes(root);
  }

  for (const decl of decls) {
    const targets = [...decl.ids.map((id) => byId.get(id)), ...(decl.targets ?? []).flatMap((t) => expanded[t])];
    for (const target of targets) {
      if (!target) continue;
      if (decl.kind === "Italic") target.italic = true;
      else if (decl.kind === "Bold") target.bold = true;
      else if (decl.kind === "Strike") target.strike = true;
      else target.color = decl.color;
    }
  }
}

/** 颜色声明行的导出顺序：先按 COLOR_NAMES 的顺序，表外的颜色名排在最后，免得静默丢掉 */
function colorRank(name) {
  const i = COLOR_NAMES.indexOf(name);
  return i < 0 ? COLOR_NAMES.length : i;
}

/**
 * 隐式基线：没有显式颜色声明时，一个节点在画布上是什么颜色。
 *
 * 定义就是文件头那两行基线（词红、其余蓝），所以：
 *  - render.js 的默认画法必须用它（两边不一致就会出现"按钮算出来的颜色"和"看到的颜色"不同）；
 *  - editor.js 判断按钮灰不灰时也用它（`node.color == null` 就是"跟着基线走"）；
 *  - 测试里直接调它来断言"基线与默认画法一致"。
 *
 * @param {boolean} isWord  这个节点是不是「词」（判定唯一来源是 layout.js 的 wordNodes）
 */
export function baselineColor(isWord) {
  return isWord ? "red" : "blue";
}

/**
 * 生成尾部的声明行；这棵树没有任何样式时返回空字符串。
 *
 * 颜色行按「怎么短怎么写、而且跟着树走」的优先级挑选写法（见下面的 colorItems）：
 * 整棵树同色写 `Blue(all)`，整组词同色写 `Blue(words)`（还要算上多出来的编号），
 * 其余照旧列编号。关键词一律小写，`all` 的优先级比 `words` 高。
 */
export function styleDeclsText(root) {
  if (!root) return "";
  const italic = [];
  const bold = [];
  const strike = [];
  const byColor = new Map(); // 颜色名 -> 编号数组
  const nodes = [...nodeIds(root)]; // [node, id] 数组（Map 没有 filter）
  for (const [node, id] of nodes) {
    if (node.italic) italic.push(id);
    if (node.bold) bold.push(id);
    if (node.strike) strike.push(id);
    if (node.color) {
      if (!byColor.has(node.color)) byColor.set(node.color, []);
      byColor.get(node.color).push(id);
    }
  }
  const total = nodes.length;

  // 「词」的编号集合（用的是全项目唯一的那个判定），供 `words` 关键词的比较用
  const wordSet = new Set(wordNodes(root));
  const wordIds = new Set(nodes.filter(([node]) => wordSet.has(node)).map(([, id]) => id));

  const asc = (a, b) => a - b;
  const parts = [];
  if (italic.length) parts.push(`Italic(${italic.sort(asc).join(", ")})`);
  if (bold.length) parts.push(`Bold(${bold.sort(asc).join(", ")})`);
  if (strike.length) parts.push(`Strike(${strike.sort(asc).join(", ")})`);
  // 一种颜色一行；同一个颜色下的编号合并在一起，和 Italic(1, 3) 的写法一致
  const colors = [...byColor.keys()].sort((a, b) => colorRank(a) - colorRank(b) || (a < b ? -1 : a > b ? 1 : 0));
  for (const name of colors) {
    const ids = byColor.get(name).sort(asc);
    parts.push(`${capitalize(name)}(${colorItems(ids, wordIds, total)})`);
  }
  return parts.join("\n");
}

/**
 * 一组的括号内容：优先用关键词，用不了才列编号。
 *
 * 1. 这组就是**全部**节点            -> `all`
 * 2. 「词」不为空且这组包含**全部**词 -> `words` + 多出来的编号（为空就只写 `words`）
 * 3. 其它                            -> 照旧列编号
 *
 * @param {number[]} ids      这一组里有颜色的节点编号（升序）
 * @param {Set<number>} wordIds 全树的词编号
 * @param {number} total      全树的节点数
 */
function colorItems(ids, wordIds, total) {
  if (ids.length === total) return "all";
  if (wordIds.size) {
    const covered = new Set(ids);
    if ([...wordIds].every((id) => covered.has(id))) {
      const rest = ids.filter((id) => !wordIds.has(id));
      return rest.length ? `words, ${rest.join(", ")}` : "words";
    }
  }
  return ids.join(", ");
}
