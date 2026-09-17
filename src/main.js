import { SyntaxTreeEditor } from "./editor.js";

const EXAMPLES = [
  // 0 经典结构（首页默认）—— 最小的一棵完整树，后面讲操作都用它
  "[XP [Z word1] [X' [X word2] [Y word3]]]",
  // 1 CP 例句
  "[CP [C that] [TP [N Chomsky] [T' [T will] [VP [V love] [N AI]]]]]",
  // 2 三角例句：[NP generative grammar] 是含空格的多词叶子，会画成三角
  "[S [N Hinton] [TP [T does] [NegP [Neg not] [VP [V understand] [NP generative grammar]]]]]",
  // 3 移位例句：编号 = 节点第一次作为女儿节点出现的行号（根为 0）
  //   箭头的数字是词序号：what_i 是第 1 个词、is_j 是第 2 个词
  "[CP [NP what_i] [C' [C is_j] [IP [NP a syntax tree] [I' [I t_j ->2] [VP [V t_j ->2] [NP t_i ->1]]]]]]",
  // 4 空白画布 —— 没有任何节点，自己从零画
  "",
];

// 支持用 URL 预置内容，方便把某一棵树直接分享出去：
//   index.html?value=%5BS%20%5BNP%20Dogs%5D%5D
//   index.html?value=                       空值 => 空白画布
//   index.html?example=2                    载入第 N 个示例
//   index.html?align=leaves                 预置垂直对齐：depth / leaves / compact
//   index.html?textmode=rules               预置代码框记法：bracket / rules
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;

function initialValue() {
  if (!params) return EXAMPLES[0];
  if (params.has("value")) return params.get("value");
  if (params.has("example")) {
    const i = Number(params.get("example"));
    if (Number.isInteger(i) && i >= 0 && i < EXAMPLES.length) return EXAMPLES[i];
  }
  return EXAMPLES[0];
}

const editor = new SyntaxTreeEditor("#tree-editor", {
  value: initialValue(),
  align: params && params.has("align") ? params.get("align") : "depth",
  textMode: params && params.has("textmode") ? params.get("textmode") : "bracket",
  onChange: ({ text }) => {
    document.title = `Syntax Tree Editor Standalone — ${text.slice(0, 40)}`;
  },
});

// 载入示例用 loadValue：它保留撤销历史，所以载入之后按 Ctrl+Z 能退回原来那棵树。
for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    const value = EXAMPLES[Number(button.dataset.example)] ?? EXAMPLES[0];
    editor.loadValue(value);
    editor.scroller.focus();
  });
}

// ---------------------------------------------------------------- 称谓切换
//
// 三套说法指的是同一件事，只影响界面文案和介绍文字，对树没有任何影响。
// 从左到右逐条替换，所以长词（"女儿节点"）必须排在短词（"女儿"）前面。
const TERM_SETS = {
  mother: null, // 母系就是原文，不用换
  neutral: [
    ["母亲节点", "上级节点"],
    ["姊妹节点", "同级节点"],
    ["女儿节点", "下级节点"],
    ["母亲", "上级"],
    ["姊妹", "同级"],
    ["女儿", "下级"],
  ],
  father: [
    ["母亲节点", "父节点"],
    ["姊妹节点", "兄弟节点"],
    ["女儿节点", "子节点"],
    ["母亲", "父"],
    ["姊妹", "兄弟"],
    ["女儿", "子"],
  ],
};

/** 文档里所有页内跳转的绑定（目录 + 正文里的链接）；
 *  换称谓会重建文档 DOM，所以每次都要重新绑。 */
function bindToc() {
  for (const link of document.querySelectorAll('.docs a[href^="#"]')) {
    link.addEventListener("click", (ev) => {
      const target = document.getElementById(link.getAttribute("href").slice(1));
      if (!target) return;
      ev.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

const docsEl = document.querySelector(".docs");
// 留一份母系原文，每次切换都从它出发，来回切不会串味
const docsBase = docsEl && typeof docsEl.innerHTML === "string" ? docsEl.innerHTML : null;

function setTerms(kind) {
  const pairs = TERM_SETS[kind] || null;
  editor.setTerms(pairs);

  if (docsEl && docsBase != null) {
    let html = docsBase;
    if (pairs) for (const [a, b] of pairs) html = html.split(a).join(b);
    docsEl.innerHTML = html;
    bindToc();
  }
  for (const b of document.querySelectorAll("[data-terms]")) {
    b.classList.toggle("is-on", b.dataset.terms === kind);
  }
}

for (const b of document.querySelectorAll("[data-terms]")) {
  b.addEventListener("click", () => setTerms(b.dataset.terms));
}

// 方便在控制台里调试
window.syntaxTreeEditor = editor;
