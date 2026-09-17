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

/** 括号里的编号列表 -> 数字数组；空项、非整数、负数一律丢掉 */
function parseIds(s) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0);
}

/** red -> Red、ITALIC -> Italic。声明词大小写不敏感，内部和导出一律用规范写法 */
function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * 把尾部的样式声明切下来。
 * @returns {{tree: string, decls: Array<{kind: string, ids: number[], color?: string}>}}
 *   kind 是 "Italic" / "Bold" / "Strike" / "Color"；颜色声明额外带 color（小写颜色名）
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
      decls.unshift({ kind: capitalize(m[1]), ids: parseIds(m[2]) });
      end--;
      continue;
    }

    const c = COLOR_DECL.exec(lines[end - 1]);
    if (!c) break;
    decls.unshift({ kind: "Color", ids: parseIds(c[2]), color: c[1].toLowerCase() });
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
 */
export function applyStyleDecls(root, decls) {
  if (!root || !decls.length) return;
  const byId = new Map();
  for (const [node, id] of nodeIds(root)) byId.set(id, node);

  for (const decl of decls) {
    for (const id of decl.ids) {
      const target = byId.get(id);
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

/** 生成尾部的声明行；这棵树没有任何样式时返回空字符串 */
export function styleDeclsText(root) {
  if (!root) return "";
  const italic = [];
  const bold = [];
  const strike = [];
  const byColor = new Map(); // 颜色名 -> 编号数组
  for (const [node, id] of nodeIds(root)) {
    if (node.italic) italic.push(id);
    if (node.bold) bold.push(id);
    if (node.strike) strike.push(id);
    if (node.color) {
      if (!byColor.has(node.color)) byColor.set(node.color, []);
      byColor.get(node.color).push(id);
    }
  }

  const asc = (a, b) => a - b;
  const parts = [];
  if (italic.length) parts.push(`Italic(${italic.sort(asc).join(", ")})`);
  if (bold.length) parts.push(`Bold(${bold.sort(asc).join(", ")})`);
  if (strike.length) parts.push(`Strike(${strike.sort(asc).join(", ")})`);
  // 一种颜色一行；同一个颜色下的编号合并在一起，和 Italic(1, 3) 的写法一致
  const colors = [...byColor.keys()].sort((a, b) => colorRank(a) - colorRank(b) || (a < b ? -1 : a > b ? 1 : 0));
  for (const name of colors) parts.push(`${capitalize(name)}(${byColor.get(name).sort(asc).join(", ")})`);
  return parts.join("\n");
}
