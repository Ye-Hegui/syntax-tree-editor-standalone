// tidy tree 布局：自底向上算宽度，自顶向下分配坐标。
//
// 关键性质：母亲节点永远水平居中于它女儿节点的包围盒之上。
// 文字宽度通过注入的 measure() 获取，因此本模块不依赖 DOM，可以在 Node 里测试。
//
// 垂直对齐有三种模式（options.align）：
//   "depth"   每个节点在自己的层级行上，同层等高（默认）
//   "leaves"  所有叶子（词）落到最下面一行等高，其余节点保持原来的层级
//   "compact" 叶子节点对齐到底部后，非叶子节点再尽量下移贴着女儿节点，整棵树压到底线
//
// ALIGN_MODES 是这三个取值的唯一来源，编辑器的按钮直接由它派生，不会走偏。

export const ALIGN_MODES = ["depth", "leaves", "compact"];

// 水平位置有两种模式（options.center）：
//   mother（默认）—— 母亲节点居中于【最左和最右那两个女儿节点的中心的中点】
//   block         —— 母亲节点居中于【所有女儿节点的包围盒】（看起来整棵树更平衡）
// 女儿节点宽度不等时，这两个位置是不一样的。
// CENTER_MODES 是这两个取值的唯一来源，编辑器的按钮直接由它派生。
export const CENTER_MODES = ["mother", "block"];

/**
 * @param {object} root   模型根节点
 * @param {(text:string, size:number, family:string)=>number} measure  文字宽度测量函数
 * @param {object} options
 * @returns {{width:number,height:number,nodeH:number,levelHeight:number,maxDepth:number,
 *            maxRow:number,info:Map<object,object>,items:object[],options:object}}
 */
export function layout(root, measure, options = {}) {
  const o = {
    fontSize: 16,
    fontFamily: "sans-serif",
    padX: 12,
    gap: 18,
    vscale: 1,
    minLabelWidth: 20,
    align: "depth",
    ...options,
  };
  if (!ALIGN_MODES.includes(o.align)) o.align = "depth";
  if (!CENTER_MODES.includes(o.center)) o.center = "mother";

  const nodeH = Math.round(o.fontSize * 1.75);
  const levelHeight = Math.round(o.fontSize * 2.8 * o.vscale);
  const subSize = Math.round(o.fontSize * 0.72);

  /** @type {Map<object, {node:object,textW:number,subW:number,labelW:number,w:number,x:number,y:number,cx:number,depth:number,row:number}>} */
  const info = new Map();

  function measureNode(n) {
    const textW = measure(n.label, o.fontSize, o.fontFamily);
    const hasSS = (n.sub != null && n.sub !== "") || (n.sup != null && n.sup !== "");
    const ssText = hasSS ? String(n.sub != null && n.sub !== "" ? n.sub : n.sup) : "";
    const subW = hasSS ? measure(ssText, subSize, o.fontFamily) + 4 : 0;
    const labelW = Math.max(textW + subW + o.padX * 2, o.minLabelWidth);
    info.set(n, {
      node: n,
      textW,
      subW,
      labelW,
      w: labelW,
      x: 0,
      y: 0,
      cx: 0,
      depth: 0,
      row: 0,
    });
    return labelW;
  }

  function measureWidths(n) {
    const labelW = measureNode(n);
    let w = labelW;
    if (n.children.length) {
      let cw = 0;
      n.children.forEach((c, i) => {
        cw += measureWidths(c) + (i ? o.gap : 0);
      });
      w = Math.max(labelW, cw);
    }
    info.get(n).w = w;
    return w;
  }

  let maxDepth = 0;

  // 水平位置 + 记录自然深度
  function place(n, left, depth) {
    const it = info.get(n);
    it.x = left;
    it.depth = depth;
    it.cx = left + it.w / 2;
    if (depth > maxDepth) maxDepth = depth;

    if (!n.children.length) return;

    let total = 0;
    n.children.forEach((c, i) => {
      total += info.get(c).w + (i ? o.gap : 0);
    });

    // 女儿节点的包围盒在母亲节点的可用宽度里居中 —— 这就是"母亲节点居中于女儿节点之上"的来源
    let x = left + (it.w - total) / 2;
    for (const c of n.children) {
      place(c, x, depth + 1);
      x += info.get(c).w + o.gap;
    }

    // 母亲节点居中模式（默认）：把母亲节点的中心挪到最左和最右那两个女儿节点中心的中点。
    // 女儿节点的位置不动，所以连线会跟着变成不对称 —— 这正是这个模式的效果。
    if (o.center === "mother") {
      const first = info.get(n.children[0]);
      const last = info.get(n.children[n.children.length - 1]);
      it.cx = (first.cx + last.cx) / 2;
      it.x = it.cx - it.w / 2;
    }
  }

  measureWidths(root);
  place(root, 0, 0);

  // ---- 垂直行号。depth / leaves 是直接赋值，compact 需要后序遍历自底向上算。
  function assignRows(n) {
    const it = info.get(n);

    if (n.children.length === 0) {
      it.row = o.align === "depth" ? it.depth : maxDepth;
      return;
    }
    if (o.align !== "compact") {
      it.row = it.depth;
      for (const c of n.children) assignRows(c);
      return;
    }
    // compact：贴到自己最高的那个女儿节点的上一行
    let min = Infinity;
    for (const c of n.children) {
      assignRows(c);
      if (info.get(c).row < min) min = info.get(c).row;
    }
    it.row = min - 1;
  }

  assignRows(root);
  // compact 模式下根节点算出来可能大于 0，整体上移让最上面一行恰好是 0
  if (o.align === "compact") {
    let min = Infinity;
    for (const it of info.values()) if (it.row < min) min = it.row;
    if (min !== 0) for (const it of info.values()) it.row -= min;
  }

  let maxRow = 0;
  for (const it of info.values()) {
    it.y = it.row * levelHeight;
    if (it.row > maxRow) maxRow = it.row;
  }

  // ---- 哪些节点算"词"（渲染时染成红色）
  //
  // 规则：它是叶子节点，而且是母亲节点唯一的女儿节点 —— 也就是序列化时会写成裸标签的那一种。
  // 用方括号包起来的空节点（如 [Y]、[X']）表示"没有展开的范畴"，不是词，所以不染色。
  // 根节点永远不是词（根一定带方括号）。
  //
  //   [XP [D [X'' [X word] [Y]]] [X']]
  //     word -> 是 X 唯一的女儿节点 -> 染红
  //     Y    -> X'' 有 X 和 Y 两个女儿节点，不是唯一 -> 不染
  //     X'   -> XP 有 D 和 X' 两个孩子 -> 不染
  function markWords(n, isLoneChild) {
    const it = info.get(n);
    it.isWord = n.children.length === 0 && (isLoneChild || n.arrow != null);
    const lone = n.children.length === 1;
    for (const c of n.children) markWords(c, lone);
  }
  markWords(root, false);

  // 画布边界只能按**可见内容**（节点标签的实际占位）算。
  //
  // 注意不能用 it.x / it.x+it.w —— 那是子树排版的"分配盒"，本身不可见。
  // 母亲节点居中模式下母亲节点会被挪出分配盒，分配盒能远远伸出可视内容之外，
  // 把它算进来会让画布左边留出一大片空白。
  let minLeft = Infinity;
  let maxRight = -Infinity;
  for (const it of info.values()) {
    const half = it.labelW / 2;
    if (it.cx - half < minLeft) minLeft = it.cx - half;
    if (it.cx + half > maxRight) maxRight = it.cx + half;
  }
  if (minLeft < 0) {
    for (const it of info.values()) {
      it.x -= minLeft;
      it.cx -= minLeft;
    }
    maxRight -= minLeft;
  }


  return {
    width: maxRight,
    height: maxRow * levelHeight + nodeH,
    nodeH,
    levelHeight,
    subSize,
    maxDepth,
    maxRow,
    info,
    items: [...info.values()], // Map 的插入顺序即先序：父在子前
    options: o,
  };
}
