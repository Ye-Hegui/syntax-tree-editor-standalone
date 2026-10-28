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

import { node, nodeIds, walk, ESCAPE_LABEL, isEscapeLabel } from "./model.js";
import { splitStyleDecls, applyStyleDecls, styleDeclsText } from "./style.js";

/**
 * 叶子节点的「词序号」：从左到右第几个词，从 1 开始。
 *
 * 这是 jsSyntaxTree 的箭头编号方式（它管这叫 column number），**只有括号记法的箭头用它**。
 * 节点编号（根 0，见 model.js 的 nodeIds）仍然用于：
 *   - 样式声明 Italic / Bold / Strike / Color（两套记法都用它）
 *   - 规则记法的全部编号
 */
function leafOrdinals(root) {
  const byNode = new Map();
  const byIndex = new Map();
  let n = 0;
  walk(root, (x) => {
    if (x.children.length) return;
    byNode.set(x, ++n);
    byIndex.set(n, x);
  });
  return { byNode, byIndex };
}

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
const SUB_TEXT = "SUB_TEXT"; // <sub>…</sub> 里的内容
const SUP_TEXT = "SUP_TEXT"; // <sup>…</sup> 里的内容
const MOVEMENT = "MOVEMENT";

const VALUE_TOKENS = new Set([STRING, QUOTED, NUMBER]);

// ---------------------------------------------------------------- 下标 / 上标

/**
 * 下标的两种写法：
 *   N_s                      `_` 后面跟一个 token（老写法，留着兼容）
 *   N<sub>s</sub>            显式的开始 / 结束记号 —— 内容可以含空格、`_`、`^`、逗号……
 *
 * 上标同理（`^s` / `N<sup>s</sup>`）。一个节点可以**同时**有下标和上标，两种写法可以混用，
 * 顺序随意（`N<sub>i</sub>^2` 与 `N^2<sub>i</sub>` 等价）。每种最多写一次。
 *
 * ⚠️ 记号一律**小写**、必须成对；`"%Empty"` 那种引号里的一切都是普通文字，
 * 所以 `"a<sub>b</sub>"` 是一个标签为 `a<sub>b</sub>` 的节点。
 */
export const SUB_OPEN = "<sub>";
export const SUB_CLOSE = "</sub>";
export const SUP_OPEN = "<sup>";
export const SUP_CLOSE = "</sup>";

const TAG_OPENERS = [
  { open: SUB_OPEN, close: SUB_CLOSE, type: SUB_TEXT, sup: false },
  { open: SUP_OPEN, close: SUP_CLOSE, type: SUP_TEXT, sup: true },
];

/** 标签文本里出现这些就算"像记号"，整体必须加引号，否则再解析回来会被当成下标 */
const TAG_LIKE = new RegExp(
  [SUB_OPEN, SUB_CLOSE, SUP_OPEN, SUP_CLOSE].map((s) => s.replace(/[/]/g, "\\/")).join("|"),
);

/** 把下标/上标写成规范的记号形式（只写有内容的那个/那些） */
export function subSupText(n) {
  let out = "";
  if (n.sub != null && n.sub !== "") out += SUB_OPEN + n.sub + SUB_CLOSE;
  if (n.sup != null && n.sup !== "") out += SUP_OPEN + n.sup + SUP_CLOSE;
  return out;
}

/**
 * 把 `X<sub>i</sub><sup>2</sup>` 这种"标签+下标/上标"的文字拆成 { label, sub, sup }。
 *
 * 用在改名框与 `setLabel()`（图形界面要能加下标）。和记法里的解析不同，这里
 * **宽松**：写不成记号的部分就当普通标签文字（举例：正打到一半的 `X<sub>` 先当标签），
 * 这样边打字边重绘不会报错、也不会把已输入的内容吞掉。
 */
export function parseLabelSpec(text) {
  const raw = String(text ?? "");
  const out = { label: "", sub: null, sup: null };
  let i = 0;
  let label = "";
  while (i < raw.length) {
    // 引号里的一切都算标签文字（和记法里的引号规则一致）
    if (raw[i] === '"') {
      const end = raw.indexOf('"', i + 1);
      if (end < 0) {
        label += raw.slice(i + 1);
        i = raw.length;
        break;
      }
      label += raw.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (raw[i] === "_" || raw[i] === "^") {
      // 老写法：_x / ^x（读到空白或下一个记号为止，和规则记法一致）
      const isSup = raw[i] === "^";
      let j = i + 1;
      const startsTag = (at) => TAG_OPENERS.some((t) => raw.startsWith(t.open, at));
      while (j < raw.length && !/\s/.test(raw[j]) && raw[j] !== "_" && raw[j] !== "^" && !startsTag(j)) j++;
      const v = raw.slice(i + 1, j).trim();
      if (v !== "") {
        if (isSup) out.sup = v;
        else out.sub = v;
        i = j;
        continue;
      }
    }
    const tag = TAG_OPENERS.find((t) => raw.startsWith(t.open, i));
    if (tag) {
      const end = raw.indexOf(tag.close, i + tag.open.length);
      if (end < 0) {
        // 还没写完（正在打字）：先原样当标签文字
        label += raw.slice(i);
        i = raw.length;
        break;
      }
      const v = raw.slice(i + tag.open.length, end).trim();
      if (tag.sup) out.sup = v === "" ? null : v;
      else out.sub = v === "" ? null : v;
      i = end + tag.close.length;
      continue;
    }
    label += raw[i];
    i++;
  }
  out.label = label;
  return out;
}

/** { label, sub, sup } -> 规范文字（标签该加引号就加，下标/上标一律写成记号形式） */
export function labelSpecText(spec, mode = "node") {
  const label = String(spec.label ?? "");
  return quote(label, mode, isEscapeLabel(label) && !spec.escape) + subSupText(spec);
}


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
    // <sub>…</sub> / <sup>…</sup>：整个连内容一起读成一个 token（内容里可以有空格）
    if (ch === "<") {
      const tag = TAG_OPENERS.find((t) => input.startsWith(t.open, i));
      if (tag) {
        const bodyStart = i + tag.open.length;
        const end = input.indexOf(tag.close, bodyStart);
        if (end < 0) throw new NotationError(`"${tag.open}" 没有闭合（要写成 ${tag.open}…${tag.close}）`, i);
        tokens.push({ type: tag.type, value: input.slice(bodyStart, end), start: i, end: end + tag.close.length });
        i = end + tag.close.length;
        continue;
      }
      const stray = TAG_OPENERS.find((t) => input.startsWith(t.close, i));
      if (stray) throw new NotationError(`多余的 "${stray.close}"（前面没有 ${stray.open}）`, i);
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

    // 裸字符串：直到空白、控制字符或下标/上标记号为止
    let j = i;
    while (j < input.length && !WS.has(input[j]) && !CTRL.has(input[j])) {
      if (input[j] === "<" && TAG_OPENERS.some((t) => input.startsWith(t.open, j) || input.startsWith(t.close, j)))
        break;
      j++;
    }
    tokens.push({ type: STRING, value: input.slice(i, j), start: i, end: j });
    i = j;
  }

  return tokens;
}

// ---------------------------------------------------------------- 语法分析

/**
 * 读标签后面的一串下标/上标：`_x` / `^x` / `<sub>…</sub>` / `<sup>…</sup>`，
 * 可以混用、顺序随意，每种最多一次。没有就返回 null。
 */
function parseSubSup(tokens, i) {
  const out = { sub: null, sup: null };
  let j = i;
  let seen = false;
  while (j < tokens.length) {
    const t = tokens[j];
    let isSup;
    let value;
    if (t.type === SUB || t.type === SUP) {
      isSup = t.type === SUP;
      const v = tokens[j + 1];
      if (!v || !VALUE_TOKENS.has(v.type))
        throw new NotationError(`"${isSup ? "^" : "_"}" 之后需要下标或上标内容`, t.start);
      value = String(v.value);
      j += 2;
    } else if (t.type === SUB_TEXT || t.type === SUP_TEXT) {
      isSup = t.type === SUP_TEXT;
      value = String(t.value).trim();
      if (value === "") throw new NotationError(`"${isSup ? SUP_OPEN : SUB_OPEN}" 里没有内容`, t.start);
      j += 1;
    } else {
      break;
    }
    if (isSup) {
      if (out.sup != null) throw new NotationError("上标只能写一次", t.start);
      out.sup = value;
    } else {
      if (out.sub != null) throw new NotationError("下标只能写一次", t.start);
      out.sub = value;
    }
    seen = true;
  }
  return seen ? { sub: out.sub, sup: out.sup, next: j } : null;
}

function parseNode(tokens, i) {
  const n = node("");

  const labelTok = tokens[i + 1];
  if (!labelTok || (labelTok.type !== STRING && labelTok.type !== QUOTED))
    throw new NotationError('"[" 之后需要节点标签', labelTok ? labelTok.start : tokens[i].end);
  n.label = labelTok.value;
  // 裸写的 %Empty（后面可以跟任意个撇，见 isEscapeLabel）是转义节点；
  // 写成 "%Empty"（带引号）只是一个普通标签
  if (labelTok.type === STRING && isEscapeLabel(n.label)) n.escape = true;
  i += 2;

  const ss = parseSubSup(tokens, i);
  if (ss) {
    n.sub = ss.sub;
    n.sup = ss.sup;
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

  // 转义节点的两条限制（作者定的）：不能出现在树底，最多三个女儿节点
  if (n.escape) {
    if (!n.children.length)
      throw new NotationError(`"${ESCAPE_LABEL}" 必须有女儿节点（转义节点不能出现在树底）`, labelTok.start);
    if (n.children.length > 3)
      throw new NotationError(`"${ESCAPE_LABEL}" 最多三个女儿节点，这里有 ${n.children.length} 个`, labelTok.start);
  }

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
    // 裸写的 %Empty（可带撇）是转义节点，而裸标签一定是叶子 —— 叶子就是"在树底"，直接报错
    if (isEscapeLabel(n.label))
      throw new NotationError(`"${ESCAPE_LABEL}" 必须有女儿节点（转义节点不能出现在树底）`, first.start);
  } else {
    n.label = String(first.value);
    i++;
  }

  const ss = parseSubSup(tokens, i);
  if (ss) {
    n.sub = ss.sub;
    n.sup = ss.sup;
    i = ss.next;
  }

  const t = tokens[i];
  if (t && t.type === MOVEMENT) {
    const target = tokens[i + 1];
    if (!target || target.type !== NUMBER)
      throw new NotationError("位移箭头之后需要叶子序号（->1）", t.start);
    n.arrow = { target: null, targetIndex: target.value, start: t.start };
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
    case SUB_TEXT: return SUB_OPEN + t.value + SUB_CLOSE;
    case SUP_TEXT: return SUP_OPEN + t.value + SUP_CLOSE;
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

  // 括号记法箭头里的数字是「词序号」（jsSyntaxTree 的 column number），不是节点编号
  const leaves = leafOrdinals(root);
  walk(root, (n) => {
    if (!n.arrow) return;
    const target = leaves.byIndex.get(n.arrow.targetIndex);
    if (!target)
      throw new NotationError(
        `位移箭头里的 ${n.arrow.targetIndex} 不是有效的词序号。词从 1 开始数，这棵树共有 ${leaves.byNode.size} 个词`,
        n.arrow.start ?? 0,
      );
    n.arrow.target = target;
    n.arrow.targetIndex = leaves.byNode.get(target);
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
  if (TAG_LIKE.test(str)) return true; // 含 <sub> 之类：不加引号会被当成下标/上标
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

function quote(s, mode = "leaf", force = false) {
  const str = s == null ? "" : String(s);
  return force || needsQuote(str, mode) ? `"${str}"` : str;
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
  const leafIdx = leafOrdinals(root); // 箭头的词序号表

  let out = "";

  function writeNode(n, forceBracket) {
    const start = out.length;
    const isLeaf = n.children.length === 0;
    const bracketed = !isLeaf || forceBracket;

    if (bracketed) out += "[";
    // 标签正好是 %Empty 又不是转义节点时，必须带引号写，否则再解析回来就变成转义节点了
    out += quote(n.label, bracketed ? "node" : "leaf", isEscapeLabel(n.label) && !n.escape);
    // 下标 / 上标一律写成显式记号（作者 2026-09-30 定的规范形式），两种可以同时存在
    out += subSupText(n);

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
      const idx = n.arrow.target ? leafIdx.byNode.get(n.arrow.target) : n.arrow.targetIndex;
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
