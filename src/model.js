// 语法树数据模型 —— 编辑器的唯一真相来源（single source of truth）
//
// 术语统一：**母亲节点**（mother）、**女儿节点**（daughter）、**姊妹节点**（sister）。
// 根节点没有母亲节点。
//
// 节点结构: { id, label, sub, sup, arrow, children }
//   - children 为空 => 叶子节点。叶子节点在括号记法里写成裸标签（不带方括号）
//   - sub / sup   => 下标 / 上标，字符串或 null
//   - arrow       => { target, targetIndex }
//        记法统一写成 `-->N`，N 是两套记法共用的节点编号（见 nodeIds）。
//        target 是目标节点的对象引用（编辑时结构会变，用引用比用序号稳）；
//        targetIndex 是从记法里解析出来的原始编号，引用失效时兜底。

let SEQ = 1;

/**
 * 转义节点的标签。记法里**裸写**它（`%Empty`，精确大小写）表示"这一层不画方框"：
 * 导出的图里，上面连过来的那条线会和它某个女儿的那条线画成**一条直线**（夹角 180°）。
 * 想让它只当一个普通标签，写带引号的 `"%Empty"`。
 *
 * ⚠️ 这个功能作者确定**不公开**：不写进 README、教程和 CHANGELOG，只在 AGENTS.md 与
 * HANDOVER.md 里留说明。
 */
export const ESCAPE_LABEL = "%Empty";

/**
 * 这个标签算不算转义节点：`%Empty` 后面**可以跟任意个撇**（`%Empty'`、`%Empty''` …）。
 *
 * 为什么要允许撇：`下移`（Tab）会给投射链顶端的标签加一个 `'`，而转义节点往往正是链顶 ——
 * 不允许撇的话，对转义节点按一下 Tab 它就不再是转义节点了（作者 2026-09-17 提的）。
 *
 * ⚠️ 只认裸写的；带引号的 `"%Empty'"` 只是普通标签（见 notation.js / rules.js 的判定）。
 */
export function isEscapeLabel(label) {
  return typeof label === "string" && /^%Empty'*$/.test(label);
}

export function node(label = "", children = []) {
  // italic / bold / strike / color 由记法末尾的 Italic(...) / Bold(...) / Strike(...) / Red(...) 声明设置，见 style.js
  // escape 只由记法里裸写的 %Empty 设置（见 notation.js / rules.js），改名时会跟着标签同步
  return { id: SEQ++, label, sub: null, sup: null, arrow: null, italic: false, bold: false, strike: false, color: null, escape: false, children };
}

export function walk(n, fn, parent = null) {
  fn(n, parent);
  for (const c of n.children) walk(c, fn, n);
}

/** 先序遍历 */
export function preorder(root) {
  const out = [];
  walk(root, (n) => out.push(n));
  return out;
}

/** 找 n 的母亲节点；n 就是根节点时返回 null */
export function findParent(root, target) {
  let found = null;
  walk(root, (n, p) => {
    if (n === target) found = p;
  });
  return found;
}

/**
 * 两套记法共用的节点编号。
 *
 * 根节点是 0；其余节点按"第一次作为女儿节点出现的顺序"编号，也就是规则记法里
 * 那一行最左边的行号。给一棵树就能算出来，所以两套记法看到的编号永远一致。
 *
 *   [XP [D w1] [X' [X w2] [Y w3]]]
 *     XP=0  D=1  X'=2  w1=3  X=4  Y=5  w2=6  w3=7
 *
 * @returns {Map<object, number>}
 */
export function nodeIds(root) {
  const ids = new Map([[root, 0]]);
  let next = 0;
  (function emit(n) {
    for (const c of n.children) ids.set(c, ++next);
    for (const c of n.children) emit(c);
  })(root);
  return ids;
}

export function addChild(parent, child, index = parent.children.length) {
  const at = Math.max(0, Math.min(index, parent.children.length));
  parent.children.splice(at, 0, child);
  // 一旦有了女儿节点，这个节点在记法里就无法再携带箭头了
  if (parent.children.length > 0) parent.arrow = null;
  return child;
}

/** 删除节点及其整棵子树；根节点不可删。会顺带清理指向被删叶子节点的箭头 */
export function removeNode(root, n) {
  if (n === root) return false;
  const mother = findParent(root, n);
  if (!mother) return false;
  mother.children.splice(mother.children.indexOf(n), 1);

  const gone = new Set(preorder(n));
  walk(root, (x) => {
    if (x.arrow && x.arrow.target && gone.has(x.arrow.target)) x.arrow = null;
  });
  return true;
}

// ------------------------------------------------------------ 投射层（加 ' ）

/**
 * 深拷贝一棵子树（含自己），每个节点都拿**新的 id**。
 *
 * id 必须换新：SVG 上每个节点挂 `data-id`，点击命中和选中都靠它，
 * 两份子树共用一个 id 会让选中错乱。
 *
 * 箭头一起拷，但其中的落点引用只是原样带过来 —— 落点可能就在被复制的子树里，
 * 那时它指向的还是原来那个节点，所以调用方拿到 map 之后要用 remapArrowTargets()
 * 把落在复制区里的落点改指到副本上。
 *
 * @returns {{root: object, map: Map<object, object>}} 副本子树的根，以及 原节点 -> 副本节点 的对照表
 */
export function cloneSubtree(n) {
  const map = new Map();
  function copy(x) {
    const c = node(x.label);
    c.sub = x.sub;
    c.sup = x.sup;
    c.italic = x.italic;
    c.bold = x.bold;
    c.strike = x.strike;
    c.color = x.color;
    c.escape = x.escape;
    c.arrow = x.arrow ? { ...x.arrow } : null;
    map.set(x, c);
    c.children = x.children.map(copy);
    return c;
  }
  return { root: copy(n), map };
}

/**
 * 把落在 map 里的箭头落点改指到对应的副本上。
 *
 * 复制/摘除子树之后必须做这一步：箭头存的是**节点引用**，
 * 子树一旦被换成副本，旧引用就指向树外的孤儿节点，那把箭头会被静默丢掉。
 */
function remapArrowTargets(root, map) {
  walk(root, (x) => {
    if (x.arrow && x.arrow.target && map.has(x.arrow.target)) x.arrow.target = map.get(x.arrow.target);
  });
}

/**
 * 沿投射链往上走，返回 [n, n', n'', ...]（从下往上）。
 *
 * 链的规则：某一层的标签正好是它女儿节点的标签再加一个撇，它们就属于同一条链。
 * 例：X -> X' -> X'' -> XP 里，链是 [X, X', X'']，因为 XP 不是 X''' 而断掉。
 */
function primeChain(root, n) {
  const chain = [n];
  let current = n;
  for (;;) {
    const mother = findParent(root, current);
    if (!mother || mother.label !== current.label + "'") break;
    chain.push(mother);
    current = mother;
  }
  return chain;
}

/** 能不能增加一层投射层：投射链的最顶端上面还得有一个母亲节点 */
export function canAddPrimeLevel(root, n) {
  if (!root || !n) return false;
  const chain = primeChain(root, n);
  return findParent(root, chain[chain.length - 1]) !== null;
}

/**
 * 下移（Tab）：给投射链增加一层投射层。
 *
 * 做法是拿**投射链的最顶端**（下称链顶）套一层"自己的副本"：
 *   1. 把链顶整棵子树深拷贝一份
 *   2. 链顶清空自己的女儿节点、标签加一个撇 —— 它自己就是新的那一层了
 *   3. 副本挂回链顶底下，于是链顶只有副本这一个女儿节点
 *
 * 关键点：**整棵子树原样下沉一层，链顶其余的女儿节点不会被提到新层上**。
 * （"只让投射链这条脊柱下沉、其余女儿节点留在原高度"是已废弃的旧行为。）
 *
 *   [XP [Z word1] [X' [X word2] [Y word3]]]     对 X 按 Tab（链顶是 X'）
 *   -> [XP [Z word1] [X'' [X' [X word2] [Y word3]]]]
 *      X'' 只带一个女儿 X'，X' 底下的 X 和 Y 都还在原处，只是整棵子树深了一层
 *
 * 根节点不能下移：链顶上面必须还有一个母亲节点。
 * （给整棵树加一层是"加一个顶层"，不是下移，编辑器有别的入口。）
 *
 * @returns {object|null} **选中节点**的副本（它比原来深了一层）。
 *   编辑器会把这个副本设为选中，于是连续按 Tab 就是选中的节点一层一层往下走；
 *   如果改返回链顶的副本，选中的位置会固定在同一层，看着就像"卡在中间"。
 */
export function addPrimeLevel(root, n) {
  const chain = primeChain(root, n);
  const spineTop = chain[chain.length - 1];
  if (!findParent(root, spineTop)) return null;

  const { root: copy, map } = cloneSubtree(spineTop);
  spineTop.children = [copy];
  spineTop.label = spineTop.label + "'";
  // 链顶现在有女儿节点了，不再是叶子；记法表达不了"带箭头的非叶子"，所以箭头留给副本
  spineTop.arrow = null;
  remapArrowTargets(root, map);
  return map.get(n) || copy;
}

/**
 * 能不能减一层投射。要求同时满足：
 *   1. 母亲节点只有 n 这一个女儿节点
 *   2. 母亲节点的标签正好是 n 的标签加一个撇
 */
export function canCollapsePrimeLevel(root, n) {
  if (!root || !n) return false;
  const mother = findParent(root, n);
  if (!mother) return false;
  return mother.children.length === 1 && mother.label === n.label + "'";
}

/**
 * 上移（Shift+Tab）：下移的逆。
 *
 * 先删掉母亲节点、让 n 顶替它的位置；再把母亲节点以上的每一层各减一个撇，
 * 这样"第 k 层有 k 个撇"的规律才继续成立。
 *
 * 因为下移造出来的那一层只有一个女儿节点，所以**该选谁**很明确：
 * 选下移时复制出来的那个（也就是新层里面的那个），它的母亲正好是那一层。
 *
 *   [XP [Z word1] [X'' [X' [X word2] [Y word3]]]]   对 X' 上移
 *   -> [XP [Z word1] [X' [X word2] [Y word3]]]
 *      X'' 被删掉、X' 提上去，正好退回下移之前的样子
 *
 * @returns {object|null} 新的根（母亲节点就是根时根会变），不适用时返回 null
 */
export function collapsePrimeLevel(root, n) {
  if (!canCollapsePrimeLevel(root, n)) return null;

  const mother = findParent(root, n);
  const grandmother = findParent(root, mother);

  if (!grandmother) {
    // 母亲节点就是根：n 变成新的根
    mother.children = [];
    return n;
  }

  grandmother.children[grandmother.children.indexOf(mother)] = n;
  mother.children = [];

  // 母亲节点以上的每一层减一个撇
  let level = 1;
  let current = grandmother;
  while (current && current.label === n.label + "'".repeat(level + 1)) {
    current.label = n.label + "'".repeat(level);
    level++;
    current = findParent(root, current);
  }

  return root;
}

// ------------------------------------------------------------ 强制上移

/**
 * 能不能强制上移。唯一的条件是：**选中节点不能是根节点**（必须有母亲节点可改）。
 *
 * 和「上移」（`canCollapsePrimeLevel`）不同，这里**不看**那些严格前提
 * （母亲只有自己一个女儿、标签恰好多一个撇）—— 代价是删掉所有姊妹节点。
 */
export function canForceCollapseLevel(root, n) {
  if (!root || !n || n === root) return false;
  return Boolean(findParent(root, n));
}

/**
 * 强制上移（Alt+Shift+Tab）：把"母亲节点"这一格的名字换成选中节点的名字，
 * 让选中节点的女儿们升到母亲底下，然后把选中节点和它的所有姊妹都删掉。
 *
 * 作者给的逐步图（以选中 X 为例，M 是它的母亲，A/B 是 M 的姊妹）：
 *
 *   抽之前                          抽之后
 *         G                              G
 *       / | \                          / | \
 *     M   A   B                      X*   A   B      ← X* = 改名后的 M，位置没动
 *    /|\                            / \
 *  S1 X S2                        C1   C2
 *    / \
 *  C1   C2
 *
 * 步骤（和作者的图一一对应）：
 *   ① 删掉 M 里除 X 以外的所有女儿 —— 也就是 X 的所有姊妹（连同它们的子树）
 *   ② 把 X 的女儿们移到 M 底下、**紧跟 X 之后**（保序）
 *   ③ M 改用 X 的名字（标签 + 下标/上标一起搬；X 的斜体、颜色等样式不搬）
 *   ④ 把 X 从 M 的女儿里摘掉 —— 此时它已经没有女儿了
 *
 * ⚠️ 是**移动**不是拷贝：女儿们的节点对象原样换了个母亲，id 不变，
 * 所以子树里的位移箭头不需要重映射。
 *
 * @returns {object|null} 改名后的母亲节点（调用方拿它当新的选中），不适用时返回 null
 */
export function forceCollapseLevel(root, n) {
  if (!canForceCollapseLevel(root, n)) return null;

  const mother = findParent(root, n);
  const daughters = n.children.slice(); // 先留一份（保序）

  // ① X 的姊妹全删
  mother.children = mother.children.filter((c) => c === n);
  // ② 女儿们挂在 X 之后
  mother.children.push(...daughters);
  // ③ 母亲改用 X 的名字
  mother.label = n.label;
  mother.sub = n.sub;
  mother.sup = n.sup;
  // ④ 摘掉 X
  mother.children = mother.children.filter((c) => c !== n);
  n.children = [];

  return mother;
}

// ------------------------------------------------------------ 左移 / 右移

/**
 * 左移（Alt+←）。两个分支，和右移对称：
 *   ① 自己有左姊妹节点 -> 和它交换位置（原地左挪一位）
 *   ② 自己是最左边的女儿节点 -> 搬到「母亲节点的左姊妹节点」底下，
 *      当那个姊妹节点的**最右边**的女儿节点
 * 两条都不成立就不动。
 *
 *   [TP [N Chomsky] [T' [T will] [VP ...]]]   对 T 左移（T 是最左边的女儿节点）
 *   -> [TP [N [Chomsky] [T will]] [T' [VP ...]]]
 *
 *   [T' [T will] [VP ...]]                    对 VP 左移（VP 有左姊妹节点）
 *   -> [T' [VP ...] [T will]]
 */
export function moveNodeLeft(root, n) {
  const mother = findParent(root, n);
  if (!mother) return false;
  const index = mother.children.indexOf(n);
  if (index < 0) return false;

  // ① 有左姊妹节点：原地换位
  if (index > 0) {
    mother.children[index] = mother.children[index - 1];
    mother.children[index - 1] = n;
    return true;
  }

  // ② 自己是最左边的女儿节点：搬到母亲节点的左姊妹节点底下，放在最右边
  const grandmother = findParent(root, mother);
  if (!grandmother) return false; // 母亲节点就是根，它没有姊妹节点
  const motherIndex = grandmother.children.indexOf(mother);
  if (motherIndex <= 0) return false; // 母亲节点没有左姊妹节点

  const mothersLeftSister = grandmother.children[motherIndex - 1];
  mother.children.splice(index, 1);
  mothersLeftSister.children.push(n);
  // 那个姊妹节点原本可能是带箭头的叶子节点，现在它有女儿节点了，箭头就表示不出来了
  if (mothersLeftSister.children.length > 0) mothersLeftSister.arrow = null;
  return true;
}

/**
 * 右移（Alt+→）。和左移对称：
 *   ① 自己有右姊妹节点 -> 和它交换位置（原地右挪一位）
 *   ② 自己是最右边的女儿节点 -> 搬到「母亲节点的右姊妹节点」底下，
 *      当那个姊妹节点的**最左边**的女儿节点
 *
 *   [T' [T will] [VP ...]]                    对 T 右移（T 有右姊妹节点）
 *   -> [T' [VP ...] [T will]]
 *
 *   [TP [N Chomsky] [T' [T will] [VP ...]]]   对 Chomsky 右移（N 的最右边女儿节点）
 *   -> [TP [N] [T' [Chomsky] [T will] [VP ...]]]
 */
export function moveNodeRight(root, n) {
  const mother = findParent(root, n);
  if (!mother) return false;
  const index = mother.children.indexOf(n);
  if (index < 0) return false;

  // ① 有右姊妹节点：原地换位
  if (index < mother.children.length - 1) {
    mother.children[index] = mother.children[index + 1];
    mother.children[index + 1] = n;
    return true;
  }

  // ② 自己是最右边的女儿节点：搬到母亲节点的右姊妹节点底下，放在最左边
  const grandmother = findParent(root, mother);
  if (!grandmother) return false;
  const motherIndex = grandmother.children.indexOf(mother);
  if (motherIndex < 0 || motherIndex >= grandmother.children.length - 1) return false;

  const mothersRightSister = grandmother.children[motherIndex + 1];
  mother.children.splice(index, 1);
  mothersRightSister.children.unshift(n);
  if (mothersRightSister.children.length > 0) mothersRightSister.arrow = null;
  return true;
}
