// 规则记法（一行一条 mother -> daughter）的测试
//   node test/rules.test.mjs
import assert from "node:assert/strict";

import { nodeIds, preorder } from "../src/model.js";
import { parse, toText } from "../src/notation.js";
import { parseRules, serializeRules, toRulesText, RuleError } from "../src/rules.js";

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

/**
 * 编号 = 第一次作为 daughter 出现的行号，根节点 0
 *
 *   1  0 XP -> D       D  = 1
 *   2  0 XP -> X'      X' = 2
 *   3  1 D -> w1       w1 = 3
 *   4  2 X' -> X       X  = 4
 *   5  2 X' -> Y       Y  = 5
 *   6  4 X -> w2       w2 = 6
 *   7  5 Y -> w3       w3 = 7
 */
// 注意：行号不在文本里，由编辑器左侧的装订线显示
const USER_RULES = [
  "0 XP -> D",
  "0 XP -> X'",
  "1 D -> w1",
  "2 X' -> X",
  "2 X' -> Y",
  "4 X -> w2",
  "5 Y -> w3",
].join("\n");

const USER_TREE = "[XP [D w1] [X' [X w2] [Y w3]]]";

console.log("\n[解析：规则记法 -> 模型]");

t("用户给的例子解析成预期的树", () => {
  assert.equal(toText(parseRules(USER_RULES)), USER_TREE);
});

t("编号 = 第一次出现在箭头右边的那一行的行号，根节点是 0", () => {
  const root = parseRules(USER_RULES);
  const ids = nodeIds(root);
  assert.equal(ids.get(root), 0);
  const byLabel = {};
  for (const [n, id] of ids) byLabel[n.label] = id;
  assert.deepEqual(byLabel, { XP: 0, D: 1, "X'": 2, w1: 3, X: 4, Y: 5, w2: 6, w3: 7 });
});

t("第一个子节点就是第 1 行出现的，所以编号是 1", () => {
  const root = parseRules(USER_RULES);
  assert.equal(root.children[0].label, "D");
  assert.equal(nodeIds(root).get(root.children[0]), 1);
});

t("文本里不带行号（行号由装订线显示）", () => {
  assert.ok(!/^\s*\d+\s+\d+\s/.test(USER_RULES), "测试数据里不该有行号列");
  assert.equal(USER_RULES.split("\n")[0], "0 XP -> D");
});

t("兼容从别处粘来的带行号文本：能读，但结构由行的先后决定", () => {
  const withNumbers = USER_RULES.split("\n")
    .map((l, i) => `${i + 1}  ${l}`)
    .join("\n");
  assert.equal(toText(parseRules(withNumbers)), USER_TREE);

  // 行号写歪了也不影响结构
  const wrong = withNumbers.replace(/^1\s/, "99 ");
  assert.equal(toText(parseRules(wrong)), USER_TREE);
});

t("第一行的妈妈必须是根（0）", () => {
  try {
    parseRules("1 D -> w1");
    assert.fail("应该抛错");
  } catch (err) {
    assert.ok(err instanceof RuleError);
    assert.match(err.message, /第一行/);
  }
});

t("引用一个既没出现过、标签也对不上的节点会报错", () => {
  try {
    parseRules("0 XP -> D\n5 ZZ -> x");
    assert.fail("应该抛错");
  } catch (err) {
    assert.ok(err instanceof RuleError);
    assert.match(err.message, /还没出现过/);
  }
});

t("编号写歪但标签能对上时会被宽松接受（编辑器靠它自动修编号）", () => {
  // 上面插了一行之后，下面这行的编号会错位；按标签找回来
  const root = parseRules("0 X'' -> X'\n0 X'' -> Z\n1 X' -> X\n2 X -> w2");
  assert.equal(toText(root), "[X'' [X' [X w2]] [Z]]");
});

t("编号和标签都对不上时报错", () => {
  try {
    parseRules("0 XP -> D\n1 ZZ -> x");
    assert.fail("应该抛错");
  } catch (err) {
    assert.ok(err instanceof RuleError);
    assert.match(err.message, /找不到标签/);
  }
});

t("妈妈的 daughter 不再要求连续（编号是显式的，顺序无所谓）", () => {
  const scattered = ["0 XP -> D", "1 D -> w1", "0 XP -> X'"].join("\n");
  assert.equal(toText(parseRules(scattered)), "[XP [D w1] [X']]");
});

t("空输入报错", () => {
  assert.throws(() => parseRules(""), RuleError);
  assert.throws(() => parseRules("   \n  \n"), RuleError);
});

t("缺少箭头会报错并指出行号", () => {
  try {
    parseRules("0 XP -> D\n1 D w1");
    assert.fail("应该抛错");
  } catch (err) {
    assert.ok(err instanceof RuleError);
    assert.equal(err.line, 2);
  }
});

t("位移箭头两边必须是编号", () => {
  assert.throws(() => parseRules("0 XP -> D\nXP --> D"), RuleError);
});

console.log("\n[位移箭头]");

t("7 --> 6：起点是 w3，落点是 w2", () => {
  const root = parseRules(`${USER_RULES}\n\n7 --> 6`);
  const ids = nodeIds(root);
  const byId = new Map([...ids].map(([n, id]) => [id, n]));
  assert.equal(byId.get(7).label, "w3");
  assert.equal(byId.get(6).label, "w2");
  assert.equal(byId.get(7).arrow.target, byId.get(6));
});

t("落点可以是任何节点，包括根（0）", () => {
  const root = parseRules(`${USER_RULES}\n\n7 --> 0`);
  const byId = new Map([...nodeIds(root)].map(([n, id]) => [id, n]));
  assert.equal(byId.get(7).arrow.target, root);
});

t("起点必须是叶子", () => {
  try {
    parseRules(`${USER_RULES}\n\n0 --> 7`);
    assert.fail("应该抛错");
  } catch (err) {
    assert.ok(err instanceof RuleError);
    assert.match(err.message, /叶子/);
  }
});

t("箭头编号不存在会报错", () => {
  assert.throws(() => parseRules(`${USER_RULES}\n\n7 --> 99`), RuleError);
  assert.throws(() => parseRules(`${USER_RULES}\n\n99 --> 7`), RuleError);
});

t("括号记法和规则记法用的是同一套编号", () => {
  const fromRules = parseRules(`${USER_RULES}\n\n7 --> 6`);
  const fromBracket = parse(toText(fromRules));
  // 箭头挂在 w3 上，编号 6 = w2，两套记法数字一致
  assert.equal(toText(fromBracket), "[XP [D w1] [X' [X w2] [Y w3 ->2]]]");
  const pick = (root) => preorder(root).filter((n) => n.arrow).map((n) => n.arrow.target.label);
  assert.deepEqual(pick(fromBracket), ["w2"]);
  assert.deepEqual(pick(fromRules), ["w2"]);
});

t("括号记法里写 ->2 也能正确落到 w2", () => {
  const root = parse("[XP [D w1] [X' [X w2] [Y w3 ->2]]]");
  const byId = new Map([...nodeIds(root)].map(([n, id]) => [id, n]));
  assert.equal(byId.get(6).label, "w2");
  assert.equal(preorder(root).find((n) => n.arrow).arrow.target, byId.get(6));
});

console.log("\n[序列化：模型 -> 规则记法]");

t("输出不带行号，只有「妈妈编号 标签 -> 子标签」", () => {
  const rows = toRulesText(parse(USER_TREE))
    .split("\n")
    .map((l) => l.split(/\s+/));
  assert.deepEqual(rows, [
    ["0", "XP", "->", "D"],
    ["0", "XP", "->", "X'"],
    ["1", "D", "->", "w1"],
    ["2", "X'", "->", "X"],
    ["2", "X'", "->", "Y"],
    ["4", "X", "->", "w2"],
    ["5", "Y", "->", "w3"],
  ]);
});

t("文本里没有行号列，复制出来是干净的", () => {
  const out = toRulesText(parse(USER_TREE));
  for (const line of out.split("\n")) {
    const [first, second] = line.split(/\s+/);
    assert.match(first, /^\d+$/, `第一个 token 应该是妈妈编号：${line}`);
    assert.ok(!/^\d+$/.test(second), `第二个 token 不该是数字（那会是行号）：${line}`);
  }
});

t("装订线数出来的行号 = 节点编号", () => {
  // 编辑器的装订线就是按"第几条边"数出来的，这里验证同一条规则
  const out = toRulesText(parse(USER_TREE));
  const edgeLines = out.split("\n").filter((l) => l.includes("->") && !l.includes("-->"));
  assert.equal(edgeLines.length, 7);
  const ids = [...nodeIds(parse(USER_TREE)).values()].sort((a, b) => a - b);
  assert.deepEqual(ids, [0, 1, 2, 3, 4, 5, 6, 7]);
  // 第 i 条边引入的节点编号就是 i
  const root = parse(USER_TREE);
  const byId = new Map([...nodeIds(root)].map(([n, id]) => [id, n]));
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((i) => byId.get(i).label),
    ["D", "X'", "w1", "X", "Y", "w2", "w3"],
  );
});

t("往返：解析 -> 序列化 -> 再解析，结构不变", () => {
  const once = toText(parseRules(USER_RULES));
  const twice = toText(parseRules(toRulesText(parseRules(USER_RULES))));
  assert.equal(twice, once);
});

t("叶子不会被单独写成 mother", () => {
  const out = toRulesText(parse(USER_TREE));
  const motherIds = out.split("\n").map((l) => l.split(/\s+/)[0]);
  for (const leafId of ["3", "6", "7"]) {
    assert.ok(!motherIds.includes(leafId), `叶子 ${leafId} 出现在妈妈位置`);
  }
});

t("位移箭头单独放在最后", () => {
  const out = toRulesText(parse("[A [B C] [D E] [F G ->1]]"));
  const lines = out.split("\n");
  assert.ok(lines[lines.length - 1].includes("-->"), "箭头应该是最后一行");
  assert.ok(out.includes("\n\n"), "箭头前面应该空一行");
});

t("含空格的标签在规则记法里会加引号，且能往返", () => {
  const root = parse('[S [NP "the mailman"]]');
  const out = toRulesText(root);
  assert.ok(out.includes('"the mailman"'), `没有加引号：${out}`);
  assert.equal(toText(parseRules(out)), toText(root));
});

t("下标 / 上标不会在规则记法里丢失", () => {
  const samples = ["[CP [TP [NP_1 [D the][N dog]]]]", "[N^s Cats]", '[TP [NP_2 "the mailman"]]'];
  for (const text of samples) {
    const direct = toText(parse(text));
    const viaRules = toText(parseRules(toRulesText(parse(text))));
    assert.equal(viaRules, direct, `「${text}」经规则记法往返后变了`);
  }
});

t("下标的写法：NP_1 / N^s / \"the mailman\"_1", () => {
  assert.equal(toRulesText(parse("[TP [NP_1 x]]")), "0 TP -> NP_1\n1 NP_1 -> x");
  assert.equal(toRulesText(parse("[TP [N^s x]]")), "0 TP -> N^s\n1 N^s -> x");
  assert.equal(
    toRulesText(parse('[TP [NP_2 "the mailman"]]')),
    '0 TP -> NP_2\n1 NP_2 -> "the mailman"',
  );
});

t("各种真实树都能往返", () => {
  const samples = [
    "[S [NP [D the][N dog]][VP [V barks]]]",
    "[CP [C that][TP [NP_1 [D the][N dog]][T' [T past][VP [V bark][NP the mailman]]]]]",
    "[A [B C][D E] [F G ->1]]",
    "[S [NP][VP]]",
    "[XP [D [X'' [X word] [Y]]] [X']]",
  ];
  for (const text of samples) {
    const direct = toText(parse(text));
    const viaRules = toText(parseRules(toRulesText(parse(text))));
    assert.equal(viaRules, direct, `「${text}」经规则记法往返后变了`);
  }
});

t("spans 能定位到节点", () => {
  const root = parse(USER_TREE);
  const { text, spans } = serializeRules(root);
  const w3 = preorder(root).find((n) => n.label === "w3");
  const [s, e] = spans.get(w3);
  assert.equal(text.slice(s, e), "w3");
});

t("孤立节点（没有边）在规则记法里是空的", () => {
  assert.equal(toRulesText(parse("[S]")), "");
});

console.log(`\n${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
