// 规则记法：一行一条母亲节点 -> 女儿节点 的边，位移箭头单独一行
//
//   0 XP -> D
//   0 XP -> X'
//   1 D -> w1
//   2 X' -> X
//   2 X' -> Y
//   4 X -> w2
//   5 Y -> w3
//
//   7 --> 6
//
// 每行是：<母亲节点编号> <母亲节点标签> -> <女儿节点标签>
//
// 约定
//   - 根节点的编号是 0
//   - 其余节点的编号 = 它第一次出现在箭头右边的那一行的【行号】。
//     行号显示在代码框左边的装订线上，不写进文本，所以选中复制不会带上它。
//   - 母亲节点必须先在前面出现过才能被引用（编号比当前行号小）
//   - 位移箭头：<起点编号> --> <落点编号>；起点必须是叶子节点，落点可以是任何节点
//   - 标签含空格、引号、_ 或 ^ 时用双引号括起来；下标上标写在标签后面，
//     例如 NP_1、N'^2、"the mailman"_1
//
// 因为编号就是行号，在上面插一行或删一行会让下面所有引用错位。编辑器会自动把编号改回去
// （见 editor.js 的 #repairRulesNumbers），所以这里解析时做一次宽松处理：
// 编号对不上就退回按标签找，这样编辑器才有机会把它修正。

import { node, nodeIds, preorder, ESCAPE_LABEL, isEscapeLabel } from "./model.js";
import { splitStyleDecls, applyStyleDecls, styleDeclsText } from "./style.js";

export class RuleError extends Error {
  constructor(message, line = 1) {
    super(message);
    this.name = "RuleError";
    this.line = line;
  }
}

const RULE_WS = /\s/;

/** 读一个"标签 [+ 下/上标]"的 token */
function parseLabelToken(text, lineNo) {
  let i = 0;
  const skip = () => {
    while (i < text.length && RULE_WS.test(text[i])) i++;
  };

  skip();
  if (i >= text.length) throw new RuleError("这里需要一个标签", lineNo);

  let label;
  let quoted = false;
  if (text[i] === '"') {
    const end = text.indexOf('"', i + 1);
    if (end < 0) throw new RuleError("引号没有闭合", lineNo);
    label = text.slice(i + 1, end);
    quoted = true;
    i = end + 1;
  } else {
    let j = i;
    while (j < text.length && !RULE_WS.test(text[j]) && text[j] !== "_" && text[j] !== "^") j++;
    label = text.slice(i, j);
    i = j;
    if (label === "")
      throw new RuleError("标签不能以 _ 或 ^ 开头，否则分不清是标签还是下标", lineNo);
  }

  let sub = null;
  let sup = null;
  skip();
  if (text[i] === "_" || text[i] === "^") {
    const isSup = text[i] === "^";
    i++;
    skip();
    let v;
    if (text[i] === '"') {
      const end = text.indexOf('"', i + 1);
      if (end < 0) throw new RuleError("引号没有闭合", lineNo);
      v = text.slice(i + 1, end);
      i = end + 1;
    } else {
      let j = i;
      while (j < text.length && !RULE_WS.test(text[j])) j++;
      v = text.slice(i, j);
      i = j;
    }
    if (v === "") throw new RuleError(`${isSup ? "上" : "下"}标后面缺少内容`, lineNo);
    if (isSup) sup = v;
    else sub = v;
  }

  skip();
  if (i !== text.length)
    throw new RuleError("标签后面还有多余内容（含空格的标签要用双引号括起来）", lineNo);

  return { label, sub, sup, quoted };
}

function makeNode(spec) {
  const n = node(spec.label);
  n.sub = spec.sub ?? null;
  n.sup = spec.sup ?? null;
  // 裸写的 %Empty（后面可以跟任意个撇）是转义节点；写成 "%Empty"（带引号）只是一个普通标签
  if (!spec.quoted && isEscapeLabel(spec.label)) n.escape = true;
  return n;
}

function parseLine(raw, lineNo) {
  const line = raw.trim();
  if (line === "") return null;

  const m = /^(.*?)\s*(-->|->)\s*(.*)$/.exec(line);
  if (!m) throw new RuleError('这一行缺少 "->" 或 "-->"', lineNo);
  const left = m[1].trim();
  const arrow = m[2];
  const right = m[3];

  if (arrow === "-->") {
    const a = left;
    const b = right.trim();
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b))
      throw new RuleError("位移箭头两边都要是节点编号，例如 7 --> 6", lineNo);
    return { kind: "move", from: Number(a), to: Number(b), line: lineNo };
  }

  // 左边有两种写法：带行号 `1  0 XP`，或不带行号 `0 XP`
  let motherId;
  let labelText;
  let matched = /^(\d+)\s+(\d+)\s+([\s\S]+)$/.exec(left);
  if (matched) {
    motherId = Number(matched[2]);
    labelText = matched[3];
  } else {
    matched = /^(\d+)\s+([\s\S]+)$/.exec(left);
    if (!matched) throw new RuleError("左边要写成「mother编号 标签」，例如 0 XP", lineNo);
    motherId = Number(matched[1]);
    labelText = matched[2];
  }

  return {
    kind: "edge",
    motherId,
    spec: parseLabelToken(labelText, lineNo),
    child: parseLabelToken(right, lineNo),
    line: lineNo,
  };
}

/**
 * 找这一行的母亲节点。
 *
 * 先按编号找（正常情况）。如果编号对不上（多半是在上面插了行或删了行），
 * 就退回到「按标签在已经出现过的节点里找最接近的那个」——
 * 这样编辑器才有机会把编号自动修回去，而不是直接报错卡住。
 */
function resolveMother(byId, e) {
  const exact = byId.get(e.motherId);
  if (exact && exact.label === e.spec.label) return exact;

  let best = null;
  let bestGap = Infinity;
  for (const [id, n] of byId) {
    if (n.label !== e.spec.label) continue;
    const gap = Math.abs(id - e.motherId);
    if (gap < bestGap) {
      bestGap = gap;
      best = n;
    }
  }
  return best;
}

/**
 * 规则记法 -> 模型。
 * 每个节点的 `line` 属性记录它的编号（根节点固定是 0），编辑器靠它重排编号。
 * @returns {object} 根节点
 */
export function parseRules(text) {
  // 末尾的 Italic(...) / Bold(...) 声明先切下来
  const { tree, decls } = splitStyleDecls(text);
  const raw = tree;
  const edges = [];
  const moves = [];

  raw.split(/\r?\n/).forEach((line, i) => {
    const rec = parseLine(line, i + 1);
    if (!rec) return;
    (rec.kind === "edge" ? edges : moves).push(rec);
  });

  if (edges.length === 0) throw new RuleError("至少要有一行规则，例如「0 XP -> D」", 1);

  let root = null;
  const byId = new Map();

  for (const e of edges) {
    const lineNumber = e.line; // 编号 = 这一行的行号

    if (!root && e.motherId !== 0)
      throw new RuleError(
        `第一行规则的母亲节点编号必须是 0（根节点），这里写的是 ${e.motherId}`,
        e.line,
      );

    if (e.motherId === 0 && !root) {
      root = makeNode(e.spec);
      root.line = 0;
      byId.set(0, root);
    }

    const mother = resolveMother(byId, e);
    if (!mother)
      throw new RuleError(
        `编号 ${e.motherId} 还没出现过，也找不到标签为 "${e.spec.label}" 的节点。` +
          `编号就是它第一次出现在箭头右边的那一行的行号，根节点是 0`,
        e.line,
      );

    const child = makeNode(e.child);
    child.line = lineNumber;
    byId.set(lineNumber, child);
    mother.children.push(child);
  }

  for (const m of moves) {
    const from = byId.get(m.from);
    const to = byId.get(m.to);
    if (!from)
      throw new RuleError(
        `起点编号 ${m.from} 不存在。编号就是它第一次出现在箭头右边的那一行的行号，根节点是 0`,
        m.line,
      );
    if (from.children.length > 0)
      throw new RuleError(
        `编号 ${m.from}（"${from.label}"）不是叶子节点。位移箭头只能挂在叶子节点上（比如 t）`,
        m.line,
      );
    if (!to) throw new RuleError(`落点编号 ${m.to} 不存在`, m.line);
    from.arrow = { target: to, targetIndex: m.to };
  }

  applyStyleDecls(root, decls);

  // 转义节点的两条限制（作者定的）：不能出现在树底，最多三个女儿节点
  for (const n of preorder(root)) {
    if (!n.escape) continue;
    if (!n.children.length)
      throw new RuleError(`"${ESCAPE_LABEL}" 必须有女儿节点（转义节点不能出现在树底）`, n.line ?? 1);
    if (n.children.length > 3)
      throw new RuleError(`"${ESCAPE_LABEL}" 最多三个女儿节点，这里有 ${n.children.length} 个`, n.line ?? 1);
  }
  return root;
}

/** 把一个标签（含下/上标）写成规则记法里的 token */
function tokenOf(n) {
  const label = String(n.label ?? "");
  // 标签长得像转义节点（%Empty 或带撇）但又不是转义节点时，必须带引号写，
  // 否则再解析回来就变成转义节点了
  const force = isEscapeLabel(label) && !n.escape;
  const bare = !force && label !== "" && !/[\s"^_]/.test(label) && !/-->|->/.test(label);
  const head = bare ? label : `"${label.replace(/"/g, "")}"`;

  const ss = (v) => (/[\s"]/.test(String(v)) ? `"${String(v).replace(/"/g, "")}"` : String(v));
  if (n.sub != null && n.sub !== "") return `${head}_${ss(n.sub)}`;
  if (n.sup != null && n.sup !== "") return `${head}^${ss(n.sup)}`;
  return head;
}

/**
 * 模型 -> 规则记法
 * 返回 { text, spans }，spans 是 Map<节点, [起, 止]>，用于把图上的选中态映射回文本。
 */
export function serializeRules(root) {
  // 行序就是编号序：先把每条边按"行号"排好
  const ids = nodeIds(root);
  const ordered = [];
  (function emit(n) {
    for (const c of n.children) ordered.push({ mother: n, child: c });
    for (const c of n.children) emit(c);
  })(root);

  const spans = new Map();
  const parts = [];
  let pos = 0;
  const push = (s) => {
    parts.push(s);
    pos += s.length;
  };

  // 行号由编辑器左侧的装订线显示，不写进文本 —— 否则会被一起选中复制。
  // 编号本身仍然由行序决定（nodeIds 用的是同一套顺序）。
  for (const { mother, child } of ordered) {
    const lineStart = pos;
    push(`${ids.get(mother)} ${tokenOf(mother)} -> `);
    const childStart = pos;
    push(tokenOf(child));
    spans.set(child, [childStart, pos]);
    const prev = spans.get(mother);
    spans.set(mother, prev ? [Math.min(prev[0], lineStart), pos] : [lineStart, pos]);
    push("\n");
  }

  const moveLines = [];
  for (const n of preorder(root)) {
    if (!n.arrow || n.children.length > 0) continue;
    const to = n.arrow.target ? ids.get(n.arrow.target) : n.arrow.targetIndex;
    if (to == null) continue;
    moveLines.push(`${ids.get(n)} --> ${to}`);
  }
  if (moveLines.length) {
    push("\n");
    push(moveLines.join("\n"));
    push("\n");
  }

  const text = parts.join("").replace(/\n+$/, "");
  const decls = styleDeclsText(root);
  return { text: decls ? `${text}\n\n${decls}` : text, spans };
}

/** 便捷函数：只要文本 */
export function toRulesText(root) {
  return serializeRules(root).text;
}
