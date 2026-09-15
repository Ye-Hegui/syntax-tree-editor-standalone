// 交互层端到端测试（跑在 dom-shim 上）
//   node test/editor.test.mjs
import assert from "node:assert/strict";

import { installDom, makeEvent } from "./dom-shim.mjs";

installDom();
const { SyntaxTreeEditor } = await import("../src/editor.js");
const { preorder } = await import("../src/model.js");
const { ALIGN_MODES } = await import("../src/layout.js");

let pass = 0;
let fail = 0;

async function t(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail++;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mount(value, options) {
  const host = document.createElement("div");
  return new SyntaxTreeEditor(host, { value, ...options });
}

function nodeGroups(ed) {
  return ed.svg.querySelectorAll(".ste-node");
}

function hitRectOf(ed, node) {
  const g = nodeGroups(ed).find((x) => Number(x.dataset.id) === node.id);
  assert.ok(g, `找不到节点 ${node.label} 的 <g>`);
  return g.children[0]; // 透明命中矩形
}

function clickNode(ed, node) {
  hitRectOf(ed, node).dispatchEvent(makeEvent("pointerdown"));
}

function dblClickNode(ed, node) {
  hitRectOf(ed, node).dispatchEvent(makeEvent("dblclick"));
}

function key(ed, k, props = {}) {
  ed.scroller.dispatchEvent(makeEvent("keydown", { key: k, ...props }));
}

function typeText(ed, text, caret) {
  ed.textarea.value = text;
  ed.textarea.selectionStart = caret ?? text.length;
  ed.textarea.selectionEnd = caret ?? text.length;
  ed.textarea.dispatchEvent(makeEvent("input"));
}

const NODES_IN = (text) => text.replace(/[^\[\]]/g, "").length / 2 + 1;

console.log("\n[挂载与渲染]");

await t("构造后建好 DOM、画布和文本面板", async () => {
  const ed = mount("[S [A][B]]");
  assert.ok(ed.el.classList.contains("ste"));
  assert.ok(ed.svg, "缺少 svg");
  assert.ok(ed.textarea, "缺少 textarea");
  assert.equal(ed.textarea.value, "[S [A] [B]]", "文本面板没有同步成规范化写法");
});

await t("每个节点都渲染成一个可命中的 <g>", async () => {
  const ed = mount("[S [NP [D the][N dog]][VP [V barks]]]");
  assert.equal(nodeGroups(ed).length, 9);
  assert.equal(ed.svg.querySelectorAll(".ste-hit").length, 9);
});

await t("节点文字与 data-id 正确", async () => {
  const ed = mount("[S [NP Dogs][VP barks]]");
  const labels = nodeGroups(ed).map((g) => g.querySelector("text").textContent);
  assert.deepEqual(labels, ["S", "NP", "Dogs", "VP", "barks"]);
  const ids = nodeGroups(ed).map((g) => Number(g.dataset.id));
  assert.equal(new Set(ids).size, ids.length, "data-id 有重复");
});

await t("画布尺寸覆盖整棵树的包围盒", async () => {
  const ed = mount("[S [NP [D the][N dog]][VP [V barks]]]");
  const right = Math.max(...ed.lay.items.map((it) => it.cx + it.labelW / 2));
  const bottom = Math.max(...ed.lay.items.map((it) => it.y + ed.lay.nodeH));
  assert.ok(ed.size.width >= right, "画布宽度不够");
  assert.ok(ed.size.height >= bottom, "画布高度不够");
});

await t("母亲节点在真实布局里也居中于女儿节点", async () => {
  const ed = mount("[S [NP [D the][N dog]][VP [V barks][PP [P in][NP [N park]]]]]");
  for (const n of preorder(ed.root)) {
    if (!n.children.length) continue;
    const first = ed.lay.info.get(n.children[0]);
    const last = ed.lay.info.get(n.children[n.children.length - 1]);
    assert.ok(Math.abs(ed.lay.info.get(n).cx - (first.cx + last.cx) / 2) < 1e-6);
  }
});

console.log("\n[鼠标交互]");

await t("点击节点选中它", async () => {
  const ed = mount("[S [A][B]]");
  const b = ed.root.children[1];
  clickNode(ed, b);
  assert.equal(ed.selected, b);
  const g = nodeGroups(ed).find((x) => Number(x.dataset.id) === b.id);
  assert.ok(g.classList.contains("is-selected"), "选中高亮没有加上");
  const others = nodeGroups(ed).filter((x) => Number(x.dataset.id) !== b.id);
  assert.ok(others.every((x) => !x.classList.contains("is-selected")));
});

await t("点击空白处取消选中", async () => {
  const ed = mount("[S [A][B]]");
  clickNode(ed, ed.root.children[0]);
  ed.svg.dispatchEvent(makeEvent("pointerdown"));
  assert.equal(ed.selected, null);
});

await t("切换选中不重建 SVG（否则浏览器双击事件会丢）", async () => {
  const ed = mount("[S [A][B]]");
  const a = ed.root.children[0];
  const before = nodeGroups(ed).find((x) => Number(x.dataset.id) === a.id);
  clickNode(ed, a);
  const after = nodeGroups(ed).find((x) => Number(x.dataset.id) === a.id);
  assert.equal(after, before, "选中时重建了 SVG，双击改名会因此永远触发不了");
  assert.ok(after.classList.contains("is-selected"));

  // 第二次点击同一节点也不该重建
  clickNode(ed, a);
  assert.equal(nodeGroups(ed).find((x) => Number(x.dataset.id) === a.id), before);
});

await t("双击节点打开内联改名框，值与位置正确", async () => {
  const ed = mount("[S [A][B]]");
  const a = ed.root.children[0];
  dblClickNode(ed, a);
  assert.equal(ed.input.hidden, false, "输入框没有出现");
  assert.equal(ed.input.value, "A");
  assert.ok(ed.input.style.left.endsWith("px"));
  assert.ok(ed.input.style.top.endsWith("px"));
});

console.log("\n[内联改名]");

await t("边打字边重排，提交后文本同步", async () => {
  const ed = mount("[S [A][B]]");
  const a = ed.root.children[0];
  dblClickNode(ed, a);
  ed.input.value = "NP";
  ed.input.dispatchEvent(makeEvent("input"));
  assert.equal(a.label, "NP", "改名没有立刻写进模型");
  assert.equal(ed.getValue(), "[S [NP] [B]]");
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" }));
  assert.equal(ed.input.hidden, true, "提交后输入框没有隐藏");
  assert.equal(ed.textarea.value, "[S [NP] [B]]");
});

await t("Esc 取消改名并还原标签", async () => {
  const ed = mount("[S [A][B]]");
  const a = ed.root.children[0];
  dblClickNode(ed, a);
  ed.input.value = "ZZZ";
  ed.input.dispatchEvent(makeEvent("input"));
  assert.equal(a.label, "ZZZ");
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Escape" }));
  assert.equal(ed.root.children[0].label, "A", "标签没有还原");
  assert.equal(ed.input.hidden, true);
  assert.equal(ed.getValue(), "[S [A] [B]]");
});

await t("空白标签也能提交", async () => {
  const ed = mount("[S [A][B]]");
  const a = ed.root.children[0];
  dblClickNode(ed, a);
  ed.input.value = "";
  ed.input.dispatchEvent(makeEvent("input"));
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" }));
  assert.equal(ed.root.children[0].label, "");
  assert.equal(ed.getValue(), '[S [""] [B]]');
});

await t("标签里的双引号会被剔除（记法里无法转义）", async () => {
  const ed = mount("[S [A][B]]");
  dblClickNode(ed, ed.root.children[0]);
  ed.input.value = 'a"b';
  ed.input.dispatchEvent(makeEvent("input"));
  assert.equal(ed.input.value, "ab");
  assert.equal(ed.root.children[0].label, "ab");
});

console.log("\n[键盘结构编辑]");

await t("Tab 下移：加一层投射（用户给的例子）", async () => {
  const ed = mount("[XP [Z word1] [X'' [X' [X word2]]]]");
  const x = preorder(ed.root).find((n) => n.label === "X");
  clickNode(ed, x);
  key(ed, "Tab");
  assert.equal(ed.getValue(), "[XP [Z word1] [X''' [X'' [X' [X word2]]]]]");
  assert.equal(ed.selected, x, "选中不该变（还是原来那个 X）");
});

await t("Tab 连按两次会再加一层", async () => {
  const ed = mount("[XP [Z word1] [X'' [X' [X word2]]]]");
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X"));
  key(ed, "Tab");
  key(ed, "Tab");
  assert.equal(ed.getValue(), "[XP [Z word1] [X'''' [X''' [X'' [X' [X word2]]]]]]");
});

await t("Shift+Tab 上移：删掉紧挨着自己上面的那层投射（用户给的例子）", async () => {
  const ed = mount("[XP [Z wordZ] [X'' [X' [Y wordY] [X wordX]]]]");
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X'"));
  key(ed, "Tab", { shiftKey: true });
  assert.equal(ed.getValue(), "[XP [Z wordZ] [X' [Y wordY] [X wordX]]]");
});

await t("Shift+Tab 只在母亲节点是「唯一的女儿节点 + 加一个撇」时才允许", async () => {
  const ed = mount("[XP [Z wordZ] [X'' [X' [Y wordY] [X wordX]]]]");
  // X''：母亲节点 XP 有两个女儿 -> 不行
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X''"));
  assert.equal(ed.btnCollapseLevel.disabled, true, "母亲节点 XP 还有别的女儿");
  // X：母亲节点 X' 有两个女儿 -> 不行
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X"));
  assert.equal(ed.btnCollapseLevel.disabled, true, "母亲节点 X' 还有别的女儿");
  // X'：母亲节点 X'' 只有它一个女儿，且 X'' == X' + "'" -> 可以
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X'"));
  assert.equal(ed.btnCollapseLevel.disabled, false);
});

await t("Tab 之后对链顶 Shift+Tab 能回到原样", async () => {
  const original = "[XP [Z word1] [X'' [X' [X word2]]]]";
  const ed = mount(original);
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X"));
  key(ed, "Tab");
  assert.equal(ed.getValue(), "[XP [Z word1] [X''' [X'' [X' [X word2]]]]]");
  // 链顶现在是 X''（Tab 就是插在它上面的）
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X''"));
  key(ed, "Tab", { shiftKey: true });
  assert.equal(ed.getValue(), original, "应该完全回到原样");
});

await t("Tab 不适用时（链顶就是根）按钮禁用、按键无效", async () => {
  const ed = mount("[X' [X word]]"); // 链顶 X' 就是根，上面没地方插
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X"));
  assert.equal(ed.btnAddLevel.disabled, true);
  const before = ed.getValue();
  key(ed, "Tab");
  assert.equal(ed.getValue(), before);
});

await t("Tab 下移可以撤销", async () => {
  const ed = mount("[XP [Z word1] [X'' [X' [X word2]]]]");
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X"));
  key(ed, "Tab");
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), "[XP [Z word1] [X'' [X' [X word2]]]]");
});

await t("上移后母亲节点以上的每一层都减一个撇（用户给的例子）", async () => {
  const ed = mount("[CP [C that] [TP [N Chomsky] [T'' [T' [T will]] [V]]]]");
  clickNode(ed, preorder(ed.root).find((n) => n.label === "T"));
  key(ed, "Tab", { shiftKey: true });
  assert.equal(ed.getValue(), "[CP [C that] [TP [N Chomsky] [T' [T will] [V]]]]");
});

await t("第一个姊妹节点无法上移（不产生历史）", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  const before = ed.undoStack.length;
  ed.collapseLevel();
  assert.equal(ed.getValue(), "[S [A] [B]]");
  assert.equal(ed.undoStack.length, before, "无效操作不该压入历史");
});

await t("Enter 加女儿并直接进入改名", async () => {
  const ed = mount("[S [A][B]]");
  clickNode(ed, ed.root.children[1]);
  key(ed, "Enter");
  assert.equal(ed.getValue(), "[S [A] [B X]]");
  assert.equal(ed.input.hidden, false, "加完女儿节点应该直接可以改名");
  assert.equal(ed.input.value, "X");
});

await t("Shift+Enter 加姊妹", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Enter", { shiftKey: true });
  assert.equal(ed.getValue(), "[S [A] [X] [B]]");
  assert.equal(ed.input.hidden, false);
});

await t("Insert 键不再有任何作用", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  const before = ed.getValue();
  key(ed, "Insert");
  assert.equal(ed.getValue(), before, "Insert 应该被彻底移除");
});

await t("Ctrl+Enter 等同于 Enter（加女儿节点）", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Enter", { ctrlKey: true });
  assert.equal(ed.getValue(), "[S [A X] [B]]");
});

await t("根节点上 Shift+Enter 退化成加女儿", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root);
  key(ed, "Enter", { shiftKey: true });
  assert.equal(ed.getValue(), "[S [A] [B] [X]]");
});

await t("F2 改名", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "F2");
  assert.equal(ed.input.hidden, false);
  assert.equal(ed.input.value, "A");
});

await t("删除节点连子树一起删", async () => {
  const ed = mount("[S [NP [D the][N dog]][VP [V barks]]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Delete");
  assert.equal(ed.getValue(), "[S [VP [V barks]]]");
  assert.equal(ed.selected, ed.root.children[0], "删除后应选中邻近节点");
});

await t("根节点删不掉", async () => {
  const ed = mount("[S [A][B]]");
  clickNode(ed, ed.root);
  key(ed, "Delete");
  assert.equal(ed.getValue(), "[S [A] [B]]");
});

await t("Alt+↑/↓ 已删除，不再有任何作用", async () => {
  const ed = mount("[S [A] [B] [C]]");
  clickNode(ed, ed.root.children[2]);
  const before = ed.getValue();
  key(ed, "ArrowUp", { altKey: true });
  key(ed, "ArrowDown", { altKey: true });
  assert.equal(ed.getValue(), before, "Alt+上下的功能应该已经彻底删掉");
});

await t("方向键：↑ 母亲 · ↓ 最左女儿 · ←→ 姊妹与堂表姊妹", async () => {
  const ed = mount("[S [NP [D the] [N dog]] [VP [V barks]]]");
  const at = (label) => assert.equal(ed.selected.label, label);
  const go = (k) => key(ed, k);

  clickNode(ed, ed.root); // S
  go("ArrowDown"); at("NP");
  go("ArrowDown"); at("D");
  go("ArrowRight"); at("N");

  // N 是 NP 最右边的女儿，再往右应该跨到堂表姊妹 V（NP 的右姊妹 VP 的第一个女儿）
  go("ArrowRight"); at("V");
  // 跨回来落在最靠近的那个堂表姊妹 —— NP 的最后一个女儿 N
  go("ArrowLeft"); at("N");

  go("ArrowLeft"); at("D");
  go("ArrowLeft"); at("D"); // 整棵树最左，停住

  go("ArrowUp"); at("NP");
  go("ArrowUp"); at("S");
  go("ArrowUp"); at("S"); // 根节点没有母亲节点，停住

  go("ArrowDown"); at("NP");
  go("ArrowRight"); at("VP");
  go("ArrowDown"); at("V");
  go("ArrowDown"); at("barks");
  go("ArrowUp"); at("V");
});

console.log("\n[撤销 / 重做]");

await t("撤销与重做结构改动", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]); // A，在它后面插一个姊妹
  key(ed, "Enter", { shiftKey: true });
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" })); // 先提交改名
  assert.equal(ed.getValue(), "[S [A] [X] [B]]");

  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), "[S [A] [B]]");
  key(ed, "z", { ctrlKey: true, shiftKey: true }); // Ctrl+Shift+Z 重做
  assert.equal(ed.getValue(), "[S [A] [X] [B]]");
});

await t("Ctrl+Y 不再是重做", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[1]);
  key(ed, "Enter", { shiftKey: true });
  key(ed, "z", { ctrlKey: true });
  const undone = ed.getValue();
  key(ed, "y", { ctrlKey: true });
  assert.equal(ed.getValue(), undone, "Ctrl+Y 不该再触发重做");
});

await t("撤销改名只回退一次（整段输入算一步）", async () => {
  const ed = mount("[S [A][B]]");
  dblClickNode(ed, ed.root.children[0]);
  ed.input.value = "";
  ed.input.dispatchEvent(makeEvent("input"));
  ed.input.value = "NP";
  ed.input.dispatchEvent(makeEvent("input"));
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" }));
  assert.equal(ed.getValue(), "[S [NP] [B]]");
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), "[S [A] [B]]", "应当一步回到改名之前");
});

await t("没有改动就提交不会留下垃圾历史", async () => {
  const ed = mount("[S [A][B]]");
  const before = ed.undoStack.length;
  dblClickNode(ed, ed.root.children[0]);
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" }));
  assert.equal(ed.undoStack.length, before);
});

console.log("\n[文本 <-> 图 双向同步]");

await t("改代码 -> 图跟着重绘", async () => {
  const ed = mount("[S [A][B]]");
  typeText(ed, "[S [NP Dogs][VP barks]]");
  await sleep(300);
  assert.equal(nodeGroups(ed).length, 5);
  assert.deepEqual(ed.root.children.map((c) => c.label), ["NP", "VP"]);
  assert.equal(ed.errBox.textContent, "");
});

await t("改代码时光标位置决定选中哪个节点", async () => {
  const ed = mount("[S [A][B]]");
  const target = "[S [NP Dogs] [VP barks]]";
  typeText(ed, target, target.indexOf("Dogs") + 1);
  await sleep(300);
  assert.equal(ed.selected.label, "Dogs");
});

await t("代码非法时保留上一棵好树并报错", async () => {
  const ed = mount("[S [A][B]]");
  const before = ed.getValue();
  const countBefore = nodeGroups(ed).length;
  typeText(ed, "[S [NP");
  await sleep(300);
  assert.ok(ed.errBox.textContent.length > 0, "没有给出错误信息");
  assert.ok(ed.errBox.classList.contains("is-visible"));
  assert.equal(ed.getValue(), before, "非法输入不应破坏模型");
  assert.equal(nodeGroups(ed).length, countBefore);
});

await t("改回合法后错误提示消失", async () => {
  const ed = mount("[S [A][B]]");
  typeText(ed, "[S [NP");
  await sleep(300);
  typeText(ed, "[S [NP Dogs]]");
  await sleep(300);
  assert.equal(ed.errBox.textContent, "");
  assert.equal(nodeGroups(ed).length, 3);
});

await t("图上改动会回写文本，代码改动不会反过来覆盖光标", async () => {
  const ed = mount("[S [A][B]]");
  clickNode(ed, ed.root.children[1]);
  key(ed, "Enter", { ctrlKey: true });
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" }));
  assert.equal(ed.textarea.value, "[S [A] [B X]]");

  // 手打一个"非规范化"但合法的写法，图应该跟着变，文本不该被覆盖
  typeText(ed, "[S [A][B]]");
  await sleep(300);
  assert.equal(ed.textarea.value, "[S [A][B]]", "文本被覆盖了，光标会被打断");
  assert.equal(ed.root.children.length, 2);
});

await t("点文本框能把图上选中同步过去", async () => {
  const ed = mount("[S [A][B]]");
  const norm = ed.getValue();
  ed.textarea.value = norm;
  ed.textarea.selectionStart = norm.indexOf("B") + 1;
  ed.textarea.selectionEnd = ed.textarea.selectionStart;
  ed.textarea.dispatchEvent(makeEvent("click"));
  assert.equal(ed.selected.label, "B");
});

console.log("\n[其他]");

await t("范畴按钮套用标签", async () => {
  const ed = mount("[S [A][B]]");
  clickNode(ed, ed.root.children[0]);
  ed.setLabel("VP");
  assert.equal(ed.getValue(), "[S [VP] [B]]");
  assert.equal(ed.selected, ed.root.children[0], "套标签不该改变选中");
});

await t("setOptions 改字号会重排", async () => {
  const ed = mount("[S [A][B]]");
  const w1 = ed.size.width;
  ed.setOptions({ fontSize: 32 });
  assert.ok(ed.size.width > w1, "字号变大后画布应该变宽");
});

await t("getValue 的输出总能重新解析（幂等）", async () => {
  const ed = mount("[A [B C][D E][F G ->1]]");
  const once = ed.getValue();
  ed.setValue(once);
  assert.equal(ed.getValue(), once);
});

await t("导出 SVG 覆盖所有节点且不带选中高亮", async () => {
  const ed = mount("[S [NP Dogs][VP barks]]");
  clickNode(ed, ed.root);
  const svg = ed.toSvgString({ background: true });
  assert.equal((svg.match(/class="ste-node"/g) || []).length, 5);
  assert.equal((svg.match(/is-selected/g) || []).length, 0, "选中高亮不该被导出");
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('fill="#ffffff"'), "PNG 背景矩形缺失");
});

await t("空标签的树也能画出来", async () => {
  const ed = mount("[S X]");
  ed.setLabel("");
  assert.equal(nodeGroups(ed).length, 2);
});

console.log("\n[空白画布：从零开始画]");

await t("可以直接从空白起步", async () => {
  const ed = mount("");
  assert.equal(ed.isEmpty, true);
  assert.equal(ed.root, null);
  assert.equal(nodeGroups(ed).length, 0);
  assert.equal(ed.textarea.value, "");
  assert.equal(ed.getValue(), "");
  assert.equal(ed.placeholder.hidden, false, "空白画布上应该显示引导层");
});

await t("点画布任意处就创建根节点并进入改名", async () => {
  const ed = mount("");
  ed.scroller.dispatchEvent(makeEvent("pointerdown"));
  assert.ok(ed.root, "没有创建根节点");
  assert.equal(ed.root.label, "S");
  assert.equal(nodeGroups(ed).length, 1);
  assert.equal(ed.placeholder.hidden, true, "有树之后引导层应该消失");
  assert.equal(ed.input.hidden, false, "应该直接进入改名");
  assert.equal(ed.input.value, "S");
});

await t("重复点不会创建第二个根节点", async () => {
  const ed = mount("");
  ed.scroller.dispatchEvent(makeEvent("pointerdown"));
  const first = ed.root;
  ed.scroller.dispatchEvent(makeEvent("pointerdown"));
  assert.equal(ed.root, first);
  assert.equal(nodeGroups(ed).length, 1);
});

await t("Enter 键也能在空白画布上起步", async () => {
  const ed = mount("");
  key(ed, "Enter");
  assert.equal(ed.root.label, "S");
  assert.equal(ed.input.hidden, false);
});

await t("空白画布上点范畴按钮直接起一棵树", async () => {
  const ed = mount("");
  ed.setLabel("CP");
  assert.equal(ed.root.label, "CP");
  assert.equal(ed.getValue(), "[CP]");
});

await t("清空代码框回到空白画布", async () => {
  const ed = mount("[S [A][B]]");
  typeText(ed, "");
  await sleep(300);
  assert.equal(ed.isEmpty, true);
  assert.equal(nodeGroups(ed).length, 0);
  assert.equal(ed.placeholder.hidden, false);
});

await t("从空白画布一路长出一棵树", async () => {
  const ed = mount("");
  ed.scroller.dispatchEvent(makeEvent("pointerdown")); // 创建根 S，进入改名
  ed.input.value = "S";
  ed.input.dispatchEvent(makeEvent("input"));
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" })); // 提交

  key(ed, "Enter", { ctrlKey: true }); // 给 S 加女儿节点 X
  ed.input.value = "NP";
  ed.input.dispatchEvent(makeEvent("input"));
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" }));

  ed.addSibling(); // 在 NP 后面加姊妹
  ed.input.value = "VP";
  ed.input.dispatchEvent(makeEvent("input"));
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" }));

  assert.equal(ed.getValue(), "[S [NP] [VP]]");
  assert.equal(nodeGroups(ed).length, 3);
});

await t("空白画布也能撤销回去", async () => {
  const ed = mount("");
  ed.scroller.dispatchEvent(makeEvent("pointerdown"));
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Escape" })); // 取消改名，标签回到 S
  assert.equal(ed.getValue(), "[S]");
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.isEmpty, true, "撤销应该回到空白画布");
  assert.equal(ed.placeholder.hidden, false);
});

await t("删掉没有女儿节点的根节点 = 回到空白画布", async () => {
  const ed = mount("[S]");
  clickNode(ed, ed.root);
  assert.equal(ed.btnDelete.disabled, false, "单节点根应该允许删");
  key(ed, "Delete");
  assert.equal(ed.isEmpty, true);
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), "[S]");
});

await t("删掉只有一个女儿节点的根节点 = 把女儿节点提上来", async () => {
  const ed = mount("[S [NP [D the][N dog]]]");
  clickNode(ed, ed.root);
  assert.equal(ed.btnDelete.disabled, false);
  key(ed, "Delete");
  assert.equal(ed.getValue(), "[NP [D the] [N dog]]");
  assert.equal(ed.selected, ed.root);
  assert.equal(ed.root.label, "NP");
});

await t("根节点有多个分支时不允许删（避免丢数据）", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root);
  assert.equal(ed.btnDelete.disabled, true, "多分支的根应该禁掉删除按钮");
  const before = ed.getValue();
  key(ed, "Delete");
  assert.equal(ed.getValue(), before, "结构不该变");
});

console.log("\n[空白画布的布局不炸]");

await t("空白状态下导出的 SVG 依然合法", async () => {
  const ed = mount("");
  const svg = ed.toSvgString();
  assert.ok(svg.includes("<svg"), "导出的不是 svg");
  assert.ok(!svg.includes("ste-node"), "空白画布不该有节点");
});

console.log("\n[三种垂直对齐]");

// S 底下挂两棵不等深的子树，用来区分三种对齐
const ALIGN_TREE = "[S [A [B [C x]]] [D [E y]]]";
// 深度：S0 A1 B2 C3 x4 D1 E2 y3
function rowsOf(ed) {
  const at = (n) => ed.lay.info.get(n).row;
  const by = (label) => preorder(ed.root).find((n) => n.label === label);
  return {
    S: at(by("S")),
    A: at(by("A")),
    B: at(by("B")),
    C: at(by("C")),
    x: at(by("x")),
    D: at(by("D")),
    E: at(by("E")),
    y: at(by("y")),
  };
}

await t("默认是按层级：每个节点在自己的层级行上", async () => {
  const ed = mount(ALIGN_TREE);
  assert.equal(ed.opts.align, "depth");
  assert.deepEqual(rowsOf(ed), { S: 0, A: 1, B: 2, C: 3, x: 4, D: 1, E: 2, y: 3 });
});

await t("词对齐底部：所有叶子落到最下一行，中间节点保持层级", async () => {
  const ed = mount(ALIGN_TREE);
  ed.setAlign("leaves");
  assert.deepEqual(rowsOf(ed), { S: 0, A: 1, B: 2, C: 3, x: 4, D: 1, E: 2, y: 4 });
});

await t("整树贴底：叶子在底部，中间节点也下移贴住女儿节点", async () => {
  const ed = mount(ALIGN_TREE);
  ed.setAlign("compact");
  // x 在第 4 行；C=3、B=2、A=1；y 也在第 4 行 -> E=3、D=2；S = min(1,2)-1 = 0
  assert.deepEqual(rowsOf(ed), { S: 0, A: 1, B: 2, C: 3, x: 4, D: 2, E: 3, y: 4 });
});

await t("整树贴底后没有空行，画布高度随之变小", async () => {
  const depthMode = mount(ALIGN_TREE);
  const compactMode = mount(ALIGN_TREE);
  compactMode.setAlign("compact");
  assert.ok(compactMode.size.height <= depthMode.size.height);
  const rows = [...compactMode.lay.info.values()].map((it) => it.row);
  assert.equal(Math.min(...rows), 0, "最上面一行应该是 0，不该留空行");
  assert.equal(Math.max(...rows), compactMode.lay.maxRow);
  for (let r = 0; r <= compactMode.lay.maxRow; r++) {
    assert.ok(rows.includes(r), `第 ${r} 行是空的`);
  }
});

await t("三种模式下母亲节点都仍在女儿节点上方", async () => {
  for (const align of ["depth", "leaves", "compact"]) {
    const ed = mount("[S [NP [D the][N dog]][VP [V barks][PP [P in][NP [N park]]]]]");
    ed.setAlign(align);
    for (const n of preorder(ed.root)) {
      for (const c of n.children) {
        assert.ok(
          ed.lay.info.get(c).row > ed.lay.info.get(n).row,
          `${align} 模式下 ${n.label} 没有排在 ${c.label} 上方`,
        );
      }
    }
  }
});

await t("切换对齐会有对应的按钮高亮，且不改动树本身", async () => {
  const ed = mount(ALIGN_TREE);
  const before = ed.getValue();
  ed.setAlign("compact");
  assert.ok(ed.alignButtons.compact.classList.contains("is-active"));
  assert.ok(!ed.alignButtons.depth.classList.contains("is-active"));
  ed.setAlign("leaves");
  assert.ok(ed.alignButtons.leaves.classList.contains("is-active"));
  assert.ok(!ed.alignButtons.compact.classList.contains("is-active"));
  assert.equal(ed.getValue(), before, "改对齐不该动到结构");
});

await t("对齐方式可以通过构造参数和 setOptions 设置", async () => {
  const host = document.createElement("div");
  const ed = new SyntaxTreeEditor(host, { value: ALIGN_TREE, align: "leaves" });
  assert.equal(ed.opts.align, "leaves");
  assert.equal(ed.lay.info.get(ed.root.children[0].children[0].children[0].children[0]).row, 4);
  ed.setOptions({ align: "depth" });
  assert.equal(ed.opts.align, "depth");
  ed.setAlign("不存在的模式");
  assert.equal(ed.opts.align, "depth", "非法值应被忽略");
});

await t("空白画布下切换对齐不会炸", async () => {
  const ed = mount("");
  ed.setAlign("compact");
  assert.equal(ed.isEmpty, true);
  assert.equal(ed.lay, null);
});

console.log("\n[改名框里的 Ctrl+Z]");

await t("刚创建的新节点，Ctrl+Z 直接撤销掉这一步", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Enter", { ctrlKey: true }); // 加女儿节点并进入改名
  assert.equal(ed.getValue(), "[S [A X] [B]]");
  assert.equal(ed.input.hidden, false);

  ed.input.dispatchEvent(makeEvent("keydown", { key: "z", ctrlKey: true }));
  assert.equal(ed.input.hidden, true, "应该退出改名");
  assert.equal(ed.getValue(), "[S [A] [B]]", "Ctrl+Z 应该直接撤销掉新建的节点");
});

await t("空白画布上建了根节点后，Ctrl+Z 回到空白画布", async () => {
  const ed = mount("");
  ed.scroller.dispatchEvent(makeEvent("pointerdown"));
  assert.equal(ed.input.hidden, false);
  ed.input.dispatchEvent(makeEvent("keydown", { key: "z", ctrlKey: true }));
  assert.equal(ed.isEmpty, true);
  assert.equal(ed.placeholder.hidden, false);
});

await t("已经改了标签时，第一次 Ctrl+Z 只把标签恢复原样", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Enter", { ctrlKey: true });
  ed.input.value = "NP";
  ed.input.dispatchEvent(makeEvent("input"));
  assert.equal(ed.getValue(), "[S [A NP] [B]]");

  ed.input.dispatchEvent(makeEvent("keydown", { key: "z", ctrlKey: true }));
  assert.equal(ed.input.hidden, false, "应该留在改名框里");
  assert.equal(ed.input.value, "X", "标签恢复成默认值");
  assert.equal(ed.getValue(), "[S [A X] [B]]");

  // 再按一次才是退出编辑 + 撤销创建
  ed.input.dispatchEvent(makeEvent("keydown", { key: "z", ctrlKey: true }));
  assert.equal(ed.input.hidden, true);
  assert.equal(ed.getValue(), "[S [A] [B]]");
});

await t("改名框里 Ctrl+Shift+Z 重做", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Enter", { ctrlKey: true }); // 加女儿节点，改名框打开
  ed.input.dispatchEvent(makeEvent("keydown", { key: "z", ctrlKey: true }));
  assert.equal(ed.getValue(), "[S [A] [B]]");
  // 回到主键盘区再重做
  key(ed, "z", { ctrlKey: true, shiftKey: true });
  assert.equal(ed.getValue(), "[S [A X] [B]]");
});

await t("改名框里 Ctrl+Y 不再是重做", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Enter", { ctrlKey: true });
  ed.input.dispatchEvent(makeEvent("keydown", { key: "z", ctrlKey: true }));
  const undone = ed.getValue();
  ed.input.dispatchEvent(makeEvent("keydown", { key: "y", ctrlKey: true }));
  assert.equal(ed.getValue(), undone, "改名框里 Ctrl+Y 也不该触发重做");
});

console.log("\n[左移 / 右移（工具栏按钮 + Alt/Ctrl 方向键）]");

// 用户给的例子
const MOVE_TREE = "[CP [C that] [TP [N Chomsky] [T' [T will] [VP [V love] [N AI]]]]]";
const AFTER_LEFT = "[CP [C that] [TP [N [Chomsky] [T will]] [T' [VP [V love] [N AI]]]]]";
const AFTER_RIGHT = "[CP [C that] [TP [N Chomsky] [T' [VP [V love] [N AI]] [T will]]]]";

/** 选中 T' 底下那个 T（不是词 will） */
function selectT(ed) {
  const tp = ed.root.children.find((c) => c.label === "TP");
  const tBar = tp.children.find((c) => c.label === "T'");
  const t = tBar.children.find((c) => c.label === "T");
  clickNode(ed, t);
  return t;
}

await t("选中 T 左移，得到用户要的结果", async () => {
  const ed = mount(MOVE_TREE);
  selectT(ed);
  assert.equal(ed.btnMoveLeft.disabled, false, "T 的妈妈 T' 有左姊妹 N，应该可以左移");
  ed.moveLeft();
  assert.equal(ed.getValue(), AFTER_LEFT);
});

await t("选中 T 右移，得到用户要的结果", async () => {
  const ed = mount(MOVE_TREE);
  selectT(ed);
  assert.equal(ed.btnMoveRight.disabled, false, "T 有右姊妹 VP，应该可以右移");
  ed.moveRight();
  assert.equal(ed.getValue(), AFTER_RIGHT);
});

await t("Alt+← / Ctrl+← 都能触发左移", async () => {
  for (const mod of [{ altKey: true }, { ctrlKey: true }]) {
    const ed = mount(MOVE_TREE);
    selectT(ed);
    key(ed, "ArrowLeft", mod);
    assert.equal(ed.getValue(), AFTER_LEFT, `修饰键 ${JSON.stringify(mod)} 没生效`);
  }
});

await t("Alt+→ / Ctrl+→ 都能触发右移", async () => {
  for (const mod of [{ altKey: true }, { ctrlKey: true }]) {
    const ed = mount(MOVE_TREE);
    selectT(ed);
    key(ed, "ArrowRight", mod);
    assert.equal(ed.getValue(), AFTER_RIGHT, `修饰键 ${JSON.stringify(mod)} 没生效`);
  }
});

await t("左移换妈妈，右移不换", async () => {
  const left = mount(MOVE_TREE);
  const t1 = selectT(left);
  const motherBefore = preorder(left.root).find((n) => n.children.includes(t1));
  left.moveLeft();
  const t1After = preorder(left.root).find((n) => n.label === "T");
  const motherAfter = preorder(left.root).find((n) => n.children.includes(t1After));
  assert.notEqual(motherAfter, motherBefore, "左移应该换妈妈");
  assert.equal(motherAfter.label, "N");

  const right = mount(MOVE_TREE);
  const t2 = selectT(right);
  const m2 = preorder(right.root).find((n) => n.children.includes(t2));
  right.moveRight();
  const t2After = preorder(right.root).find((n) => n.label === "T");
  assert.equal(preorder(right.root).find((n) => n.children.includes(t2After)), m2, "右移不该换妈妈");
});

await t("左移和右移都能撤销", async () => {
  const ed = mount(MOVE_TREE);
  selectT(ed);
  ed.moveLeft();
  assert.equal(ed.getValue(), AFTER_LEFT);
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), MOVE_TREE);

  selectT(ed);
  ed.moveRight();
  assert.equal(ed.getValue(), AFTER_RIGHT);
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), MOVE_TREE);
});

await t("两个分支都对：有姊妹就换位，没有就搬到母亲节点那一侧的姊妹底下", async () => {
  // ① 换位分支：T 有右姊妹 VP
  const a = mount(MOVE_TREE);
  selectT(a);
  a.moveRight();
  assert.equal(a.getValue(), AFTER_RIGHT);

  // ② 换妈妈分支：T 是最左的女儿，搬到母亲节点 T' 的左姊妹 N 底下
  const b = mount(MOVE_TREE);
  selectT(b);
  b.moveLeft();
  assert.equal(b.getValue(), AFTER_LEFT);

  // ②' 右移的换妈妈分支：Chomsky 是 N 的最右女儿，搬到右姊妹 T' 底下当最左女儿
  const c = mount(MOVE_TREE);
  const chomsky = preorder(c.root).find((n) => n.label === "Chomsky");
  clickNode(c, chomsky);
  assert.equal(c.btnMoveRight.disabled, false);
  c.moveRight();
  assert.equal(c.getValue(), "[CP [C that] [TP [N] [T' [Chomsky] [T will] [VP [V love] [N AI]]]]]");
});

await t("不满足条件时按钮禁用、按键无效", async () => {
  // C 是 CP 的第一个孩子，挂在 C 底下的 X 是唯一的女儿节点：
  //   左移 —— 没有左姊妹，C 也没有左姊妹 -> 不行
  //   右移 —— 没有右姊妹，但 C 有右姊妹 TP -> 可以，X 落到 TP 底下当最左女儿
  const ed = mount("[CP [C [X x]] [TP [N Chomsky]]]");
  clickNode(ed, ed.root.children[0].children[0]);

  assert.equal(ed.btnMoveLeft.disabled, true, "没左姊妹、母亲节点也没左姊妹");
  assert.equal(ed.btnMoveRight.disabled, false, "母亲节点 C 有右姊妹 TP");

  const before = ed.getValue();
  key(ed, "ArrowLeft", { altKey: true });
  assert.equal(ed.getValue(), before, "无效的左移不该改动树");

  ed.moveRight();
  assert.equal(ed.getValue(), "[CP [C] [TP [X x] [N Chomsky]]]");
});

await t("根节点不能左移右移", async () => {
  const ed = mount(MOVE_TREE);
  clickNode(ed, ed.root);
  assert.equal(ed.btnMoveLeft.disabled, true);
  assert.equal(ed.btnMoveRight.disabled, true);
});

await t("空白画布下左移/右移不会炸", async () => {
  const ed = mount("");
  ed.moveLeft();
  ed.moveRight();
  assert.equal(ed.isEmpty, true);
  assert.equal(ed.btnMoveLeft.disabled, true);
  assert.equal(ed.btnMoveRight.disabled, true);
});

console.log("\n[只有词才染红]");

function fillOf(ed, label) {
  const n = preorder(ed.root).find((x) => x.label === label);
  const g = nodeGroups(ed).find((x) => Number(x.dataset.id) === n.id);
  return g.querySelector("text").getAttribute("fill");
}

await t("用户给的例子：只有 word 是红色", async () => {
  const ed = mount("[XP [D [X'' [X word] [Y]]] [X']]");
  assert.equal(fillOf(ed, "word"), "#CC0000", "word 是词，应该染红");
  assert.equal(fillOf(ed, "Y"), "#0000CC", "Y 是范畴，不该染红");
  assert.equal(fillOf(ed, "X'"), "#0000CC", "X' 是范畴，不该染红");
  assert.equal(fillOf(ed, "X"), "#0000CC", "X 非叶子，不该染红");
  assert.equal(fillOf(ed, "D"), "#0000CC");
});

await t("常规树的词都染红，范畴不染", async () => {
  const ed = mount("[S [NP [D the][N dog]][VP [V barks]]]");
  assert.equal(fillOf(ed, "the"), "#CC0000");
  assert.equal(fillOf(ed, "dog"), "#CC0000");
  assert.equal(fillOf(ed, "barks"), "#CC0000");
  assert.equal(fillOf(ed, "S"), "#0000CC");
  assert.equal(fillOf(ed, "NP"), "#0000CC");
});

await t("关掉颜色后全部是黑色", async () => {
  const ed = mount("[XP [D [X'' [X word] [Y]]] [X']]", { colors: false });
  assert.equal(fillOf(ed, "word"), "#111111");
  assert.equal(fillOf(ed, "Y"), "#111111");
});

console.log("\n[位移箭头 -->]");

await t("图上箭头按默认写法导出", async () => {
  const ed = mount("[A [B C][D E][F G ->1]]");
  assert.equal(ed.getValue(), "[A [B C] [D E] [F G ->1]]");
});

await t("旧写法输入会被规范化成 ->", async () => {
  const ed = mount("[A [B C][D E][F G ->1]]");
  assert.equal(ed.getValue(), "[A [B C] [D E] [F G ->1]]");
  assert.equal(ed.errBox.textContent, "");
});

console.log("\n[两套记法的切换]");

const USER_RULES = [
  "0 XP -> D",
  "0 XP -> X'",
  "1 D -> w1",
  "2 X' -> X",
  "2 X' -> Y",
  "4 X -> w2",
  "5 Y -> w3",
].join("\n");

await t("默认是括号记法，按钮高亮正确", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  assert.equal(ed.textMode, "bracket");
  assert.ok(ed.textModeButtons.bracket.classList.contains("is-active"));
  assert.ok(!ed.textModeButtons.rules.classList.contains("is-active"));
});

await t("切到规则记法：文本换成规则写法，模型不动", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  const before = ed.getValue();
  ed.setTextMode("rules");
  assert.equal(ed.textMode, "rules");
  assert.equal(ed.textarea.value, USER_RULES);
  assert.equal(ed.getValue(), before, "切记法不该改动树");
  assert.ok(ed.textModeButtons.rules.classList.contains("is-active"));
  assert.ok(!ed.textModeButtons.bracket.classList.contains("is-active"));
});

await t("切回括号记法，文本还原", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  ed.setTextMode("bracket");
  assert.equal(ed.textarea.value, "[XP [D w1] [X' [X w2] [Y w3]]]");
});

await t("规则记法下代码框会变高（一行一条，比括号记法长）", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  assert.equal(ed.textarea.rows, 3);
  ed.setTextMode("rules");
  assert.ok(ed.textarea.rows > 3, "规则记法应该给更高的框");
  ed.setTextMode("bracket");
  assert.equal(ed.textarea.rows, 3);
});

await t("在规则记法里编辑代码，图跟着变", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  typeText(ed, "1 0 S -> NP\n2 0 S -> VP");
  await sleep(300);
  assert.equal(ed.errBox.textContent, "");
  assert.equal(nodeGroups(ed).length, 3);
  assert.deepEqual(ed.root.children.map((c) => c.label), ["NP", "VP"]);
  // 切回括号记法应当一致
  ed.setTextMode("bracket");
  assert.equal(ed.textarea.value, "[S [NP] [VP]]");
});

await t("规则记法写错时报错并保留上一棵好树，错误带行号", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  const before = ed.getValue();
  typeText(ed, "1 0 XP -> D\n2 1 D w1");
  await sleep(300);
  assert.match(ed.errBox.textContent, /第 2 行/);
  assert.equal(ed.getValue(), before, "非法输入不该破坏模型");
});

await t("位移箭头在两种记法之间保持一致", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  typeText(ed, `${USER_RULES}\n\n7 --> 6`); // 7 = w3，6 = w2
  await sleep(300);
  assert.equal(ed.errBox.textContent, "");
  const trace = preorder(ed.root).find((n) => n.arrow);
  assert.equal(trace.label, "w3");
  assert.equal(trace.arrow.target.label, "w2");

  ed.setTextMode("bracket");
  assert.equal(ed.textarea.value, "[XP [D w1] [X' [X w2] [Y w3 ->6]]]");
});

await t("getRules / setRules", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  assert.equal(ed.getRules(), USER_RULES);
  ed.setRules("0 S -> A\n0 S -> B");
  assert.equal(ed.getValue(), "[S [A] [B]]");
  assert.equal(ed.getRules(), "0 S -> A\n0 S -> B");
});

await t("空白画布在两套记法下都是空", async () => {
  const ed = mount("");
  assert.equal(ed.getRules(), "");
  ed.setTextMode("rules");
  assert.equal(ed.textarea.value, "");
  ed.setRules("");
  assert.equal(ed.isEmpty, true);
});

await t("规则记法里点文本框也能同步选中", async () => {
  const ed = mount("");
  ed.setRules(USER_RULES);
  ed.setTextMode("rules");
  const text = ed.textarea.value;
  ed.textarea.value = text;
  ed.textarea.selectionStart = text.indexOf("w2") + 1;
  ed.textarea.selectionEnd = ed.textarea.selectionStart;
  ed.textarea.dispatchEvent(makeEvent("click"));
  assert.equal(ed.selected.label, "w2");
});

await t("对齐按钮的取值和布局模块完全一致", async () => {
  const ed = mount("[S [A]]");
  assert.deepEqual(Object.keys(ed.alignButtons), ALIGN_MODES, "界面按钮和 layout 支持的模式对不上");
  for (const mode of ALIGN_MODES) {
    assert.ok(ed.alignButtons[mode].title.length > 0, `${mode} 缺少说明文字`);
  }
});

await t("非法记法名会被忽略", async () => {
  const ed = mount("[S [A]]");
  ed.setTextMode("nonsense");
  assert.equal(ed.textMode, "bracket");
});

console.log("\n[装订线：行号不在文本里]");

await t("括号记法下不显示装订线", async () => {
  const ed = mount("[S [A] [B]]");
  assert.equal(ed.gutter.hidden, true);
});

await t("规则记法下装订线显示 1..N，一行的编号 = 节点编号", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  assert.equal(ed.gutter.hidden, false);
  assert.deepEqual(ed.gutterLines.textContent.split("\n"), ["1", "2", "3", "4", "5", "6", "7"]);
});

await t("装订线的数字不在文本里，复制出来是干净的", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  // 文本框内容不含行号列
  assert.equal(ed.textarea.value, USER_RULES);
  for (const line of ed.textarea.value.split("\n")) {
    const [first, second] = line.split(/\s+/);
    assert.match(first, /^\d+$/, `第一个 token 是妈妈编号：${line}`);
    assert.ok(!/^\d+$/.test(second), `第二个 token 不该是行号：${line}`);
  }
  // 行号在另一个元素里
  assert.ok(ed.gutterLines.textContent.length > 0);
  assert.notEqual(ed.textarea.value, ed.gutterLines.textContent);
});

await t("装订线不可选中、不接收焦点，点它会把焦点交给文本框", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  assert.equal(ed.gutter.classList.contains("ste-gutter"), true);
  // 点装订线：阻止默认（不产生选区/焦点），并把焦点交给 textarea
  const ev = makeEvent("pointerdown");
  ed.gutter.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true, "装订线不该拿到焦点或选区");
  assert.equal(document.activeElement, ed.textarea, "焦点应该落到文本框");
});

await t("装订线跟着文本变：加一行、删一行都立刻反映", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  assert.equal(ed.gutterLines.textContent.split("\n").length, 7);

  ed.textarea.value = `${USER_RULES}\n6 X -> w4`;
  ed.textarea.dispatchEvent(makeEvent("input"));
  assert.equal(ed.gutterLines.textContent.split("\n").length, 8, "加了一行，行号应该变 8 行");
  assert.equal(ed.gutterLines.textContent.split("\n")[7], "8");
});

await t("装订线给每一行都编号（空行、箭头行也有号）", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  assert.equal(ed.gutterLines.textContent, "1\n2\n3\n4\n5\n6\n7");

  ed.textarea.value = "0 XP -> D\n\n0 XP -> X'\n\n7 --> 6";
  ed.textarea.dispatchEvent(makeEvent("input"));
  assert.deepEqual(ed.gutterLines.textContent.split("\n"), ["1", "2", "3", "4", "5"]);
});

await t("编号 = 行号：空行也占一个号，下面的节点顺延", async () => {
  const ed = mount("");
  // 第 1 行引入 X'（编号 1），第 3 行引入 X（编号 3，因为第 2 行是空行）
  ed.setRules("0 X'' -> X'\n\n1 X' -> X");
  assert.equal(ed.errBox.textContent, "", "应该能正常解析");
  assert.deepEqual(
    preorder(ed.root).map((n) => [n.label, n.line]),
    [
      ["X''", 0],
      ["X'", 1],
      ["X", 3],
    ],
  );
});

await t("插一行之后，下面所有引用会自动改回正确的编号（Bug 修复）", async () => {
  const ed = mount("[X'' [X' [X w2]] [Z]]");
  ed.setTextMode("rules");
  assert.equal(ed.textarea.value, "0 X'' -> X'\n0 X'' -> Z\n1 X' -> X\n3 X -> w2");

  // 在第 1 行后面插一行，制造错位：X 的编号从 3 变成 4
  ed.textarea.value = "0 X'' -> X'\n0 X'' -> Z\n0 X'' -> W\n1 X' -> X\n2 X -> w2";
  ed.textarea.selectionStart = ed.textarea.value.length;
  ed.textarea.selectionEnd = ed.textarea.value.length;
  ed.textarea.dispatchEvent(makeEvent("input"));
  await sleep(350);

  assert.equal(
    ed.textarea.value,
    "0 X'' -> X'\n0 X'' -> Z\n0 X'' -> W\n1 X' -> X\n4 X -> w2",
    "最后一行引用的 X 应该从 2 改成 4",
  );
  assert.equal(ed.errBox.textContent, "");
  assert.equal(ed.textarea.selectionStart, ed.textarea.value.length, "光标应该还在最后一行末尾");
});

await t("换行会立刻在装订线上多一个号", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  const before = ed.gutterLines.textContent.split("\n").length;
  ed.textarea.value = `${ed.textarea.value}\n`;
  ed.textarea.dispatchEvent(makeEvent("input"));
  assert.equal(ed.gutterLines.textContent.split("\n").length, before + 1);
});

await t("切回括号记法时装订线隐藏", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  ed.setTextMode("bracket");
  assert.equal(ed.gutter.hidden, true);
});

await t("滚动文本框时装订线跟着滚", async () => {
  const ed = mount("[XP [D w1] [X' [X w2] [Y w3]]]");
  ed.setTextMode("rules");
  ed.textarea.scrollTop = 24;
  ed.textarea.dispatchEvent(makeEvent("scroll"));
  assert.equal(ed.gutterLines.style.transform, "translateY(-24px)");
});

console.log("\n[称谓切换]");

const NEUTRAL = [["母亲节点","上级节点"],["姊妹节点","同级节点"],["女儿节点","下级节点"],["母亲","上级"],["姊妹","同级"],["女儿","下级"]];
const FATHER = [["母亲节点","父节点"],["姊妹节点","兄弟节点"],["女儿节点","子节点"],["母亲","父"],["姊妹","兄弟"],["女儿","子"]];

await t("换成中性称谓：按钮名和提示行都跟着变", async () => {
  const ed = mount("[XP [A] [B]]");
  assert.equal(ed.btnChild.labelEl.textContent, "＋女儿节点");
  ed.setTerms(NEUTRAL);
  assert.equal(ed.btnChild.labelEl.textContent, "＋下级节点");
  assert.equal(ed.btnSibling.labelEl.textContent, "＋同级节点");
  assert.ok(ed.hintEl.textContent.includes("加下级"), "提示行也该跟着换");
  assert.ok(!ed.hintEl.textContent.includes("女儿"), "不该还有旧说法");
});

await t("换成父系称谓，再换回母系不串味", async () => {
  const ed = mount("[XP [A] [B]]");
  ed.setTerms(FATHER);
  assert.equal(ed.btnChild.labelEl.textContent, "＋子节点");
  assert.equal(ed.btnSibling.labelEl.textContent, "＋兄弟节点");
  ed.setTerms(null);
  assert.equal(ed.btnChild.labelEl.textContent, "＋女儿节点");
  assert.equal(ed.btnSibling.labelEl.textContent, "＋姊妹节点");
  assert.ok(ed.hintEl.textContent.includes("加女儿节点"));
});

await t("换称谓不影响树本身", async () => {
  const ed = mount("[XP [A] [B]]");
  const before = ed.getValue();
  ed.setTerms(FATHER);
  assert.equal(ed.getValue(), before, "树不该有任何变化");
  assert.equal(ed.root.children.length, 2);
});

console.log("\n[斜体词类]");

await t("树里的小 v 和 pro 用斜体，其它标签不用", async () => {
  const ed = mount("[vP [v [V know]] [pro [N him]] [NP Dogs]]\nItalic(1, 2)");
  const texts = [...ed.svg.querySelectorAll("text")];
  const styleOf = (label) => {
    const t = texts.find((x) => x.textContent === label);
    return t ? t.getAttribute("font-style") : "(没找到)";
  };
  // 根 vP=0，女儿 v=1、pro=2、NP=3
  assert.equal(styleOf("v"), "italic");
  assert.equal(styleOf("pro"), "italic");
  assert.equal(styleOf("NP"), null, "没声明的范畴不该是斜体");
  assert.equal(styleOf("Dogs"), null, "没声明的词不该是斜体");

  // 去掉声明就不该有斜体
  const plain = mount("[vP [v [V know]] [pro [N him]] [NP Dogs]]");
  const pv = [...plain.svg.querySelectorAll("text")].find((x) => x.textContent === "v");
  assert.equal(pv.getAttribute("font-style"), null, "没有声明时不该自动斜体");
});

await t("提示行开头那句是粗体", async () => {
  const ed = mount("[S [A]]");
  const b = ed.el.querySelector(".ste-hint").querySelector("b");
  assert.ok(b, "提示行应该有一个加粗的 <b>");
  assert.match(b.textContent, /复制粘贴源代码用括号记法/);
  assert.match(b.textContent, /画箭头建议用规则记法/);
});

console.log("\n[改名之后的键盘焦点]");

await t("改名提交后焦点回到画布，不用再点一下鼠标", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Enter"); // 新建女儿节点，改名框自动打开
  assert.equal(document.activeElement, ed.input, "改名框应该拿到焦点");

  ed.input.value = "X";
  ed.input.dispatchEvent(makeEvent("input"));
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" })); // 输入完按 Enter
  assert.equal(ed.input.hidden, true);
  assert.equal(document.activeElement, ed.scroller, "焦点必须回到画布");

  // 关键：接下来不点鼠标，直接操作
  key(ed, "ArrowUp");
  assert.equal(ed.selected.label, "A", "方向键应该立刻生效");
  key(ed, "ArrowDown");
  assert.equal(ed.selected.label, "X", "↓ 应该回到 A 最左边的女儿，也就是刚建的 X");
});

await t("提交后不点鼠标就能直接加姊妹节点", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "Enter");
  ed.input.value = "Y"; // 新建的女儿节点叫 Y，好和前后的 X 区分
  ed.input.dispatchEvent(makeEvent("input"));
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Enter" }));
  assert.equal(ed.getValue(), "[S [A Y] [B]]");

  // 此时选中的是刚建好的 Y，所以 Shift+Enter 给它加一个姊妹节点（默认叫 X）
  key(ed, "Enter", { shiftKey: true });
  assert.equal(ed.getValue(), "[S [A [Y] [X]] [B]]");
});

await t("Esc 取消改名后焦点也回到画布", async () => {
  const ed = mount("[S [A] [B]]");
  clickNode(ed, ed.root.children[0]);
  key(ed, "F2");
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Escape" }));
  assert.equal(ed.input.hidden, true);
  assert.equal(document.activeElement, ed.scroller);
  key(ed, "ArrowRight");
  assert.equal(ed.selected.label, "B", "方向键应该立刻生效");
});

await t("改名框里按 Tab 提交后，焦点也在画布上", async () => {
  const ed = mount("[XP [Z word1] [X'' [X' [X word2]]]]");
  clickNode(ed, preorder(ed.root).find((n) => n.label === "X"));
  key(ed, "F2");
  ed.input.dispatchEvent(makeEvent("keydown", { key: "Tab" }));
  assert.equal(ed.input.hidden, true);
  assert.equal(document.activeElement, ed.scroller);
});

console.log("\n[位移箭头的纵向位置]");

const ARROW_TREE = "[CP [NP what_i] [C' [C is_j] [IP [NP a syntax tree] [I' [I t_j ->6] [VP [V t_j ->6] [NP t_i ->3]]]]]]";

await t("箭头明显低于最底下一行（三种对齐模式都不许贴着词跑）", async () => {
  for (const align of ["depth", "leaves", "compact"]) {
    const ed = mount(ARROW_TREE, { align });
    assert.equal(ed.size.arrowBottoms.length, 3, align + " 模式的移位例句应该有三条箭头");
    for (const b of ed.size.arrowBottoms) {
      const drop = b - ed.lay.height;
      assert.ok(drop >= 20, `${align} 模式里箭头只比最底下一行低 ${drop}px，会撞到文字`);
      assert.ok(b <= ed.size.height, align + " 模式里箭头画到画布外面了");
    }
  }
});

await t("多条箭头各占一条通道，不会叠在一起", async () => {
  const ed = mount("[A [B [C c ->1]] [D [E e ->2]]]");
  assert.equal(ed.size.arrowBottoms.length, 2);
  assert.ok(ed.size.arrowBottoms[1] - ed.size.arrowBottoms[0] >= 20, "两条箭头应该分开");
  assert.ok(ed.size.arrowBottoms[1] <= ed.size.height, "箭头画到画布外面了");
});

await t("载入示例保留撤销历史：Ctrl+Z 能退回原来那棵树", async () => {
  const ed = mount("[S [A] [B]]");
  const before = ed.getValue();
  ed.loadValue("[CP [C that] [TP [N Chomsky]]]");
  assert.equal(ed.getValue(), "[CP [C that] [TP [N Chomsky]]]");
  assert.equal(ed.undoStack.length, 1, "载入前应该压了一条历史");
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), before, "Ctrl+Z 应该退回载入之前那棵树");
});

await t("连点几个示例也能一路撤销回去", async () => {
  const ed = mount("[S [A] [X]]");
  ed.loadValue("[S [A] [B]]");
  ed.loadValue("[S [A] [B] [C]]");
  assert.equal(ed.getValue(), "[S [A] [B] [C]]");
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), "[S [A] [B]]");
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), "[S [A] [X]]", "应该回到最开始那棵树");
});

await t("载入空白画布也能撤销回上一棵树", async () => {
  const ed = mount("[S [A] [B]]");
  ed.loadValue("");
  assert.equal(ed.isEmpty, true);
  key(ed, "z", { ctrlKey: true });
  assert.equal(ed.getValue(), "[S [A] [B]]", "应该退回载入空白之前");
});

console.log("\n[工具栏快捷键说明]");

await t("每个工具栏按钮下边的快捷键说明都对", async () => {
  const ed = mount("[S [A]]");
  const got = Object.fromEntries(
    [...ed.el.querySelectorAll(".ste-btn")].map((b) => [
      b.querySelector(".ste-btn-label").textContent,
      b.querySelector(".ste-btn-key") ? b.querySelector(".ste-btn-key").textContent : null,
    ]),
  );
  // 这两个被删掉的操作（把节点收进前一个姊妹底下 / 升成母亲节点的姊妹）已经不在了，
  assert.deepEqual(got, {
    "＋女儿节点": "Enter",
    "＋姊妹节点": "Shift+Enter",
    "下移": "Tab",
    "上移": "Shift+Tab",
    "右移": "Alt+→",
    "左移": "Alt+←",
    "删除": "Delete",
    "撤销": "Ctrl+Z",
    "重做": "Ctrl+Shift+Z",
    "SVG": "矢量图",
    "PNG": "位图",
  });
});

await t("＋女儿节点 按钮在空白画布上改叫 ＋根节点，快捷键说明不变", async () => {
  const ed = mount("");
  assert.equal(ed.btnChild.labelEl.textContent, "＋根节点");
  assert.equal(ed.btnChild.querySelector(".ste-btn-key").textContent, "Enter");
  ed.scroller.dispatchEvent(makeEvent("pointerdown"));
  assert.equal(ed.btnChild.labelEl.textContent, "＋女儿节点");
});

console.log(`\n${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
