// 把本项目打成单文件 "Syntax Tree Editor Standalone.html"
//
// 为什么需要它：ES Modules 走 file:// 会被浏览器的 CORS 规则拦掉，
// 双击 index.html 时 JS 一行都不会执行，编辑器区域就是一片空白。
// 这个脚本把所有模块内联进一个普通 <script> 里，于是双击就能用，不需要起服务。
//
//   node tools/build-standalone.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 交付的单文件版文件名 */
export const OUT_NAME = "Syntax Tree Editor Standalone.html";

// 依赖顺序：被依赖的排在前面。所有模块顶层只有声明，没有立即执行的代码，
// 唯一会立刻跑的是 main.js，所以扁平拼接是安全的。
const MODULES = [
  "src/model.js",
  "src/style.js", // 依赖 model.js，排在它后面
  "src/notation.js",
  "src/rules.js",
  "src/layout.js",
  "src/render.js",
  "src/editor.js",
  "src/main.js",
];

const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** 去掉 import 语句（支持跨行），并记录导入了什么 */
function stripImports(src) {
  return src.replace(/^[ \t]*import\s[\s\S]*?from\s*["'][^"']*["'];?[ \t]*\r?\n?/gm, "");
}

/** 去掉 export 关键字 */
function stripExports(src) {
  return src.replace(/^[ \t]*export\s+default\s+/gm, "").replace(/^[ \t]*export\s+/gm, "");
}

/** 收集顶层声明名，用来发现跨模块重名（扁平拼接最容易踩的坑） */
function topLevelNames(src) {
  const names = [];
  const re = /^(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src)) !== null) names.push(m[1]);
  return names;
}

function buildBundle() {
  const seen = new Map();
  const chunks = [];
  const report = [];

  for (const file of MODULES) {
    const raw = read(file);
    const code = stripExports(stripImports(raw));

    for (const name of topLevelNames(code)) {
      if (seen.has(name)) {
        throw new Error(
          `打包失败：顶层名字 "${name}" 在 ${seen.get(name)} 和 ${file} 里重复。\n` +
            `扁平拼接会让后者覆盖前者，必须先改名或改成命名空间对象。`,
        );
      }
      seen.set(name, file);
    }

    report.push(`  ${file.padEnd(20)} ${String(code.split("\n").length).padStart(5)} 行`);
    chunks.push(`// ===== ${file} ${"=".repeat(Math.max(0, 56 - file.length))}\n${code.trim()}\n`);
  }

  return { bundle: `(function () {\n"use strict";\n\n${chunks.join("\n")}\n})();\n`, report };
}

/**
 * 把 html 里的某个位置换成一段**原样插入**的文本。
 *
 * ⚠️ 必须用函数形式，不能用字符串形式：`String.replace` 会把替换文本里的
 * `$&`、`` $` ``、`$'`、`$1` 当成特殊记号（`` $` `` = 匹配位置之前的全部内容）。
 * 源码里只要出现一个 `` $` ``（例如模板字符串写成 `` `...\s*$` ``），
 * 字符串形式的替换就会把整页 HTML 塞进脚本里，构建产物直接变成语法错误。
 */
function replaceVerbatim(html, re, text) {
  return html.replace(re, () => text);
}

function buildHtml(bundle) {
  let html = read("index.html");
  const css = read("style.css");

  if (css.includes("</style")) throw new Error("style.css 里出现了 </style，无法安全内联");
  if (bundle.includes("</script")) throw new Error("打包结果里出现了 </script，无法安全内联");

  const linkTag = /[ \t]*<link\s+rel="stylesheet"[^>]*>\r?\n?/;
  if (!linkTag.test(html)) throw new Error("index.html 里找不到 <link rel=stylesheet>");
  html = replaceVerbatim(html, linkTag, `<style>\n${css.trim()}\n</style>\n`);

  // 模块脚本原本在 <head> 里（模块天然延迟执行）。内联成普通脚本后必须在
  // </body> 之前，否则脚本跑的时候 #tree-editor 还不存在。
  const scriptTag = /[ \t]*<script\s+type="module"[^>]*><\/script>\r?\n?/;
  if (!scriptTag.test(html)) throw new Error("index.html 里找不到 type=module 的 script");
  html = html.replace(scriptTag, "");
  html = replaceVerbatim(html, /<\/body>/, `<script>\n${bundle}</script>\n  </body>`);

  // 内联必须逐字不差。上面那条坑（`` $` ``）不会报错，只会悄悄把页面复制进脚本，
  // 所以这里再兜一道底：脚本必须完好地躺在产物里。
  if (!html.includes(bundle)) {
    throw new Error("打包失败：内联脚本没有原样进入产物（替换文本里的 $ 记号？）");
  }

  // index.html 头部那段提示是给 HTTP 版看的（"必须起服务器 / 想双击就用单文件版"）。
  // 单文件版里用户已经在用单文件了，这段提示纯属噪音，整段删掉。
  const note = /[ \t]*<p class="sub note">[\s\S]*?<\/p>\r?\n?/;
  if (!note.test(html)) throw new Error('index.html 里找不到头部提示（class="sub note"）');
  html = html.replace(note, "");

  // 示例图是外部 SVG，单文件版必须把它们内联成 data URI，否则拷走一个文件就看不到图。
  html = html.replace(/src="(example\/[\w.-]+\.svg)"/g, (whole, rel) => {
    const svg = readFileSync(join(ROOT, rel), "utf8");
    const data = Buffer.from(svg, "utf8").toString("base64");
    return `src="data:image/svg+xml;base64,${data}"`;
  });

  return html;
}

/**
 * 生成 standalone.html 的内容。
 * 单独抽成函数，好让 check-project.mjs 能拿它和磁盘上的文件对比，
 * 从而发现"改了 src/ 却忘了重新构建"。
 * @returns {{html: string, bundle: string, report: string[]}}
 */
export function buildStandalone() {
  const { bundle, report } = buildBundle();
  return { html: buildHtml(bundle), bundle, report };
}

// 直接运行本文件时才写盘；被 import 时只导出函数
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { html, bundle, report } = buildStandalone();
  writeFileSync(join(ROOT, OUT_NAME), html, "utf8");

  console.log("模块（按依赖顺序拼接）：");
  console.log(report.join("\n"));
  console.log(`\n顶层声明 ${new Set(topLevelNames(bundle)).size} 个，无重名冲突。`);
  console.log(`已写入 ${OUT_NAME}  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
}
