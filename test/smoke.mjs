import { parseRules, toRulesText, RuleError } from "../src/rules.js";
// 纯逻辑层冒烟测试（不需要浏览器）
//   node test/smoke.mjs
import assert from "node:assert/strict";

import {
  node,
  preorder,
  findParent,
  addChild,
  removeNode,
  moveNodeLeft,
  moveNodeRight,
  addPrimeLevel,
  canAddPrimeLevel,
  collapsePrimeLevel,
  canCollapsePrimeLevel,
  cloneSubtree,
} from "../src/model.js";
import { parse, serialize, toText, NotationError } from "../src/notation.js";
import { layout, wordNodes } from "../src/layout.js";
import { COLOR_NAMES } from "../src/style.js";

let pass = 0;
let fail = 0;

function t(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail++;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

function roundtrip(text) {
  return serialize(parse(text)).text;
}

/** 忽略 id，只比较结构 */
function dump(n) {
  return {
    label: n.label,
    sub: n.sub,
    sup: n.sup,
    arrow: n.arrow ? (n.arrow.target ? n.arrow.target.label : `#${n.arrow.targetIndex}`) : null,
    children: n.children.map(dump),
  };
}

function sameTree(a, b) {
  assert.equal(JSON.stringify(dump(parse(a))), JSON.stringify(dump(parse(b))));
}

function stable(text) {
  // 解析 -> 序列化 -> 再解析，结构必须完全一致（可能只是写法规范化）
  sameTree(text, roundtrip(text));
  // 再序列化一次必须与第一次完全相同（幂等）
  assert.equal(roundtrip(roundtrip(text)), roundtrip(text));
}

console.log("\n[括号记法：往返保真]");

t("基础嵌套", () => stable("[S [NP Dogs][VP barks]]"));
t("唯一的女儿节点叶子保持裸写", () => {
  assert.equal(roundtrip("[S NP]"), "[S NP]");
  stable("[S NP]");
});
t("多词叶子（三角）不被拆开", () => {
  assert.equal(roundtrip("[S NP VP]"), "[S NP VP]");
  stable("[S NP VP]");
});
t("多个叶子邻居必须加方括号，否则会粘成一个叶子", () => {
  const text = "[S NP VP]";
  const n = parse(text);
  assert.equal(n.children.length, 1, "记法上这就是一个叶子");
  const built = node("S", [node("NP"), node("VP")]);
  const out = serialize(built).text;
  assert.equal(out, "[S [NP] [VP]]");
  const back = parse(out);
  assert.equal(back.children.length, 2);
  assert.equal(back.children[0].label, "NP");
  assert.equal(back.children[1].label, "VP");
});
t("含数字的多词叶子必须加引号（否则被切成 NUMBER + STRING）", () => {
  const built = node("S", [node("NP 5")]);
  const out = serialize(built).text;
  assert.equal(out, '[S "NP 5"]');
  sameTree(out, out);
});
t("含箭头的多词叶子必须加引号", () => {
  const built = node("S", [node("a -> b")]);
  const out = serialize(built).text;
  assert.equal(out, '[S "a -> b"]');
  sameTree(out, out);
});
t("引号标签 + 三个叶子", () => stable('["Main clause" [S][V][O]]'));
t("下标 / 上标", () => {
  stable("[N_s Dogs]");
  stable("[N^s Cats]");
  stable("[T_2 [T past]]");
});
t("纯数字叶子无需引号", () => {
  assert.equal(roundtrip("[S 5]"), "[S 5]");
  stable("[S 5]");
});
t("数字开头的节点标签必须加引号", () => {
  const root = node("5x", [node("Y")]);
  assert.equal(serialize(root).text, '["5x" Y]');
  stable('["5x" Y]');
});
t("位移箭头", () => {
  stable("[A [B C][D E][F G ->1]]");
  // 旧写法 <-2 仍能读入，但会被规范成 ->2
  stable("[A [B C][D E][F G <-2]]");
});
t("箭头目标会跟着结构变化重新编号", () => {
  // 编号 = 第一次作为 daughter 出现的行号，根 0：
  // 词序号从 1 开始数叶子：C=1 E=2 G=3，所以 ->1 指向 C
  const root = parse("[A [B C][D E][F G ->1]]");
  const b = root.children[0];
  addChild(b, node("Z"), 0); // B 底下插一个 Z，C 的编号从 4 变成 5
  const out = serialize(root).text;
  assert.ok(out.includes("->2"), `期望 ->2，实际 ${out}`);
  const trace = preorder(parse(out)).find((n) => n.arrow);
  assert.equal(trace.arrow.target.label, "C", "箭头应该仍然指向 C");
});

console.log("\n[括号记法：错误报告]");

t("缺少闭合括号", () => assert.throws(() => parse("[S [NP]"), NotationError));
t("不以 [ 开头", () => assert.throws(() => parse("S NP]"), NotationError));
t("引号未闭合", () => assert.throws(() => parse('["abc]'), NotationError));
t("多余内容", () => assert.throws(() => parse("[S] [NP]"), NotationError));
t("女儿节点位置出现箭头", () => assert.throws(() => parse("[S ->1]"), NotationError));
t("错误位置能被定位", () => {
  try {
    parse("[S [NP]");
    assert.fail("应该抛错");
  } catch (err) {
    assert.ok(err instanceof NotationError);
    assert.equal(typeof err.index, "number");
  }
});

console.log("\n[布局]");

const measure = (text, size) => String(text).length * size * 0.6;

function layoutOf(text) {
  const root = parse(text);
  return { root, lay: layout(root, measure, {}) };
}

t("水平位置默认是「母亲节点居中」：母亲节点的中心在两端女儿节点的正中间", () => {
  const { root, lay } = layoutOf("[S [NP [D the][N dog]][VP [V barks][PP [P in][NP [N park]]]]]");
  for (const n of preorder(root)) {
    if (!n.children.length) continue;
    const first = lay.info.get(n.children[0]);
    const last = lay.info.get(n.children[n.children.length - 1]);
    const mid = (first.cx + last.cx) / 2;
    assert.ok(Math.abs(lay.info.get(n).cx - mid) < 1e-6, `节点 ${n.label} 没有落在正中间`);
  }
});

t("姊妹子树互不重叠且保持间距", () => {
  const { root, lay } = layoutOf("[S [NP [D the][N dog]][VP [V barks][PP [P in][NP [N park]]]]]");
  for (const n of preorder(root)) {
    for (let i = 1; i < n.children.length; i++) {
      const a = lay.info.get(n.children[i - 1]);
      const b = lay.info.get(n.children[i]);
      assert.ok(b.x >= a.x + a.w - 1e-9, `节点 ${n.label} 的女儿节点重叠`);
      assert.ok(b.x - (a.x + a.w) > 0, `节点 ${n.label} 的女儿节点间距丢失`);
    }
  }
});

t("深度决定纵坐标，同层等高", () => {
  const { root, lay } = layoutOf("[S [NP [D the][N dog]][VP [V barks]]]");
  for (const n of preorder(root)) {
    assert.ok(Math.abs(lay.info.get(n).y - lay.info.get(n).depth * lay.levelHeight) < 1e-9);
  }
  const leaves = preorder(root).filter((n) => !n.children.length);
  const ys = new Set(leaves.map((n) => lay.info.get(n).y));
  assert.equal(ys.size, 1, "所有叶子应该在同一水平线上");
});

t("画布尺寸覆盖全部内容", () => {
  const { root, lay } = layoutOf("[S [NP [D the][N dog]][VP [V barks]]]");
  // 量的是**可见内容**（标签占位），不是排版的分配盒
  const minX = Math.min(...lay.items.map((it) => it.cx - it.labelW / 2));
  const maxX = Math.max(...lay.items.map((it) => it.cx + it.labelW / 2));
  const maxY = Math.max(...lay.items.map((it) => it.y + lay.nodeH));
  assert.ok(minX >= -1e-9, "有内容跑到了画布左边之外");
  assert.ok(maxX <= lay.width + 1e-9);
  assert.ok(maxY <= lay.height + 1e-9);
});

console.log("\n[垂直对齐三种模式]");

// 深度：S0 A1 B2 C3 x4 D1 E2 y3
const ALIGN_TREE = "[S [A [B [C x]]] [D [E y]]]";

function rowsOf(align) {
  const root = parse(ALIGN_TREE);
  const lay = layout(root, measure, { align });
  const out = {};
  for (const [n, it] of lay.info) out[n.label] = it.row;
  return { out, lay };
}

t("按层级：每个节点在自己的层级行上", () => {
  assert.deepEqual(rowsOf("depth").out, { S: 0, A: 1, B: 2, C: 3, x: 4, D: 1, E: 2, y: 3 });
});

t("词对齐底部：叶子落到最下一行，中间节点保持层级", () => {
  assert.deepEqual(rowsOf("leaves").out, { S: 0, A: 1, B: 2, C: 3, x: 4, D: 1, E: 2, y: 4 });
});

t("整树贴底：叶子在底部，中间节点下移贴住女儿节点", () => {
  assert.deepEqual(rowsOf("compact").out, { S: 0, A: 1, B: 2, C: 3, x: 4, D: 2, E: 3, y: 4 });
});

t("非法的 align 值回退到按层级", () => {
  assert.deepEqual(rowsOf("nonsense").out, { S: 0, A: 1, B: 2, C: 3, x: 4, D: 1, E: 2, y: 3 });
});

t("整树贴底不留空行", () => {
  const { lay } = rowsOf("compact");
  const rows = [...lay.info.values()].map((it) => it.row);
  assert.equal(Math.min(...rows), 0);
  for (let r = 0; r <= lay.maxRow; r++) assert.ok(rows.includes(r), `第 ${r} 行是空的`);
});

t("三种模式下母亲节点都在女儿节点上方", () => {
  for (const align of ["depth", "leaves", "compact"]) {
    const root = parse("[S [NP [D the][N dog]][VP [V barks][PP [P in][NP [N park]]]]]");
    const lay = layout(root, measure, { align });
    for (const n of preorder(root)) {
      for (const c of n.children) {
        assert.ok(lay.info.get(c).row > lay.info.get(n).row, `${align}：${n.label} 没排在 ${c.label} 上方`);
      }
    }
  }
});

t("水平布局不受垂直对齐影响", () => {
  const root = parse(ALIGN_TREE);
  const a = layout(root, measure, { align: "depth" });
  const b = layout(root, measure, { align: "compact" });
  assert.equal(a.width, b.width);
  for (const [n, it] of a.info) {
    assert.equal(it.x, b.info.get(n).x, `${n.label} 的水平位置被对齐方式改变了`);
    assert.equal(it.cx, b.info.get(n).cx);
  }
});

console.log("\n[结构操作]");

t("邻居没有子树时不动（已并入上面的用例）", () => {
  const root = parse("[XP [D] [X']]");
  assert.equal(toText(root), "[XP [D] [X']]");
});

t("相邻姊妹换位改由 左移/右移 承担（moveSibling 已删除）", () => {
  // 原先的 Alt+↑/↓ 姊妹调序已经删掉；相邻两个姊妹换位现在走 左移 / 右移
  const root = parse("[S [A][B][C]]");
  assert.equal(moveNodeLeft(root, root.children[2]), true);
  assert.deepEqual(parse(serialize(root).text).children.map((x) => x.label), ["A", "C", "B"]);
  assert.equal(moveNodeRight(root, root.children[0]), true);
  assert.deepEqual(parse(serialize(root).text).children.map((x) => x.label), ["C", "A", "B"]);
});

t("删除节点连子树一起删，根节点删不掉", () => {
  const root = parse("[S [A [A1][A2]][B]]");
  assert.equal(removeNode(root, root), false);
  assert.equal(removeNode(root, root.children[0]), true);
  const after = parse(serialize(root).text);
  assert.deepEqual(after.children.map((x) => x.label), ["B"]);
});

t("删除会清掉指向被删叶子的箭头", () => {
  // 词序号 C=1，->1 指向 C（它在 B 的子树里）
  const root = parse("[A [B C][D E][F G ->1]]");
  const target = root.children[0].children[0];
  assert.equal(target.label, "C");
  removeNode(root, root.children[0]);
  assert.equal(parse(serialize(root).text).children.length, 2);
  let dangling = 0;
  for (const n of preorder(root)) if (n.arrow) dangling++;
  assert.equal(dangling, 0, "箭头没有被清理");
});

t("给叶子加女儿节点会清掉它自己的箭头（记法无法表达）", () => {
  const root = parse("[A [B C][D E][F G ->1]]");
  const g = root.children[2].children[0];
  assert.ok(g.arrow, "G 本来带箭头");
  addChild(g, node("H"));
  assert.equal(g.arrow, null);
});

t("findParent / preorder", () => {
  const root = parse("[S [NP [D the][N dog]][VP [V barks]]]");
  assert.equal(findParent(root, root), null);
  const d = root.children[0].children[0];
  assert.equal(findParent(root, d).label, "NP");
  assert.equal(preorder(root).length, 9);
});

console.log("\n[词的判定（「词红」按钮用）]");

// 规则：叶子 + 母亲节点的唯一的女儿节点（也就是记法里写成裸标签的那种）才算"词"
function wordsOf(text) {
  const root = parse(text);
  const lay = layout(root, measure, {});
  return [...lay.info].filter(([, it]) => it.isWord).map(([n]) => n.label);
}

t("用户给的例子：只有 word 是词", () => {
  assert.deepEqual(wordsOf("[XP [D [X'' [X word] [Y]]] [X']]"), ["word"]);
});

t("常规树：前置语法的词都是词，范畴不是", () => {
  assert.deepEqual(wordsOf("[S [NP [D the][N dog]][VP [V barks]]]"), ["the", "dog", "barks"]);
});

t("wordNodes() 和布局标记的 isWord 是同一套判定（唯一来源）", () => {
  const src = "[XP [D [X'' [X word] [Y]]] [X']]";
  assert.deepEqual(wordNodes(parse(src)).map((n) => n.label), wordsOf(src));
});

t("wordNodes() 把带位移箭头的叶子也算成词，且不会漏掉裸标签词", () => {
  const root = parse("[XP [Z word1] [X' [X word2] [Y word3 ->1]]]");
  assert.deepEqual(wordNodes(root).map((n) => n.label), ["word1", "word2", "word3"]);
});

t("wordNodes() 与箭头用的「词序号」口径不同：空范畴算词序号、不算词", () => {
  // leafOrdinals 数所有叶子（Y、X' 都算），wordNodes 只认裸标签词和带箭头的叶子
  const root = parse("[XP [D [X'' [X word] [Y]]] [X']]");
  assert.deepEqual(wordNodes(root).map((n) => n.label), ["word"]);
  assert.equal(serialize(root).text, "[XP [D [X'' [X word] [Y]]] [X']]");
});

t("方括号包起来的空节点是范畴，不是词", () => {
  assert.deepEqual(wordsOf("[S [NP][VP]]"), []);
});

t("根的唯一的女儿节点算词；根自己不算", () => {
  assert.deepEqual(wordsOf("[X word]"), ["word"]);
  assert.deepEqual(wordsOf("[X]"), []);
});

t("多词叶子（三角）算一个词", () => {
  assert.deepEqual(wordsOf("[S [NP the mailman][VP left]]"), ["the mailman", "left"]);
});

t("带箭头的叶子即便有姊妹也算词", () => {
  assert.deepEqual(wordsOf("[A [B C][D E][F G ->1]]"), ["C", "E", "G"]);
});

t("词判定是结构化性质，往返后不变", () => {
  const samples = [
    "[XP [D [X'' [X word] [Y]]] [X']]",
    "[S [NP [D the][N dog]][VP [V barks]]]",
    "[S [NP][VP]]",
    "[A [B C][D E][F G ->1]]",
  ];
  for (const text of samples) {
    const before = layout(parse(text), measure, {});
    const after = layout(parse(toText(parse(text))), measure, {});
    const wordsBefore = [...before.info].filter(([, it]) => it.isWord).map(([n]) => n.label);
    const wordsAfter = [...after.info].filter(([, it]) => it.isWord).map(([n]) => n.label);
    assert.deepEqual(wordsAfter, wordsBefore, `「${text}」往返后词判定变了`);
  }
});

console.log("\n[左移 / 右移]");

// 用户给的例子。左移和右移都各有两个分支：
//   ① 有同侧姊妹 -> 原地换位
//   ② 自己是最边上的女儿 -> 搬到母亲节点那一侧的姊妹底下
const MOVE_TREE = "[CP [C that] [TP [N Chomsky] [T' [T will] [VP [V love] [N AI]]]]]";

function moveFixture(label) {
  const root = parse(MOVE_TREE);
  let hit = null;
  (function w(n) {
    if (n.label === label && !hit) hit = n;
    for (const c of n.children) w(c);
  })(root);
  return { root, n: hit };
}

t("左移 ②：T 是最左的女儿 -> 搬到母亲节点(T')的左姊妹(N)底下，当它的最右女儿", () => {
  const { root, n } = moveFixture("T");
  assert.equal(n, root.children[1].children[1].children[0], "选中的确实是 T' 的第一个孩子");
  assert.equal(moveNodeLeft(root, n), true);
  assert.equal(toText(root), "[CP [C that] [TP [N [Chomsky] [T will]] [T' [VP [V love] [N AI]]]]]");
  assert.equal(findParent(root, n).label, "N", "妈妈变成了 N");
  assert.equal(findParent(root, n).children.at(-1), n, "T 挂在 N 的最后");
});

t("左移 ①：VP 有左姊妹 -> 原地换位", () => {
  const { root, n } = moveFixture("VP");
  assert.equal(moveNodeLeft(root, n), true);
  assert.equal(toText(root), "[CP [C that] [TP [N Chomsky] [T' [VP [V love] [N AI]] [T will]]]]");
  assert.equal(findParent(root, n).label, "T'", "妈妈没变");
});

t("右移 ①：T 有右姊妹 -> 原地换位", () => {
  const { root, n } = moveFixture("T");
  assert.equal(moveNodeRight(root, n), true);
  assert.equal(toText(root), "[CP [C that] [TP [N Chomsky] [T' [VP [V love] [N AI]] [T will]]]]");
  assert.equal(findParent(root, n).label, "T'", "妈妈没变");
});

t("右移 ②：Chomsky 是 N 的最右女儿 -> 搬到母亲节点(N)的右姊妹(T')底下，当它的最左女儿", () => {
  const { root, n } = moveFixture("Chomsky");
  assert.equal(moveNodeRight(root, n), true);
  assert.equal(toText(root), "[CP [C that] [TP [N] [T' [Chomsky] [T will] [VP [V love] [N AI]]]]]");
  assert.equal(findParent(root, n).label, "T'", "妈妈变成了 T'");
  assert.equal(findParent(root, n).children[0], n, "Chomsky 挂在 T' 的最前");
});

t("对称：左移 VP 和 右移 T 得到同一棵树", () => {
  const a = moveFixture("VP");
  moveNodeLeft(a.root, a.n);
  const b = moveFixture("T");
  moveNodeRight(b.root, b.n);
  assert.equal(toText(a.root), toText(b.root), "一对相邻姊妹，左边那个左移 == 右边那个右移");
});

t("对称：左移 T 和 右移 Chomsky 是镜像的", () => {
  const a = moveFixture("T");
  moveNodeLeft(a.root, a.n);
  const b = moveFixture("Chomsky");
  moveNodeRight(b.root, b.n);
  assert.equal(toText(a.root), "[CP [C that] [TP [N [Chomsky] [T will]] [T' [VP [V love] [N AI]]]]]");
  assert.equal(toText(b.root), "[CP [C that] [TP [N] [T' [Chomsky] [T will] [VP [V love] [N AI]]]]]");
});

t("三姊妹时，左移最右的那个变成右数第二个（中间那个）", () => {
  const root = parse("[X [A] [B] [C]]"); // X 有三个女儿 A B C
  const c = root.children[2];
  assert.equal(moveNodeLeft(root, c), true);
  assert.deepEqual(
    root.children.map((k) => k.label),
    ["A", "C", "B"],
    "C 左移后应该排在 A 和 B 中间",
  );
});

t("既没有同侧姊妹、母亲节点也没有那一侧的姊妹时不动", () => {
  // C 是 CP 的第一个孩子，挂在 C 底下的 X：没有左姊妹，母亲节点 C 也没有左姊妹
  const a = parse("[CP [C [X x]] [TP [N Chomsky]]]");
  const x = a.children[0].children[0];
  assert.equal(moveNodeLeft(a, x), false);
  assert.equal(toText(a), "[CP [C [X x]] [TP [N Chomsky]]]");

  // Z 是 Y 的唯一的女儿节点，母亲节点 Y 是最后一个 -> 没有右姊妹可去
  const b = parse("[CP [C that] [TP [N Chomsky] [Y [Z]]]]");
  const z = b.children[1].children[1].children[0];
  assert.equal(moveNodeRight(b, z), false);
});

t("根节点不能左移右移", () => {
  const root = parse(MOVE_TREE);
  assert.equal(moveNodeLeft(root, root), false);
  assert.equal(moveNodeRight(root, root), false);
});

t("两种情况都不改变被移动节点自己的子树", () => {
  for (const [fn, label] of [
    [moveNodeLeft, "T"],
    [moveNodeRight, "T"],
    [moveNodeLeft, "VP"],
    [moveNodeRight, "Chomsky"],
  ]) {
    const { root, n } = moveFixture(label);
    const before = JSON.stringify(dump(n));
    fn(root, n);
    assert.equal(JSON.stringify(dump(n)), before, `${label} 的子树被动过了`);
  }
});

t("搬到带箭头的叶子上时，那个叶子的箭头会被清掉", () => {
  // A 是个没有女儿节点的叶子，但带了位移箭头（规则记法里能出现这种组合）。
  // Y 是 B 的唯一的女儿节点 -> 走情况②，落到「B 的母亲节点 R 的左姊妹」A 底下。
  const root = parse("[R [A] [B [Y y]]]");
  const a = root.children[0];
  assert.equal(a.children.length, 0, "A 本来是没有女儿节点的叶子");
  a.arrow = { target: root, targetIndex: 0 };

  const y = root.children[1].children[0];
  assert.equal(moveNodeLeft(root, y), true);
  assert.equal(a.children.length, 1, "Y 应该挂到 A 底下");
  assert.equal(a.arrow, null, "A 有女儿节点了，箭头该被清掉");
});

console.log("\n[位移箭头：--> 是唯一写法]");

t("旧写法 --> <- <> 都能读入，统一导出成 ->", () => {
  for (const legacy of ["->1", "<-1", "<>1"]) {
    const root = parse(`[A [B C][D E][F G ${legacy}]]`);
    assert.equal(toText(root), "[A [B C] [D E] [F G ->1]]", `${legacy} 没有规范化`);
  }
});

t("-> 往返稳定", () => {
  assert.equal(toText(parse("[A [B C] [D E] [F G ->2]]")), "[A [B C] [D E] [F G ->2]]");
});

t("以 -> 开头的标签必须加引号", () => {
  const root = parse('[A "->x"]');
  assert.equal(root.children[0].label, "->x");
  // 唯一的女儿节点叶子写成裸标签，但它以 -> 开头，所以必须加引号
  assert.equal(toText(root), '[A "->x"]');
  assert.equal(toText(parse(toText(root))), '[A "->x"]');
});

console.log("\n[斜体 / 粗体 / 删除线]");

t("三种字体样式都能声明，互相独立", () => {
  const root = parse("[vP [v [V know]] [pro [N him]]]\nItalic(1)\nStrike(2)");
  const byLabel = (l) => preorder(root).find((x) => x.label === l);
  assert.equal(byLabel("v").italic, true);
  assert.equal(byLabel("v").strike, false);
  assert.equal(byLabel("pro").strike, true);
  assert.equal(byLabel("pro").italic, false);
});

t("删除线在括号记法和规则记法里都能往返", () => {
  const src = "[vP [v [V know]]]\nStrike(1)";
  assert.equal(toText(parse(src)), src);
  const rules = "0 vP -> v\n1 v -> V\n\nStrike(1)";
  assert.equal(toRulesText(parseRules(rules)), rules);
});

t("三种样式按 Italic / Bold / Strike 的顺序导出", () => {
  const root = parse("[XP [A] [B]]\nStrike(1)\nBold(2)\nItalic(2)");
  assert.ok(toText(root).endsWith("Italic(2)\nBold(2)\nStrike(1)"), toText(root));
});

t("声明词大小写不敏感，导出统一成首字母大写", () => {
  const root = parse("[XP [A] [B]]\nITALIC(1)\nbold(2)\nsTrIkE(1)");
  const byLabel = (l) => preorder(root).find((x) => x.label === l);
  assert.equal(byLabel("A").italic, true);
  assert.equal(byLabel("A").strike, true);
  assert.equal(byLabel("B").bold, true);
  assert.ok(toText(root).endsWith("Italic(1)\nBold(2)\nStrike(1)"), toText(root));
});

console.log("\n[颜色声明]");

t("Red(节点号) 能设置颜色，且在两套记法里往返", () => {
  const src = "[CP [NP what_i] [C' [C is_j]]]\nRed(3)\nBlue(4)";
  const root = parse(src);
  assert.equal(preorder(root).find((n) => n.label === "what").color, "red");
  assert.equal(preorder(root).find((n) => n.label === "C").color, "blue");
  assert.equal(toText(root), src);
  const rules = "0 CP -> NP\n0 CP -> C'\n1 NP -> what_i\n2 C' -> C\n\nRed(3)";
  assert.equal(toRulesText(parseRules(rules)), rules);
});

t("一种颜色一行，多个编号收在同一对括号里，和 Italic(1, 3) 同形", () => {
  const root = parse("[XP [A] [B] [C]]\nRed(3, 1)");
  assert.equal(preorder(root).find((n) => n.label === "A").color, "red");
  assert.equal(preorder(root).find((n) => n.label === "B").color, null);
  assert.equal(preorder(root).find((n) => n.label === "C").color, "red");
  assert.ok(toText(root).endsWith("Red(1, 3)"), toText(root));
});

t("九种颜色名都被接受，写大写也能认，导出统一成首字母大写", () => {
  // 颜色名单只有一份：src/style.js 的 COLOR_NAMES
  for (const name of COLOR_NAMES) {
    const root = parse(`[XP [A] [B]]\n${name.toUpperCase()}(1)`);
    assert.equal(preorder(root).find((n) => n.label === "A").color, name, name);
    const canonical = name.charAt(0).toUpperCase() + name.slice(1) + "(1)";
    assert.ok(toText(root).endsWith(canonical), `${name} 导出成了：${toText(root)}`);
  }
});

t("同一个节点被两条颜色声明命中时，靠后的那条有效，冗余声明不再导出", () => {
  // 颜色是"一个节点一个颜色"，所以前一条声明是冗余的
  const root = parse("[XP [A] [B]]\nRed(1)\nBlue(1)");
  assert.equal(preorder(root).find((n) => n.label === "A").color, "blue");
  assert.ok(toText(root).endsWith("Blue(1)"), toText(root));
});

t("颜色名不认识时不再静默忽略 —— 那一行不算声明，会被当成树的内容", () => {
  assert.throws(() => parse("[XP [A] [B]]\nChartreuse(1)"), NotationError);
});

t("一个节点可以同时有颜色和字体样式", () => {
  const root = parse("[XP [A] [B]]\nItalic(1)\nStrike(1)\nGreen(1)");
  const a = preorder(root).find((n) => n.label === "A");
  assert.equal(a.italic, true); assert.equal(a.strike, true); assert.equal(a.color, "green");
});

t("颜色声明排在字体声明之后，颜色之间按固定顺序", () => {
  const root = parse("[XP [A] [B] [C]]\nBlue(3)\nRed(1)\nItalic(2)");
  assert.ok(toText(root).endsWith("Italic(2)\nRed(1)\nBlue(3)"), toText(root));
});

console.log("\n[水平位置：母亲节点居中]");

t("根节点整体居中模式：母亲节点居中于所有女儿节点的包围盒", () => {
  const root = parse("[XP [A the] [B extraordinarily-long-word] [C x]]");
  const info = layout(root, (t) => String(t).length * 8, { center: "block" }).info;
  const it = info.get(root);
  const kids = root.children.map((c) => info.get(c));
  const left = kids[0].x;
  const right = kids[kids.length - 1].x + kids[kids.length - 1].w;
  assert.ok(Math.abs(it.cx - (left + right) / 2) < 1e-9, "根节点整体居中模式应该居中于包围盒");
  // 女儿节点宽度不等时，它和最左/最右女儿的中点并不重合
  const mid = (kids[0].cx + kids[kids.length - 1].cx) / 2;
  assert.ok(Math.abs(it.cx - mid) > 1, "这个例子里两种模式本来就应该不一样");
});

t("母亲节点居中模式：母亲节点的中心 = 最左和最右女儿节点中心的中点", () => {
  const root = parse("[XP [A the] [B extraordinarily-long-word] [C x]]");
  const info = layout(root, (t) => String(t).length * 8, { center: "mother" }).info;
  for (const n of preorder(root)) {
    if (!n.children.length) continue;
    const it = info.get(n);
    const first = info.get(n.children[0]);
    const last = info.get(n.children[n.children.length - 1]);
    assert.equal(it.cx, (first.cx + last.cx) / 2, `${n.label} 没有落在正中间`);
  }
});

t("只有一个女儿节点时，两种模式一致", () => {
  const root = parse("[XP [A [B [C x]]]]");
  const a = layout(root, (t) => String(t).length * 8, { center: "default" }).info;
  const b = layout(root, (t) => String(t).length * 8, { center: "mother" }).info;
  for (const n of preorder(root)) assert.equal(a.get(n).cx, b.get(n).cx);
});

t("未知的 center 值退回默认的母亲节点居中", () => {
  const root = parse("[XP [A x] [B y]]");
  const bad = layout(root, (t) => String(t).length * 8, { center: "nonsense" }).info;
  const dflt = layout(root, (t) => String(t).length * 8, {}).info;
  for (const n of preorder(root)) assert.equal(bad.get(n).cx, dflt.get(n).cx);
});

console.log("\n[投射层：下移 / 上移]");

t("下移：返回选中节点的副本，它比原来深一层", () => {
  const root = parse("[XP [Z word1] [X'' [X' [X word2]]]]");
  const x = preorder(root).find((n) => n.label === "X");
  assert.equal(canAddPrimeLevel(root, x), true);
  const copy = addPrimeLevel(root, x);
  assert.equal(copy.label, "X", "副本保留原来的标签");
  assert.notEqual(copy, x, "返回的是副本，不是原来那个节点对象");
  assert.equal(preorder(root).filter((n) => n.label === "X").length, 1, "树里只有一个 X");
  // 拷贝出来的那条链：X'''(套上去的) -> X''(副本) -> X'(副本) -> X(副本)
  assert.equal(findParent(root, copy).label, "X'");
  assert.equal(findParent(root, findParent(root, copy)).label, "X''");
  assert.equal(root.children[1].label, "X'''", "套上去的那一层占着链顶原来的位置");
  assert.equal(toText(root), "[XP [Z word1] [X''' [X'' [X' [X word2]]]]]");
});

t("下移：选链顶时，返回的就是那一层的副本（新层里面那个）", () => {
  const root = parse("[XP [Z word1] [X'' [X' [X word2]]]]");
  const top = preorder(root).find((n) => n.label === "X''");
  const copy = addPrimeLevel(root, top);
  assert.equal(copy.label, "X''");
  assert.equal(root.children[1].children[0], copy, "它就是新层唯一的女儿节点");
});

t("下移：整棵子树原样下沉，链顶其余的女儿节点不被提到新层", () => {
  const root = parse("[XP [Z word1] [X' [X word2] [Y word3]]]");
  const x = preorder(root).find((n) => n.label === "X");
  const copy = addPrimeLevel(root, x);
  assert.equal(toText(root), "[XP [Z word1] [X'' [X' [X word2] [Y word3]]]]");
  const wrapper = findParent(root, findParent(root, copy)); // copy -> X'(副本) -> X''(套上去的)
  assert.equal(wrapper.children.length, 1, "新层只有副本这一个女儿节点");
  assert.equal(wrapper.children[0].label, "X'");
  assert.deepEqual(findParent(root, copy).children.map((c) => c.label), ["X", "Y"], "副本把 X 和 Y 都带走了");
  // Y 还在 X'（副本）底下，只是跟着整棵子树深了一层
  const y = preorder(wrapper).find((n) => n.label === "Y");
  assert.equal(findParent(root, y).label, "X'");
});

t("下移：新层顶替链顶的位置，而不是紧挨着选中节点", () => {
  const root = parse("[XP [Z word1] [X'' [X' [X word2]]]]");
  const x = preorder(root).find((n) => n.label === "X");
  const copy = addPrimeLevel(root, x);
  // 插入点是 XP 底下、原来 X'' 的位置
  assert.equal(root.children[1].label, "X'''");
  assert.equal(root.children[1].children[0].label, "X''");
  // 副本内部原封不动：X'' -> X' -> X -> word2
  assert.equal(findParent(root, copy).label, "X'");
  assert.equal(findParent(root, findParent(root, copy)).label, "X''");
});

t("下移：副本里的节点都是新 id，不会和原节点撞车", () => {
  const root = parse("[XP [Z word1] [X' [X word2] [Y word3]]]");
  const x = preorder(root).find((n) => n.label === "X");
  const oldIds = new Set(preorder(root).map((n) => n.id));
  const copy = addPrimeLevel(root, x);
  const ids = preorder(root).map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "同一棵树里不该出现重复 id");
  for (const n of preorder(copy)) assert.ok(!oldIds.has(n.id), `${n.label} 复用了旧 id`);
});

t("下移：箭头跟着副本（词）走，加了撇的原节点清掉箭头", () => {
  const root = parse("[S [N Dogs] [V barks ->1]]");
  const barks = preorder(root).find((n) => n.label === "barks");
  const copy = addPrimeLevel(root, barks);
  assert.equal(findParent(root, copy).label, "barks'");
  assert.equal(findParent(root, copy).arrow, null, "有女儿节点了，记法表达不了带箭头的非叶子");
  assert.ok(copy.arrow, "箭头应该跟着词走");
  assert.equal(copy.arrow.target.label, "Dogs");
  assert.equal(toText(root), "[S [N Dogs] [V [barks' barks ->1]]]");
});

t("下移：落点落在被复制子树里的箭头，会改指到副本上（不会丢箭头）", () => {
  const root = parse("[XP [N word1 ->2] [X' [X word2] [Y word3]]]");
  const x = preorder(root).find((n) => n.label === "X");
  const copy = addPrimeLevel(root, x);
  const withArrow = preorder(root).find((n) => n.arrow);
  assert.ok(withArrow, "箭头不该被丢掉");
  const leaf = preorder(copy).find((n) => n.label === "word2");
  assert.equal(withArrow.arrow.target, leaf, "落点应该改指到副本里的那个 word2");
  assert.equal(toText(root), "[XP [N word1 ->2] [X'' [X' [X word2] [Y word3]]]]");
});

t("连按两次会再加一层（每次作用在下移后选中的那个副本上）", () => {
  const root = parse("[XP [Z word1] [X'' [X' [X word2]]]]");
  let sel = preorder(root).find((n) => n.label === "X");
  sel = addPrimeLevel(root, sel); // 返回副本，编辑器会选中它
  sel = addPrimeLevel(root, sel);
  assert.equal(toText(root), "[XP [Z word1] [X'''' [X''' [X'' [X' [X word2]]]]]]");
});

t("上移（用户给的例子）：删掉紧挨着自己上面的那层", () => {
  const root = parse("[XP [Z wordZ] [X'' [X' [Y wordY] [X wordX]]]]");
  const xp = preorder(root).find((n) => n.label === "X'");
  assert.equal(canCollapsePrimeLevel(root, xp), true);
  const next = collapsePrimeLevel(root, xp);
  assert.equal(next, root, "母亲节点不是根，根不变");
  assert.equal(toText(root), "[XP [Z wordZ] [X' [Y wordY] [X wordX]]]");
});

t("上移之后，母亲节点以上的每一层都要减一个撇（用户给的例子）", () => {
  const root = parse("[CP [C that] [TP [N Chomsky] [T'' [T' [T will]] [V]]]]");
  const t = preorder(root).find((n) => n.label === "T");
  assert.equal(collapsePrimeLevel(root, t), root);
  // T' 被删掉、T 提上去，上面的 T'' 顺势改名成 T'
  assert.equal(toText(root), "[CP [C that] [TP [N Chomsky] [T' [T will] [V]]]]");
});

t("撇更多时，上面的每一层依次减一个", () => {
  const root = parse("[TP [T'''' [T''' [T'' [T' [T will]]]]]]");
  const t = preorder(root).find((n) => n.label === "T");
  collapsePrimeLevel(root, t);
  assert.equal(toText(root), "[TP [T''' [T'' [T' [T will]]]]]");
});

t("上移要求：母亲节点是唯一的女儿节点 + 母亲节点标签 = 自己 + 一个撇", () => {
  const root = parse("[XP [Z wordZ] [X'' [X' [Y wordY] [X wordX]]]]");
  // X''：母亲节点 XP 有两个女儿
  assert.equal(canCollapsePrimeLevel(root, preorder(root).find((n) => n.label === "X''")), false);
  // X：母亲节点 X' 有两个女儿
  assert.equal(canCollapsePrimeLevel(root, preorder(root).find((n) => n.label === "X")), false);
  // X'：母亲节点 X'' 只有它一个，且 X'' == X' + "'"
  assert.equal(canCollapsePrimeLevel(root, preorder(root).find((n) => n.label === "X'")), true);
});

t("母亲节点标签对不上时也不能上移", () => {
  // N 只有一个女儿 X，但 N != X + "'"
  const root = parse("[S [N [X word]]]");
  const x = preorder(root).find((n) => n.label === "X");
  assert.equal(canCollapsePrimeLevel(root, x), false);
  assert.equal(collapsePrimeLevel(root, x), null);
});

t("下移之后对副本做上移，能回到原样", () => {
  const original = "[XP [Z word1] [X'' [X' [X word2]]]]";
  const root = parse(original);
  const x = preorder(root).find((n) => n.label === "X");
  const copy = addPrimeLevel(root, x);
  assert.equal(toText(root), "[XP [Z word1] [X''' [X'' [X' [X word2]]]]]");
  // 该选谁很明确：副本的母亲正好是下移造出来的那一层
  assert.equal(collapsePrimeLevel(root, copy), root);
  assert.equal(toText(root), original);
});

t("母亲节点就是根时，上移会让选中的节点变成新的根", () => {
  // 根 X'' 正是 X' 加一个撇，所以 X' 可以顶掉它
  const root = parse("[X'' [X' [X word]]]");
  const xp = preorder(root).find((n) => n.label === "X'");
  assert.equal(canCollapsePrimeLevel(root, xp), true);
  const next = collapsePrimeLevel(root, xp);
  assert.equal(next.label, "X'", "X' 应该成为新的根");
  assert.equal(toText(next), "[X' [X word]]");
});

t("链顶就是根时无法下移", () => {
  const root = parse("[X' [X word]]");
  const x = preorder(root).find((n) => n.label === "X");
  assert.equal(canAddPrimeLevel(root, x), false);
  assert.equal(addPrimeLevel(root, x), null);
  assert.equal(toText(root), "[X' [X word]]");
});

t("不在加撇链上的节点：把自己套一层，副本成为唯一的女儿", () => {
  // N 不是 Chomsky 的加撇形式，链就是 [Chomsky] 自己
  const root = parse("[S [N Chomsky] [V barks]]");
  const c = preorder(root).find((n) => n.label === "Chomsky");
  assert.equal(canAddPrimeLevel(root, c), true);
  const copy = addPrimeLevel(root, c);
  assert.equal(copy.label, "Chomsky", "副本保留原来的标签");
  assert.equal(findParent(root, copy).label, "Chomsky'", "套上去的那一层加了撇");
  assert.equal(toText(root), "[S [N [Chomsky' Chomsky]] [V barks]]");
});

t("cloneSubtree()：深拷贝、发新 id、箭头另存一份", () => {
  const root = parse("[S [N word1] [X' [X word2 ->1]]]");
  const xp = preorder(root).find((n) => n.label === "X'");
  const arrowNode = preorder(root).find((n) => n.arrow);
  const { root: copy, map } = cloneSubtree(xp);

  assert.deepEqual(
    preorder(copy).map((n) => n.label),
    preorder(xp).map((n) => n.label),
    "结构应当一模一样",
  );
  assert.equal(map.get(xp), copy, "对照表要能查到自己");
  const oldNodes = new Set(preorder(root));
  const copies = [...map.values()];
  for (const n of preorder(copy)) {
    assert.ok(!oldNodes.has(n), "副本不该复用原来的节点对象");
    assert.ok(copies.includes(n), "副本里的节点都该在对照表里");
  }
  const ids = preorder(copy).map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "副本内部 id 不能重复");

  const arrowCopy = preorder(copy).find((n) => n.arrow);
  assert.ok(arrowCopy, "箭头要跟着拷过来");
  assert.notEqual(arrowCopy.arrow, arrowNode.arrow, "箭头对象要另存一份");
  assert.equal(arrowCopy.arrow.target, arrowNode.arrow.target, "落点先原样带着，重挂交给调用方");
});

console.log("\n[转义节点 %Empty]");

t("裸写的 %Empty 是转义节点，能往返", () => {
  const src = "[A [%Empty [B] [C]]]";
  const root = parse(src);
  const e = root.children[0];
  assert.equal(e.label, "%Empty");
  assert.equal(e.escape, true);
  assert.equal(toText(root), src);
  // 规则记法里也认，而且往返一致
  const rules = "0 A -> %Empty\n1 %Empty -> B\n1 %Empty -> C";
  const fromRules = parseRules(rules);
  assert.equal(fromRules.children[0].escape, true);
  assert.equal(toRulesText(fromRules), rules);
});

t("带引号的 \"%Empty\" 只是普通标签，往返不会被引号吃掉", () => {
  const root = parse('["%Empty" [B] [C]]');
  assert.equal(root.escape, false, "带引号的不是转义节点");
  assert.equal(toText(root), '["%Empty" [B] [C]]', "导出必须带引号，否则再解析就变成转义节点了");
  const back = parse(toText(root));
  assert.equal(back.escape, false);
});

t("只认精确的 %Empty：大小写和 &Empty 都是普通标签", () => {
  for (const label of ["%empty", "%EMPTY", "&Empty"]) {
    const root = parse(`[A [${label} [B] [C]]]`);
    assert.ok(!root.children[0].escape, `${label} 不该被当成转义节点`);
  }
});

t("转义节点必须有女儿节点（不能出现在树底）", () => {
  assert.throws(() => parse("[A [%Empty]]"), NotationError, "方括号里什么都不挂");
  assert.throws(() => parse("[A %Empty]"), NotationError, "裸标签形式");
  assert.throws(() => parseRules("0 A -> %Empty"), RuleError);
});

t("转义节点最多三个女儿节点", () => {
  assert.equal(parse("[A [%Empty [B] [C] [D]]]").children[0].children.length, 3, "三个可以");
  assert.throws(() => parse("[A [%Empty [B] [C] [D] [E]]]"), NotationError);
  assert.throws(() => parseRules("0 A -> %Empty\n1 %Empty -> B\n1 %Empty -> C\n1 %Empty -> D\n1 %Empty -> E"), RuleError);
});

console.log("\n[文本 <-> 图的定位映射]");

t("spans 覆盖整段文本且逐层嵌套", () => {
  const root = parse("[S [NP [D the][N dog]][VP [V barks]]]");
  const { text, spans } = serialize(root);
  const rootSpan = spans.get(root);
  assert.equal(rootSpan[0], 0);
  assert.equal(rootSpan[1], text.length);
  for (const n of preorder(root)) {
    const [s, e] = spans.get(n);
    assert.ok(s >= rootSpan[0] && e <= rootSpan[1]);
    for (const c of n.children) {
      const [cs, ce] = spans.get(c);
      assert.ok(cs >= s && ce <= e, `女儿节点 ${c.label} 的区间没有嵌在母亲节点之内`);
    }
  }
});

t("偏移能定位到最内层节点", () => {
  const root = parse("[S [NP [D the][N dog]][VP [V barks]]]");
  const { text, spans } = serialize(root);
  const at = text.indexOf("dog") + 1;
  let best = null;
  let bestLen = Infinity;
  for (const [n, [s, e]] of spans) {
    if (at >= s && at <= e && e - s < bestLen) {
      best = n;
      bestLen = e - s;
    }
  }
  assert.equal(best.label, "dog");
});

console.log(`\n${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
