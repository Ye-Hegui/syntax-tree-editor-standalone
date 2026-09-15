// 斜体 / 粗体的声明（两套记法共用的写法）
//
// 声明写在**最后**，单独成行，括号里是节点的编号 ——
// 编号就是两套记法共用的那一套（根节点 0，其余 = 第一次作为女儿节点出现的行号）。
//
//   Italic(1, 3)
//   Bold(2)
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

const DECL = /^\s*(Italic|Bold)\s*\(([^)]*)\)\s*$/;

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

  for (const { kind, ids } of decls) {
    for (const id of ids) {
      const target = byId.get(id);
      if (!target) continue;
      if (kind === "Italic") target.italic = true;
      else target.bold = true;
    }
  }
}

/** 生成尾部的声明行；这棵树没有任何样式时返回空字符串 */
export function styleDeclsText(root) {
  if (!root) return "";
  const italic = [];
  const bold = [];
  for (const [node, id] of nodeIds(root)) {
    if (node.italic) italic.push(id);
    if (node.bold) bold.push(id);
  }
  const asc = (a, b) => a - b;
  const parts = [];
  if (italic.length) parts.push(`Italic(${italic.sort(asc).join(", ")})`);
  if (bold.length) parts.push(`Bold(${bold.sort(asc).join(", ")})`);
  return parts.join("\n");
}
