// 项目一致性自检：文档、文件结构、构建产物之间不许对不上。
//
// 这些检查以前是我手工跑一次性的脚本，现在固定下来，免得以后悄悄跑偏。
//
//   node tools/check-project.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildStandalone } from "./build-standalone.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let problems = 0;
const fail = (msg) => {
  problems++;
  console.log(`  ✗ ${msg}`);
};
const pass = (msg) => console.log(`  ✓ ${msg}`);
const section = (title) => console.log(`\n=== ${title} ===`);

const README = read("README.md");
const INDEX = read("index.html");

// ---------------------------------------------------------------- 1. 图片引用

section("文档里引用的图片都存在，且没有孤儿图");
for (const [name, text] of [["README.md", README], ["index.html", INDEX]]) {
  for (const m of text.matchAll(/(screenshots\/[\w.-]+\.png)/g)) {
    if (existsSync(join(ROOT, m[1]))) pass(`${name} -> ${m[1]}`);
    else fail(`${name} 引用了不存在的 ${m[1]}`);
  }
}
const referenced = new Set();
for (const text of [README, INDEX]) {
  for (const m of text.matchAll(/(screenshots\/[\w.-]+\.png)/g)) referenced.add(m[1]);
}
for (const f of readdirSync(join(ROOT, "screenshots"))) {
  const p = `screenshots/${f}`;
  if (referenced.has(p)) pass(`${p} 有被引用`);
  else fail(`${p} 没有被任何文档引用（孤儿图）`);
}

// ---------------------------------------------------------- 2. 测试项数一致性

section("README 写的测试项数 = 测试文件里的用例数");
// 测试都是顶层 `t(...)` / `await t(...)` 调用，数调用点即可
const countCases = (file) =>
  read(file)
    .split("\n")
    .filter((l) => /^\s*(await\s+)?t\(/.test(l)).length;

for (const [file, label] of [
  ["test/smoke.mjs", "smoke.mjs"],
  ["test/rules.test.mjs", "rules.test.mjs"],
  ["test/editor.test.mjs", "editor.test.mjs"],
  ["test/standalone.test.mjs", "standalone.test.mjs"],
]) {
  const actual = countCases(file);
  // README 里写作：node test/smoke.mjs   # 说明（56 项）
  const m = new RegExp(`${label.replace(/\./g, "\\.")}[^\\n]*（(\\d+) 项）`).exec(README);
  if (!m) {
    fail(`README 里没写 ${label} 的项数`);
  } else if (Number(m[1]) !== actual) {
    fail(`${label}：README 写 ${m[1]} 项，实际 ${actual} 项`);
  } else {
    pass(`${label}：${actual} 项`);
  }
}

// ---------------------------------------------------------- 3. 文件结构清单

section("README 的文件结构清单覆盖了所有源码");
const treeSection = README.slice(README.indexOf("## 文件结构"), (README.indexOf("\n## ", README.indexOf("## 文件结构") + 1) + 1 || README.length));
for (const dir of ["src", "test", "tools"]) {
  for (const f of readdirSync(join(ROOT, dir))) {
    if (treeSection.includes(f)) pass(`${dir}/${f} 在清单里`);
    else fail(`${dir}/${f} 没写进 README 的文件结构`);
  }
}

// ---------------------------------------------------------- 4. 构建产物最新

section("Syntax Tree Editor Standalone.html 是最新的（改了 src/ 有没有忘记重新构建）");
const onDisk = read("Syntax Tree Editor Standalone.html");
const { html: rebuilt, bundle } = buildStandalone();

if (onDisk === rebuilt) {
  pass("Syntax Tree Editor Standalone.html 与重新构建的结果完全一致");
} else {
  fail("Syntax Tree Editor Standalone.html 已经过期：src/ 或 index.html 改过但没重新构建，请跑 npm run build");
}

for (const f of readdirSync(join(ROOT, "src"))) {
  if (!f.endsWith(".js")) continue;
  if (bundle.includes(`// ===== src/${f} `)) pass(`内联了 src/${f}`);
  else fail(`构建结果里缺少 src/${f}（打包脚本的 MODULES 列表漏了？）`);
}

// ---------------------------------------------------------------- AGENTS.md 和源码对得上吗

section("中英文案表的 key 一一对应");

{
  const { STRINGS, TERMS, TERM_KINDS, LANGS, DEFAULT_TERM } = await import("../src/i18n.js");

  const zhKeys = Object.keys(STRINGS.zh).sort();
  const enKeys = Object.keys(STRINGS.en).sort();
  const onlyZh = zhKeys.filter((k) => !(k in STRINGS.en));
  const onlyEn = enKeys.filter((k) => !(k in STRINGS.zh));
  if (onlyZh.length || onlyEn.length)
    fail(`文案表两边对不上：中文多 [${onlyZh.join(", ")}]；英文多 [${onlyEn.join(", ")}]`);
  else pass(`${zhKeys.length} 条文案 key，中英完全一致`);

  for (const lang of LANGS) {
    const def = (DEFAULT_TERM || {})[lang];
    if (!TERM_KINDS.includes(def)) fail(`${lang} 的默认称谓 ${JSON.stringify(def)} 不是三套之一`);
    else pass(`${lang} 的默认称谓是 ${def}`);

    for (const kind of TERM_KINDS) {
      const pairs = (TERMS[lang] || {})[kind];
      if (pairs == null) {
        pass(`${lang}/${kind} 是基准写法，不需要替换`);
        continue;
      }
      const bad = pairs.filter((p) => !Array.isArray(p) || p.length !== 2 || !p[0] || !p[1]);
      if (bad.length || !pairs.length) fail(`${lang}/${kind} 的替换表有问题：${JSON.stringify(bad)}`);
      else pass(`${lang}/${kind}：${pairs.length} 条替换`);
    }
  }
}

section("版本号三处一致（package.json / 页脚 / CHANGELOG 顶部）");

{
  // 发版流程要求这三处同步，但以前全靠人记；忘一处读者就会看到两个版本号。
  const pkg = JSON.parse(read("package.json"));
  const want = String(pkg.version);
  const footer = /v(\d+\.\d+\.\d+)\s*·/.exec(INDEX);
  const changelog = /^##\s+v(\d+\.\d+\.\d+)/m.exec(read("CHANGELOG.md"));
  const got = [
    ["package.json", want],
    ["index.html 页脚", footer ? footer[1] : "(找不到 vX.Y.Z)"],
    ["CHANGELOG 顶部的一节", changelog ? changelog[1] : "(找不到 ## vX.Y.Z)"],
  ];
  const bad = got.filter(([, v]) => v !== want);
  if (bad.length) fail(`版本号对不上：期望 ${want}，但 ${bad.map(([n, v]) => `${n} 是 ${v}`).join("；")}`);
  else pass(`三处都是 v${want}`);
}

section("教程正文中英两版的锚点一一对应");

{
  const { DOCS_EN } = await import("../src/docs-en.js");
  const idsOf = (html) => new Set([...html.matchAll(/id="(doc-[\w-]+)"/g)].map((m) => m[1]));
  const hrefsOf = (html) => [...html.matchAll(/href="#(doc-[\w-]+)"/g)].map((m) => m[1]);
  const zhIds = idsOf(INDEX);
  const enIds = idsOf(DOCS_EN);

  const onlyZh = [...zhIds].filter((id) => !enIds.has(id));
  const onlyEn = [...enIds].filter((id) => !zhIds.has(id));
  if (onlyZh.length || onlyEn.length)
    fail(`中英正文的 id 对不上：中文多 [${onlyZh.join(", ")}]；英文多 [${onlyEn.join(", ")}]`);
  else pass(`${zhIds.size} 个 doc-* 锚点，两版一致`);

  // 每一版自己：目录里的每个 href 都要能找到对应的 id
  for (const [name, html] of [["index.html", INDEX], ["src/docs-en.js", DOCS_EN]]) {
    const missing = hrefsOf(html).filter((h) => !idsOf(html).has(h));
    if (missing.length) fail(`${name} 的目录指向了不存在的锚点：${[...new Set(missing)].join(", ")}`);
    else pass(`${name} 的目录锚点全部能对上`);
  }
}

section("AGENTS.md 没有和源码脱节");

{
  const agents = read("AGENTS.md");
  // 文档里提到的东西可能落在任何一个模块里，所以搜全部源码
  const allSrc = readdirSync(join(ROOT, "src"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => read(`src/${f}`))
    .join("\n");

  // 文档里 `editor.xxx(` 或表格里的 `xxx(` 提到的公开方法，必须真的存在
  const named = new Set();
  for (const m of agents.matchAll(/`([A-Za-z_$][\w$]*)\(/g)) named.add(m[1]);
  const known = new Set(["parse", "serialize", "toText", "parseRules", "serializeRules", "toRulesText",
    "layout", "drawTree", "measure", "nodeIds", "resolveMother", "read", "join", "existsSync"]);
  const missing = [...named].filter((n) => !known.has(n) && !allSrc.includes(`${n}(`));
  if (missing.length) fail(`AGENTS.md 提到的方法在源码里找不到：${missing.join(", ")}`);
  else pass("AGENTS.md 提到的方法都能在源码里找到");

  // 每个 src 模块都要在文档里出现
  for (const f of readdirSync(join(ROOT, "src"))) {
    if (!f.endsWith(".js")) continue;
    if (agents.includes(`src/${f}`)) pass(`AGENTS.md 提到了 src/${f}`);
    else fail(`AGENTS.md 没提 src/${f}`);
  }

  // 目录锚点和正文 id 必须配对（教程里链接失效是最难发现的坑）
  const html = read("index.html");
  const hrefs = [...html.matchAll(/href="#(doc-[\w-]+)"/g)].map((m) => m[1]);
  const ids = new Set([...html.matchAll(/id="(doc-[\w-]+)"/g)].map((m) => m[1]));
  const dead = [...new Set(hrefs)].filter((h) => !ids.has(h));
  if (dead.length) fail(`index.html 里有指向不存在锚点的链接：${dead.join(", ")}`);
  else pass("教程里每个页内链接都有对应的标题");
}

// ---------------------------------------------------------------- 收尾

console.log(
  problems === 0
    ? "\n一致性自检全部通过。\n"
    : `\n发现 ${problems} 个问题。\n`,
);
process.exit(problems === 0 ? 0 : 1);
