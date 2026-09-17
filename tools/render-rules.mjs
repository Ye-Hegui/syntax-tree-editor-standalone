// 规则记法文本 -> SVG 文件。给 AI / 脚本用的一条命令，不需要起服务器、不需要浏览器：
//
//   node tools/render-rules.mjs 输入.txt 输出.svg
//   node tools/render-rules.mjs 输入.txt 输出.svg --align leaves --font-size 18
//   type 输入.txt | node tools/render-rules.mjs - 输出.svg      （输入用 - 表示从标准输入读）
//
// 选项：
//   --bracket          按【括号记法】解析（默认是规则记法）
//   --align <值>       depth（默认）| leaves | compact
//   --center <值>      mother（默认）| block
//   --font-size <数>   默认 16
//   --no-background    不要白底（默认带白底，便于直接贴进文档）
//
// 出错时把解析错误原样打出来并以退出码 1 结束（错误信息带行号，方便改正）。

import { readFileSync, writeFileSync } from "node:fs";
import { installDom } from "../test/dom-shim.mjs";

installDom();
const { rulesToSvg } = await import("../src/editor.js");

const argv = process.argv.slice(2);
const positional = [];
const options = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--bracket") options.mode = "bracket";
  else if (a === "--no-background") options.background = false;
  else if (a === "--align") options.align = argv[++i];
  else if (a === "--center") options.center = argv[++i];
  else if (a === "--font-size") options.fontSize = Number(argv[++i]);
  else if (a === "-h" || a === "--help") {
    console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(0, 13).join("\n"));
    process.exit(0);
  } else positional.push(a);
}

const [inPath, outPath] = positional;
if (!inPath || !outPath) {
  console.error("用法：node tools/render-rules.mjs 输入.txt 输出.svg [--bracket] [--align leaves] [--font-size 18]");
  process.exit(2);
}

const text = inPath === "-" ? readFileSync(0, "utf8") : readFileSync(inPath, "utf8");

let svg;
try {
  svg = rulesToSvg(text, options);
} catch (err) {
  console.error(`解析失败：${err.message}`);
  process.exit(1);
}

writeFileSync(outPath, svg, "utf8");
const size = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
console.log(`✓ 已写入 ${outPath}  ${svg.length} 字节  viewBox ${size ? `${size[1]}×${size[2]}` : "?"}`);
