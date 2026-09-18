import { SyntaxTreeEditor } from "./editor.js";
import { LANGS, TERM_KINDS, TERM_LABELS, TERMS, DEFAULT_TERM, i18nText, applyTerms } from "./i18n.js";
import { DOCS_EN } from "./docs-en.js";

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
//   index.html?lang=en                      预置界面语言：zh / en（截图和分享都用得上）
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

/** 界面语言：只影响界面文字，对树没有任何影响 */
function initialLang() {
  const v = params && params.has("lang") ? params.get("lang") : null;
  return LANGS.includes(v) ? v : "zh";
}

const editor = new SyntaxTreeEditor("#tree-editor", {
  value: initialValue(),
  align: params && params.has("align") ? params.get("align") : "depth",
  textMode: params && params.has("textmode") ? params.get("textmode") : "bracket",
  lang: initialLang(),
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

// ---------------------------------------------------------------- 语言与称谓
//
// 这是两件正交的事，但要叠好：
//   · **语言**决定用哪张文案表（`STRINGS.zh` / `STRINGS.en`）；
//   · **称谓**决定"同一件事在这门语言里怎么叫"（母系 / 中性 / 父系）。
// 界面上所有文字都是"先按语言取、再套称谓"，这件事由 `editor.js` 的 `#t()` 负责，
// 页面上的静态文案由下面的 `applyPageText()` 负责。两边用的是同一张表。
//
// 文案表里亲属称谓一律写成**母系那套**（中文「母亲节点 / 姊妹节点 / 女儿节点」，
// 英文 `mother node / sister node / daughter node`），中性、父系都是替换出来的 ——
// 所以三套说法只需要维护一张表，而且中英各自的三套用词都在 `src/i18n.js` 里。

let lang = initialLang();
// 每种语言各有自己的默认称谓：中文「母系」、英文「中性」（见 src/i18n.js 的 DEFAULT_TERM）
let termsKind = DEFAULT_TERM[lang];

// 教程正文现在中英两份都有（中文那份在 index.html 里、英文那份在 src/docs-en.js），
// 所以正文直接跟着界面语言走 —— 这份文件里不再需要"正文语言"这个开关。

/** 页面上挂 data-i18n / data-example / data-terms 的静态文案，按当前语言填一遍 */
function applyPageText() {
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = i18nText(lang, el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-example]")) {
    el.textContent = i18nText(lang, `page.examples.${el.dataset.example}`);
  }
  for (const el of document.querySelectorAll("[data-terms]")) {
    el.textContent = TERM_LABELS[lang][el.dataset.terms];
  }
  for (const el of document.querySelectorAll("[data-lang]")) {
    el.classList.toggle("is-on", el.dataset.lang === lang);
  }
}

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
// 教程正文有两份：中文那份就是 index.html 里的原样（这里抓一份快照），英文那份在 src/docs-en.js。
// 每次切换都从快照出发重算，来回切不会串味（换称谓也是同一套机制）。
const docsHtml = {
  zh: docsEl && typeof docsEl.innerHTML === "string" ? docsEl.innerHTML : null,
  en: DOCS_EN,
};

/**
 * 教程正文目前有中英两份；`DOCS_LANG` 指哪一份就渲染哪一份。
 * ⚠️ 正文的**替换表必须按正文自己的语言取**：中文正文配中文三套、英文正文配英文三套，
 * 否则换成英文界面时中文正文会被英文替换表"换坏"（那里的词根本对不上）。
 */
function docsFor(langKey) {
  const html = docsHtml[langKey];
  if (html == null) return null;
  const pairs = TERMS[langKey][termsKind] || null;
  return pairs ? applyTerms(langKey, pairs, html) : html;
}

/** 把当前语言 + 当前称谓套到编辑器界面与教程正文上 */
function applyTermsAndLanguage() {
  const pairs = TERMS[lang][termsKind] || null;
  editor.setTerms(pairs);

  const html = docsFor(lang);
  if (docsEl && html != null) {
    docsEl.innerHTML = html;
    bindToc();
  }
  for (const b of document.querySelectorAll("[data-terms]")) {
    b.classList.toggle("is-on", b.dataset.terms === termsKind);
  }
}

function setTerms(kind) {
  termsKind = TERM_KINDS.includes(kind) ? kind : "mother";
  applyTermsAndLanguage();
}

function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  // 换语言就把称谓重置成该语言的默认套（中文母系、英文中性）
  termsKind = DEFAULT_TERM[lang];
  editor.setLanguage(lang);
  applyPageText();
  applyTermsAndLanguage();
}

for (const b of document.querySelectorAll("[data-terms]")) {
  b.addEventListener("click", () => setTerms(b.dataset.terms));
}
for (const b of document.querySelectorAll("[data-lang]")) {
  b.addEventListener("click", () => setLang(b.dataset.lang));
}

// 初始状态：页面文案与两组按钮的选中态都对上
applyPageText();
applyTermsAndLanguage();

// 方便在控制台里调试
window.syntaxTreeEditor = editor;
