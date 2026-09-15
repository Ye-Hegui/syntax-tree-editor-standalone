// 用编辑器自己生成「使用方法」里的示例图，存到 example/。
//
//   node tools/gen-examples.mjs
//
// 走的是编辑器自己的 toSvgString()，所以图和编辑器里看到的完全一致；
// 改了 src/ 之后重新跑一次即可。build-standalone.mjs 会把这些 SVG 内联进单文件版。

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom } from "../test/dom-shim.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "example");

/** 两张图分别用哪个例句 */
const CASES = [
  { name: "base", value: "[XP [Z word1] [X' [X word2] [Y word3]]]" },
  { name: "triangle", value: "[XP [Z word1] [X' [X word2 word4] [Y word3]]]" },
  { name: "arrow", value: "[XP [Z word1] [X' [X word2] [Y word3 ->3]]]" },
  // 2.2 下移：对 X 下移之后
  { name: "down", value: "[XP [Z word1] [X'' [X' [X word2]] [Y word3]]]" },
  // 2.4 左移右移的三个结果
  { name: "left-xp", value: "[XP [X' [X word2] [Y word3]] [Z word1]]" },
  { name: "left-x", value: "[XP [Z [word1] [X word2]] [X' [Y word3]]]" },
  { name: "right-x", value: "[XP [Z word1] [X' [Y word3] [X word2]]]" },
  // 2.5 斜体
  { name: "italic", value: "[vP [v [V know]] [pro [N him]]]\nItalic(1, 2)" },
];

installDom();
const { SyntaxTreeEditor } = await import(pathToFileURL(join(ROOT, "src/editor.js")).href);

mkdirSync(OUT_DIR, { recursive: true });

for (const { name, value } of CASES) {
  const host = document.createElement("div");
  const editor = new SyntaxTreeEditor(host, { value });
  const svg = editor.toSvgString({ background: true });
  if (!svg.startsWith("<svg") || svg.length < 200) {
    throw new Error(`${name}: 生成的 SVG 不正常（${svg.length} 字节）`);
  }
  writeFileSync(join(OUT_DIR, `${name}.svg`), svg, "utf8");
  const size = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  console.log(`  example/${name}.svg   ${svg.length} 字节   viewBox ${size ? size[1] + "×" + size[2] : "?"}`);
}
console.log("✓ 示例图已生成");
