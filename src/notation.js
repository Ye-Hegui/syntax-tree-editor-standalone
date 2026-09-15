// 括号记法（labelled bracket notation）与模型之间的双向转换
//
//   文本  --parse()-->  模型        （代码 → 图）
//   模型  --serialize()-->  文本     （图 → 代码）
//
// 记法沿用 phpSyntaxTree / jsSyntaxTree 的事实标准：
//   [S [NP Dogs][VP barks]]     普通节点与叶子
//   [N_s Dogs]  [N^s Cats]      下标 / 上标
//   ["Main clause" [S][V][O]]   含空格的标签用双引号
//   [S NP VP]                   连续字符串会合成一个叶子 "NP VP"
//   [A [B C][D E][F G ->7]]     位移箭头，数字是两套记法共用的节点编号：
//                               根节点是 0，其余节点 = 它第一次作为女儿节点出现的行号
//                               （见 model.js 的 nodeIds）
//                               `-->` `<-` `<>` 是旧写法，仍然能读，但一律导出成 `->`

import { node, nodeIds, walk } from "./model.js";
import { splitStyleDecls, applyStyleDecls, styleDeclsText } from "./style.js";

export class NotationError extends Error {
  constructor(message, index = 0) {
    super(message);
    this.name = "NotationError";
    this.index = index;
  }
}

const WS = new Set([" ", "\t", "\n", "\r", "\b", "\f", "\v"]);
const CTRL = new Set(["[", "]", "^", "_", '"']);

const OPEN = "OPEN";
const CLOSE = "CLOSE";
const STRING = "STRING";
const QUOTED = "QUOTED";
const NUMBER = "NUMBER";
const SUB = "SUB";
const SUP = "SUP";
const MOVEMENT = "MOVEMENT";

const VALUE_TOKENS = new Set([STRING, QUOTED, NUMBER]);

// ---------------------------------------------------------------- 词法分析

function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (WS.has(ch)) {
      i++;
      continue;
    }
    if (ch === "[") {
      tokens.push({ type: OPEN, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: CLOSE, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "_") {
      tokens.push({ type: SUB, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "^") {
      tokens.push({ type: SUP, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === '"') {
      const close = input.indexOf('"', i + 1);
      if (close < 0) throw new NotationError('引号没有闭合', i);
      tokens.push({ type: QUOTED, value: input.slice(i + 1, close), start: i, end: close + 1 });
      i = close + 1;
      continue;
    }
    // 位移箭头默认写成 ->。`-->` `<-` `<>` 是旧写法，保留可读，一律按 -> 处理
    if (input.startsWith("-->", i)) {
      tokens.push({ type: MOVEMENT, start: i, end: i + 3 });
      i += 3;
      continue;
    }
    if (input.startsWith("->", i)) {
      tokens.push({ type: MOVEMENT, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (input.startsWith("<-", i)) {
      tokens.push({ type: MOVEMENT, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (input.startsWith("<>", i)) {
      tokens.push({ type: MOVEMENT, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i;
      while (j < input.length && input[j] >= "0" && input[j] <= "9") j++;
      tokens.push({ type: NUMBER, value: Number(input.slice(i, j)), start: i, end: j });
      i = j;
      continue;
    }

    // 裸字符串：直到空白或控制字符为止
    let j = i;
    while (j < input.length && !WS.has(input[j]) && !CTRL.has(input[j])) j++;
    tokens.push({ type: STRING, value: input.slice(i, j), start: i, end: j });
    i = j;
  }

  return tokens;
}

// ---------------------------------------------------------------- 语法分析

function parseSubSup(tokens, i) {
  const t = tokens[i];
  if (!t || (t.type !== SUB && t.type !== SUP)) return null;
  const isSup = t.type === SUP;
  const v = tokens[i + 1];
  if (!v || !VALUE_TOKENS.has(v.type))
    throw new NotationError(`"${isSup ? "^" : "_"}" 之后需要下标或上标内容`, t.start);
  return { isSup, value: String(v.value), next: i + 2 };
}

function parseNode(tokens, i) {
  const n = node("");

  const labelTok = tokens[i + 1];
  if (!labelTok || (labelTok.type !== STRING && labelTok.type !== QUOTED))
    throw new NotationError('"[" 之后需要节点标签', labelTok ? labelTok.start : tokens[i].end);
  n.label = labelTok.value;
  i += 2;

  const ss = parseSubSup(tokens, i);
  if (ss) {
    if (ss.isSup) n.sup = ss.value;
    else n.sub = ss.value;
    i = ss.next;
  }

  while (i < tokens.length && tokens[i].type !== CLOSE) {
    const t = tokens[i];
    if (t.type === OPEN) {
      const [next, child] = parseNode(tokens, i);
      n.children.push(child);
      i = next;
    } else if (t.type === STRING || t.type === QUOTED || t.type === NUMBER) {
      const [next, child] = parseValue(tokens, i);
      n.children.push(child);
      i = next;
    } else {
      throw new NotationError(`这里不该出现 "${tokenText(t)}"`, t.start);
    }
  }

  if (i >= tokens.length) throw new NotationError('缺少闭合的 "]"', tokens[tokens.length - 1].end);
  return [i + 1, n];
}

function parseValue(tokens, i) {
  const n = node("");
  const first = tokens[i];

  if (first.type === STRING) {
    // 连续的裸字符串合成一个多词标签："NP VP" 是一个叶子
    const parts = [];
    while (i < tokens.length && tokens[i].type === STRING) parts.push(tokens[i++].value);
    n.label = parts.join(" ");
  } else {
    n.label = String(first.value);
    i++;
  }

  const ss = parseSubSup(tokens, i);
  if (ss) {
    if (ss.isSup) n.sup = ss.value;
    else n.sub = ss.value;
    i = ss.next;
  }

  const t = tokens[i];
  if (t && t.type === MOVEMENT) {
    const target = tokens[i + 1];
    if (!target || target.type !== NUMBER)
      throw new NotationError("位移箭头之后需要叶子序号（->1）", t.start);
    n.arrow = { target: null, targetIndex: target.value };
    i += 2;
  }

  return [i, n];
}

function tokenText(t) {
  switch (t.type) {
    case OPEN: return "[";
    case CLOSE: return "]";
    case SUB: return "_";
    case SUP: return "^";
    case MOVEMENT: return "->";
    default: return String(t.value);
  }
}

/** 解析顶层表达式。整体必须恰好是一棵树，否则抛 NotationError */
export function parse(source) {
  // 末尾的 Italic(...) / Bold(...) 声明先切下来，剩下的才是树
  const { tree: text, decls } = splitStyleDecls(source);
  const tokens = tokenize(text);
  if (tokens.length === 0) throw new NotationError("表达式为空", 0);
  if (tokens[0].type !== OPEN) throw new NotationError('表达式必须以 "[" 开头', tokens[0].start);

  const [i, root] = parseNode(tokens, 0);
  if (i !== tokens.length)
    throw new NotationError(`位置 ${tokens[i].start} 之后有多余内容`, tokens[i].start);

  const byId = new Map();
  for (const [n, id] of nodeIds(root)) byId.set(id, n);
  walk(root, (n) => {
    if (!n.arrow) return;
    n.arrow.target = byId.get(n.arrow.targetIndex) ?? null;
  });

  applyStyleDecls(root, decls);
  return root;
}

// ---------------------------------------------------------------- 序列化

const NO_SPACE_BARE = /^[^\s\[\]^_"]+$/;

/**
 * 判断标签能不能不加引号地写出来。三种上下文规则不同：
 *
 *  mode = "node"  方括号里的节点标签。parseNode 只接受单个 STRING/QUOTED，
 *                 所以不能含空格（空格的裸标签会被切开），也不能以数字开头
 *                 （parseNode 不接受 NUMBER）。
 *  mode = "token" 下标 / 上标。parseSubSup 接受 STRING/QUOTED/NUMBER，
 *                 所以纯数字可以裸写（N_1），但 "12abc" 必须加引号，
 *                 否则会被切成 NUMBER(12) + STRING(abc)。
 *  mode = "leaf"  裸叶子。parseValue 会把连续的裸字符串合成一个多词标签，
 *                 所以空格可以不引号 —— 但这只在整段文本都能被切成 STRING
 *                 时才成立：出现数字会被切成 NUMBER，出现 -> 会被切成箭头，
 *                 这时必须退回引号形式。
 */
function needsQuote(s, mode) {
  const str = s == null ? "" : String(s);
  if (str.length === 0) return true;
  if (/[\[\]^_"]/.test(str)) return true;
  if (/^(-->|->|<-|<>)/.test(str)) return true;

  if (mode === "node") {
    if (!NO_SPACE_BARE.test(str)) return true;
    return /^\d/.test(str);
  }

  if (mode === "token") {
    if (!NO_SPACE_BARE.test(str)) return true;
    return /^\d/.test(str) && !/^\d+$/.test(str);
  }

  // mode === "leaf"
  if (/\s/.test(str)) {
    if (/[0-9]/.test(str)) return true;
    return /-->|<->|->|<-/.test(str);
  }
  return /^\d/.test(str) && !/^\d+$/.test(str);
}

function quote(s, mode = "leaf") {
  const str = s == null ? "" : String(s);
  return needsQuote(str, mode) ? `"${str}"` : str;
}

/**
 * 模型 -> 括号记法。
 * 返回 { text, spans }，其中 spans 是 Map<节点, [起始偏移, 结束偏移]>，
 * 用于把图上的选中态映射回文本框里的位置（双向编辑的关键）。
 *
 * ⚠️ 记法本身有歧义：连续的裸标签会被解析成【一个】多词叶子
 *    （[S NP VP] 解析为 S 下面挂一个叶子 "NP VP"）。
 *    所以当一个节点有多个女儿节点时，没有箭头的叶子女儿节点必须写成 [X] 的形式，
 *    否则会和邻居粘成一个叶子，往返就丢了结构。
 *    唯一例外是"唯一的女儿节点"—— 它没有邻居可粘，写成裸标签最贴近习惯写法。
 */
export function serialize(root) {
  const spans = new Map();
  const ids = nodeIds(root);

  let out = "";

  function writeNode(n, forceBracket) {
    const start = out.length;
    const isLeaf = n.children.length === 0;
    const bracketed = !isLeaf || forceBracket;

    if (bracketed) out += "[";
    out += quote(n.label, bracketed ? "node" : "leaf");

    const hasSub = n.sub != null && n.sub !== "";
    const ss = hasSub ? n.sub : n.sup != null && n.sup !== "" ? n.sup : null;
    if (ss != null) out += (hasSub ? "_" : "^") + quote(ss, "token");

    if (!isLeaf) {
      const lone = n.children.length === 1;
      for (const c of n.children) {
        out += " ";
        const childIsLeaf = c.children.length === 0;
        // 裸标签只允许两种情况：唯一的女儿节点，或带箭头的叶子节点（带箭头就没法加方括号）
        const bare = childIsLeaf && (lone || c.arrow != null);
        writeNode(c, !bare);
      }
    }

    if (bracketed) out += "]";

    if (isLeaf && n.arrow) {
      const idx = n.arrow.target ? ids.get(n.arrow.target) : n.arrow.targetIndex;
      if (idx != null) out += " ->" + idx;
    }

    spans.set(n, [start, out.length]);
  }

  writeNode(root, true);
  const decls = styleDeclsText(root);
  const body = out.replace(/\n+$/, "");
  return { text: decls ? `${body}\n${decls}` : body, spans };
}

/** 便捷函数：只要文本 */
export function toText(root) {
  return serialize(root).text;
}
