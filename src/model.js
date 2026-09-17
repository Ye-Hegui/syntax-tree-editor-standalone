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

export function node(label = "", children = []) {
  // italic / bold / strike / color 由记法末尾的 Italic(...) / Bold(...) / Strike(...) / Red(...) 声明设置，见 style.js
  return { id: SEQ++, label, sub: null, sup: null, arrow: null, italic: false, bold: false, strike: false, color: null, children };
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
 * 只有**投射链这条脊柱**会下沉，链顶其余的女儿节点留在原来的高度，
 * 改挂到新层底下。具体做法：
 *   1. 找到投射链的最顶端（下称链顶）和链顶上那个"链上的女儿节点"
 *   2. 新建一层，标签 = 链顶标签再加一个撇
 *   3. 新层顶替链顶的位置；链顶成为新层的第一个女儿节点
 *   4. 链顶其余的女儿节点改挂到新层底下（它们的高度因此不变）
 *
 *   [CP [C that] [TP [N Chomsky] [T' [T will] [VP [V love] [N AI]]]]]   对 T 按 Tab
 *   -> [CP [C that] [TP [N Chomsky] [T'' [T' [T will]] [VP [V love] [N AI]]]]]
 *      新层 T'' 拿到了 T' 和 VP，T' 只留下 T
 *
 * @returns {object|null} 新建的节点
 */
export function addPrimeLevel(root, n) {
  const chain = primeChain(root, n);
  const spineTop = chain[chain.length - 1];
  const spineChild = chain.length >= 2 ? chain[chain.length - 2] : null;
  const grandmother = findParent(root, spineTop);
  if (!grandmother) return null;

  const created = node(spineTop.label + "'");
  const others = spineTop.children.filter((c) => c !== spineChild);
  spineTop.children = spineChild ? [spineChild] : [];
  created.children = [spineTop, ...others];
  grandmother.children[grandmother.children.indexOf(spineTop)] = created;
  return created;
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
 *   [CP [C that] [TP [N Chomsky] [T'' [T' [T will]] [V]]]]   对 T 上移
 *   -> [CP [C that] [TP [N Chomsky] [T' [T will] [V]]]]
 *      T' 被删掉、T 提上去，上面的 T'' 顺势改名成 T'
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
