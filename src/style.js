// 斜体 / 粗体的声明（两套记法共用的写法）
//
// 声明写在**最后**，单独成行，括号里是节点的编号 ——
// 编号就是两套记法共用的那一套（根节点 0，其余 = 第一次作为女儿节点出现的行号）。
//
//   Italic(1, 3)
//   Bold(2)
//   Strike(4)
//   Color(5, blue)
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

const DECL = /^\s*(Italic|Bold|Strike)\s*\(([^)]*)\)\s*$/;

// Color 的写法和其他三种不一样：一个节点配一个颜色名，所以单独一条正则。
//   Color(4, red)
const COLOR_DECL = /^\s*Color\s*\(\s*(\d+)\s*,\s*([A-Za-z]+)\s*\)\s*$/;

/** 可用的颜色名（全部用英语小写） */
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
 * 把尾部的样式声明切下来。
 * @returns {{tree: string, decls: Array<{kind: string, ids: number[]}>}}
 */
export function splitStyleDecls(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const decls = [];
  let end = lines.length;

  // 声明只能出现在末尾，所以从后往前认
  while (end > 0 && lines[end - 1].trim() === "") end--;
  while (end > 0) {
    const color = COLOR_DECL.exec(lines[end - 1]);
    if (color) {
      decls.unshift({ kind: "Color", ids: [Number(color[1])], color: color[2].toLowerCase() });
      end--;
      continue;
    }

    const m = DECL.exec(lines[end - 1]);
    if (!m) break;
    const ids = m[2]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0);
    decls.unshift({ kind: m[1], ids });
    end--;
  }

  return { tree: lines.slice(0, end).join("\n"), decls };
}

/** 按编号把样式打到节点上 */
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
      // 颜色名不认识就忽略，不报错
      else if (COLOR_NAMES.includes(decl.color)) target.color = decl.color;
    }
  }
}

/** 生成尾部的声明行；这棵树没有任何样式时返回空字符串 */
export function styleDeclsText(root) {
  if (!root) return "";
  const italic = [];
  const bold = [];
  const strike = [];
  const colored = [];
  for (const [node, id] of nodeIds(root)) {
    if (node.italic) italic.push(id);
    if (node.bold) bold.push(id);
    if (node.strike) strike.push(id);
    if (node.color) colored.push([id, node.color]);
  }
  const asc = (a, b) => a - b;
  const parts = [];
  if (italic.length) parts.push(`Italic(${italic.sort(asc).join(", ")})`);
  if (bold.length) parts.push(`Bold(${bold.sort(asc).join(", ")})`);
  if (strike.length) parts.push(`Strike(${strike.sort(asc).join(", ")})`);
  // Color 一个节点一行，按节点编号排列
  for (const [id, name] of colored.sort((a, b) => a[0] - b[0])) parts.push(`Color(${id}, ${name})`);
  return parts.join("\n");
}
