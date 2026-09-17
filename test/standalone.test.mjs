// 单文件版 Syntax Tree Editor Standalone.html 的构建产物测试
//
// 这个文件存在的理由：双击 index.html 会因为 file:// 下 ES Modules 被 CORS 拦掉
// 而一片空白。内联的单文件版双击就能跑。既然它是给人双击用的，
// 它必须真的能跑 —— 所以这里把内联脚本抠出来，在 DOM 垫片上真正执行一遍。
//
//   node test/standalone.test.mjs

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { installDom } from "./dom-shim.mjs";

const doc = installDom();

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

const HTML = readFileSync(new URL("../Syntax Tree Editor Standalone.html", import.meta.url), "utf8");

const scriptMatch = /<script>([\s\S]*?)<\/script>/.exec(HTML);
const bundle = scriptMatch ? scriptMatch[1] : "";

console.log("\n[Syntax Tree Editor Standalone.html 结构]");

t("样式已内联，不再外链 style.css", () => {
  assert.ok(HTML.includes("<style>"), "没有内联 <style>");
  assert.ok(!HTML.includes('href="style.css"'), "还留着 style.css 外链（file:// 下会加载不到）");
});

t("不再有 type=module 的脚本标签", () => {
  assert.ok(!/type="module"/.test(HTML), "还有 module 脚本，file:// 下不会执行");
});

t("内联脚本只有一个且非空", () => {
  assert.ok(bundle.length > 1000, `内联脚本太短：${bundle.length} 字符`);
  assert.equal((HTML.match(/<script>/g) || []).length, 1);
});

t("脚本排在 #tree-editor 之后（普通脚本是同步执行的）", () => {
  const hostAt = HTML.indexOf('id="tree-editor"');
  const scriptAt = HTML.indexOf("<script>");
  assert.ok(hostAt > 0, "找不到 #tree-editor");
  assert.ok(scriptAt > hostAt, "脚本跑的时候 #tree-editor 还不存在，编辑器挂载会抛错");
  assert.ok(HTML.indexOf("</body>") > scriptAt, "脚本没有被放进 body 内");
});

t("没有残留的 import / export 语句", () => {
  assert.ok(!/^[ \t]*import\s/m.test(bundle), "还有 import 语句");
  assert.ok(!/^[ \t]*export\s/m.test(bundle), "还有 export 语句");
  assert.ok(!/\bfrom\s*["']\.\//.test(bundle), "还有相对路径的模块引用");
});

t("所有源文件都被打进去了", () => {
  // 漏掉一个模块会让内联版在运行时报 xxx is not defined，
  // 所以这里按 src/ 目录逐个核对，而不是硬编码文件名。
  const files = readdirSync(new URL("../src/", import.meta.url))
    .filter((f) => f.endsWith(".js"))
    .sort();
  assert.ok(files.length >= 6, `src/ 里只有 ${files.length} 个文件？`);
  for (const f of files) {
    const marker = `// ===== src/${f} `;
    assert.ok(bundle.includes(marker), `打包结果里缺少 ${f}`);
  }
});

t("没有任何外部资源引用（离线、双击可用）", () => {
  // 只查真正的外链形式。不能用宽泛的 /src=/ —— JS 里的 `img.src = url`
  // 也会命中，那是运行时给 Image 对象赋值，不是外部资源。
  const external = [
    [/<link\b/i, "<link>"],
    // <img> 允许，但 src 必须是 data: 内联的（示例图就是内联成 data URI 的）
    [/<img\b(?![^>]*\bsrc\s*=\s*["']data:)[^>]*>/i, "<img> 引用了外部图片"],
    [/<iframe\b/i, "<iframe>"],
    [/<script\b[^>]*\bsrc\s*=/i, "<script src=>"],
    [/@import/i, "@import"],
    [/url\(\s*["']?(?:https?:)?\/\//i, "CSS/JS 里的远程 url()"],
  ];
  for (const [re, what] of external) {
    assert.ok(!re.test(HTML), `还有外部资源引用：${what}`);
  }
});

t("整段 HTTP 提示都删掉了（单文件版不需要任何说明）", () => {
  // ⚠️ 只看**元素**在不在，不看那句话的文字还在不在：那段提示的文案现在也进了
  // src/i18n.js 的文案表（切英文要用），而文案表是会被内联进产物的。
  assert.ok(!/class="sub note"/.test(HTML), "提示段落应该整段消失，而不是换成别的文字");
  assert.ok(!HTML.includes("不需要联网"), "单文件版的提示也应该整段删掉");
});

console.log("\n[Syntax Tree Editor Standalone.html 真的能跑]");

const host = doc.register("#tree-editor", doc.createElement("div"));

t("内联脚本是合法 JS 并且能执行完", () => {
  const run = new Function(bundle);
  run(); // 有语法错误或运行时异常都会在这里炸出来
});

t("编辑器挂到了 #tree-editor 上", () => {
  assert.ok(host.children.length > 0, "宿主元素里什么都没有，说明脚本没跑起来");
  assert.ok(host.querySelector(".ste"), "没建出编辑器骨架");
});

t("渲染出了第一棵示例树的节点", () => {
  const editor = globalThis.window.syntaxTreeEditor;
  assert.ok(editor, "window.syntaxTreeEditor 没挂上");
  const nodes = host.querySelectorAll(".ste-node");
  // 首页例句是「经典结构」，8 个节点
  assert.equal(nodes.length, 8, `节点数不对：${nodes.length}`);
  assert.ok(nodes.every((g) => g.querySelector("text")), "有节点没画出标签");
});

t("文本面板同步成规范化记法", () => {
  const editor = globalThis.window.syntaxTreeEditor;
  const textarea = host.querySelector(".ste-textarea");
  assert.equal(textarea.value, editor.getValue());
  assert.equal(textarea.value, "[XP [Z word1] [X' [X word2] [Y word3]]]", `默认例句应该是「经典结构」：${textarea.value}`);
});

t("内联版的功能和模块版一致（清空 -> 空白画布）", () => {
  const editor = globalThis.window.syntaxTreeEditor;
  editor.setValue("");
  assert.equal(editor.isEmpty, true);
  assert.equal(host.querySelectorAll(".ste-node").length, 0);
  editor.createRoot("NP");
  assert.equal(host.querySelectorAll(".ste-node").length, 1);
});

console.log(`\n${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
