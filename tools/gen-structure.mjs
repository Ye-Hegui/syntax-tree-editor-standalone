// 生成 STRUCTURE.md —— 项目里每个文件、每个函数的位置和说明。
//
// 行号是从源码里现提取的，所以不会手写错。改了源码之后跑一下：
//   node tools/gen-structure.mjs
// （tools/check-project.mjs 会检查这份文档是不是最新的）

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** 每个文件是干什么的 */
const PURPOSE = {
  "Syntax Tree Editor Standalone.html": "⭐ 交付的单文件版，双击即用。由 tools/build-standalone.mjs 生成，**不要手改**。",
  "index.html": "演示页 + 「使用方法」文档（分级目录、九个章节）。需要 HTTP 打开，见 README。",
  "style.css": "全部样式。编辑器部分用 `.ste-` 前缀，文档部分用 `.docs` 前缀。",
  "package.json": "只提供三个命令：`build` / `test` / `serve`。零依赖。",
  "README.md": "项目说明：设计取舍、快捷键、两套记法、已知限制。",
  ".gitignore": "忽略临时文件。单文件版是交付物，**不**忽略。",

  "src/model.js": "数据模型 + 所有结构操作。不依赖 DOM，是唯一真相来源。",
  "src/notation.js": "括号记法 ↔ 模型：词法分析、递归下降解析、序列化、文本位置映射。",
  "src/rules.js": "规则记法 ↔ 模型：一行一条「母亲节点 → 女儿节点」。",
  "src/layout.js": "tidy tree 布局 + 三种垂直对齐。文字宽度靠注入的 measure()，不依赖 DOM。",
  "src/render.js": "把布局结果画成可交互 SVG。视觉属性全部内联，导出的图脱离页面也能看。",
  "src/editor.js": "核心组件 SyntaxTreeEditor：交互、快捷键、撤销、双向同步、空白画布、装订线。",
  "src/main.js": "演示页引导：例句、URL 参数。",

  "test/smoke.mjs": "纯逻辑测试（不需要浏览器）。",
  "test/rules.test.mjs": "规则记法测试。",
  "test/editor.test.mjs": "交互层测试（跑在 DOM 垫片上）。",
  "test/standalone.test.mjs": "单文件构建产物测试：模块没漏、内联后真的能跑。",
  "test/dom-shim.mjs": "最小 DOM 垫片，让编辑器能在 Node 里跑起来。",

  "tools/build-standalone.mjs": "把 7 个模块内联成那个单文件版。",
  "tools/check-project.mjs": "一致性自检：文档 / 文件结构 / 构建产物不许对不上。",
  "tools/gen-structure.mjs": "生成这份 STRUCTURE.md。",
  "screenshots/": "手工截的图，被 README 引用（和 example/ 不同：那边是生成的）。",
};

const NOTES = {
  "src/model.js": "术语统一用**母亲节点 / 姊妹节点 / 女儿节点**。节点结构 `{ id, label, sub, sup, arrow, children }`。",
  "src/notation.js": "括号记法的箭头用**词序号**（从左到右第几个词，从 1 开始，与 jsSyntaxTree 一致），样式声明用**节点编号**。",
  "src/rules.js": "编号 = 行号，所以插行/删行会让下面引用错位；编辑器会自动改回去。",
  "src/editor.js": "私有方法以 `#` 开头，只在类内部使用。",
};

/** 取某个位置上方最近的注释的**第一句**，作为这一项的说明 */
function docAbove(lines, index) {
  let i = index - 1;
  while (i >= 0 && lines[i].trim() === "") i--;
  if (i < 0) return "";
  const line = lines[i].trim();

  // 多行 JSDoc：往上找到 /**，取它下面的第一行正文
  if (line === "*/") {
    let j = i;
    while (j >= 0 && !lines[j].trim().startsWith("/**")) j--;
    if (j < 0) return "";
    for (let k = j + 1; k < i; k++) {
      const t = lines[k].trim().replace(/^\*\s?/, "").trim();
      if (t && !t.startsWith("@")) return t;
    }
    return "";
  }
  if (line.startsWith("//")) return line.replace(/^\/\/\s?/, "").trim();
  return "";
}

function esc(s) {
  return String(s).replace(/\|/g, "\\|");
}

/** 抽出顶层声明 */
function topLevel(text) {
  const lines = text.split("\n");
  const out = [];
  lines.forEach((line, i) => {
    const m =
      /^(?:export\s+)?(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/.exec(line) ||
      /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
    if (m) out.push({ name: m[1], line: i + 1, doc: docAbove(lines, i) });
  });
  return out;
}

/** 抽出类里的方法：先定位类体的范围，再看缩进两格的定义 */
function methods(text) {
  const lines = text.split("\n");
  const out = [];

  lines.forEach((line, i) => {
    if (!/^(?:export\s+)?class\s/.test(line)) return;

    // 从类声明开始数大括号，找到类体结束
    let depth = 0;
    let started = false;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") depth--;
      }

      if (started && depth === 0) break; // 类体结束
      if (j === i) continue;

      const m = /^ {2}(?:static\s+)?(?:async\s+)?(#?[A-Za-z_$][\w$]*)\s*\(/.exec(lines[j]);
      if (!m) continue;
      const name = m[1];
      if (["if", "for", "while", "switch", "catch", "return", "function"].includes(name)) continue;
      out.push({ name, line: j + 1, doc: docAbove(lines, j) });
    }
  });

  return out;
}

function table(rows, label) {
  if (!rows.length) return "";
  let s = `\n**${label}**\n\n| 行 | 名称 | 说明 |\n| --- | --- | --- |\n`;
  for (const r of rows) s += `| ${r.line} | \`${r.name}\` | ${esc(r.doc) || "—"} |\n`;
  return s;
}

// ---------------------------------------------------------------- 组装

const out = [];
out.push("# 目录与函数索引\n");
out.push(
  "这份文件由 `tools/gen-structure.mjs` 自动生成，行号取自源码。\n" +
    "改了源码之后跑 `node tools/gen-structure.mjs` 重新生成；`npm test` 会检查它是不是最新的。\n",
);

out.push("\n## 顶层（工作区）\n\n```\nSyntax Tree Helper/\n├── README.md              工作区说明：哪部分是自己写的、哪部分是参考项目\n├── Todolist.md            待办清单（简明版）\n├── HANDOVER.md            交接笔记（本地，不在仓库里）\n├── Syntax Tree Editor Standalone/    ⭐ 正式项目（下面详细展开）\n├── disk_v1.2.0/           网盘版 v1.2.0 快照（不要动）\n├── reference/             只读参考（jsSyntaxTree，GPL-2.0）\n└── archive/               过期与一次性产物\n```\n");

out.push("\n## Syntax Tree Editor Standalone/\n\n```\nSyntax Tree Editor Standalone/\n├── Syntax Tree Editor Standalone.html   双击即用的单文件版（构建产物）\n├── index.html         演示页 + 使用教程\n├── style.css          全部样式\n├── package.json       build / test / serve\n├── README.md          项目说明（面向使用者，中英对照）\n├── AGENTS.md          给 AI agent 的项目说明\n├── AI-INTRO.md        给 AI 的规则记法说明与出图入口\n├── CHANGELOG.md       更新日志\n├── STRUCTURE.md       本文件（自动生成）\n├── LICENSE            MIT\n├── .gitignore / .gitattributes\n├── src/               8 个模块\n├── test/              4 个测试套件 + DOM 垫片\n├── tools/             构建、自检、生成示例图与索引、文本出图\n├── screenshots/       手工截图（README 用）\n└── example/           教程配图（生成，构建时内联）\n```\n");

const groups = [
  ["入口与样式", ["index.html", "style.css", "package.json", "README.md", ".gitignore", "Syntax Tree Editor Standalone.html"]],
  ["src/ —— 源码", readdirSync(join(ROOT, "src")).filter((f) => f.endsWith(".js")).map((f) => `src/${f}`)],
  ["test/ —— 测试", readdirSync(join(ROOT, "test")).filter((f) => f.endsWith(".mjs")).map((f) => `test/${f}`)],
  ["tools/ —— 工具", readdirSync(join(ROOT, "tools")).filter((f) => f.endsWith(".mjs")).map((f) => `tools/${f}`)],
  ["screenshots/ —— 手工截图（README 用）", readdirSync(join(ROOT, "screenshots")).map((f) => `screenshots/${f}`)],
];

for (const [title, files] of groups) {
  out.push(`\n---\n\n## ${title}\n`);
  for (const f of files) {
    const text = read(f);
    out.push(`\n### \`${f}\`\n`);
    const bytes = statSync(join(ROOT, f)).size;
    const lines = text.split("\n").length;
    out.push(`> ${PURPOSE[f] || "—"}\n`);
    if (/\.(js|mjs)$/.test(f)) out.push(`> ${lines} 行 / ${bytes} 字节\n`);
    if (NOTES[f]) out.push(`\n${NOTES[f]}\n`);

    if (!/\.(js|mjs)$/.test(f)) continue;
    const tops = topLevel(text);
    const ms = methods(text);
    const classes = tops.filter((t) => /class/.test(text.split("\n")[t.line - 1]));
    const fns = tops.filter((t) => !classes.includes(t));

    out.push(table(fns, "函数"));
    out.push(table(classes, "类"));
    if (ms.length) out.push(table(ms, "方法与字段"));
  }
}

out.push("\n---\n\n## 常用命令\n");
out.push("| 命令 | 作用 |\n| --- | --- |\n");
out.push("| `npm test` | 四个测试套件 + 一致性自检 |\n");
out.push("| `npm run build` | 重新生成 `standalone.html` |\n");
out.push("| `npm run check` | 只跑一致性自检 |\n");
out.push("| `node tools/gen-structure.mjs` | 重新生成这份目录 |\n");
out.push("| `npm run serve` | 起本地 HTTP 服务（演示页需要） |\n");

const md = out.join("");
writeFileSync(join(ROOT, "STRUCTURE.md"), md, "utf8");
console.log(`已生成 STRUCTURE.md  ${(Buffer.byteLength(md) / 1024).toFixed(1)} KB`);
