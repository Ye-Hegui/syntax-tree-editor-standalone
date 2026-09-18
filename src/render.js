import { COLOR_VALUES } from "./style.js";
﻿// 把 layout() 的结果画成【可交互】的 SVG。
//
// 两个刻意的设计：
//  1) 所有视觉属性都用 SVG 属性内联写死，不依赖外部 CSS —— 这样导出的 SVG
//     文件脱离页面也能正确显示。CSS 只负责选中高亮和鼠标指针。
//  2) 每个节点是一个 <g class="ste-node" data-id="...">，含一个透明 <rect> 作为
//     命中区域。事件用委托挂在 <svg> 上，节点增删不需要重新绑定。

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
  return e;
}

const COLORS = {
  leaf: "#CC0000",
  branch: "#0000CC",
  mono: "#111111",
  edge: "#000000",
  arrow: "#990099",
};

/**
 * @returns {{width:number, height:number}} 实际画布尺寸（已含箭头所需的下方留白）
 */
export function drawTree(svg, lay, opts = {}) {
  const o = {
    selected: null,
    triangles: true,
    terminalLines: true,
    colors: true,
    arrows: true,
    fontFamily: "sans-serif",
    fontSize: 16,
    ...opts,
  };

  const { info, nodeH, height, width, items } = lay;

  // ---- 先收集箭头，因为它决定画布还要向下留多少空
  const arrowList = [];
  if (o.arrows) {
    for (const it of items) {
      const a = it.node.arrow;
      if (!a) continue;
      const target = a.target;
      if (!target) continue;
      const ti = info.get(target);
      if (!ti) continue; // 落点已经不在树里了
      arrowList.push({ from: it, to: ti });
    }
  }

  // 位移箭头在整棵树下方走。每条箭头占一条独立的通道，下拉深度必须够大 ——
  // 否则在"词对齐底部 / 整树贴底"这两种模式里两个端点都在最底下一行，
  // 箭头会扁成一条贴着词跑的直线。
  const ARROW_LANE = 52;
  const ARROW_TAIL_DROP = 12; // 尾巴起点往下挪，让整条弧线压在头部三角的下面
  const ARROW_HEAD_LIFT = 3; // 三角形只比节点框底略高一点点（0 = 贴着框底）
  const HEAD_H = 8; // 三角形高度
  const HEAD_HALF = 4.5; // 三角形半宽
  const HEAD_TUCK = 5; // 线端缩进三角形内部收住，免得平头端点冒出尖顶
  const arrowSpace = arrowList.length ? 12 + arrowList.length * ARROW_LANE : 0;
  const W = Math.max(1, Math.ceil(width));
  const H = Math.max(1, Math.ceil(height + arrowSpace));

  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);

  const gEdge = el("g");
  const gArrow = el("g");
  const gNode = el("g");
  svg.append(gEdge, gArrow, gNode);

  const head = (x, y) =>
    el("polygon", {
      points: `${x},${y} ${x - HEAD_HALF},${y + HEAD_H} ${x + HEAD_HALF},${y + HEAD_H}`,
      fill: COLORS.arrow,
      stroke: "none",
    });

  // ---- 父子连线 / 三角
  //
  // 一般情况：母亲框底中心 -> 女儿框顶中心，一条直线。
  //
  // 转义节点（标签裸写 %Empty）在导出里（o.hideEscapes）不画方框，连线这样处理：
  //   挑"母亲相反那一侧"的女儿 B（母亲正好在正上方时挑中间那个），
  //   把 母亲框底 A -> B框顶 画成**一条直线** —— 这条线穿过转义节点那一层，
  //   它和 B 的那一段与 A 的那一段夹角就是 180°（共线是这么构造出来的，不靠摆角度）。
  //   直线与"转义节点那一行的底"的交点 J，其余女儿从 J 出发。
  // 转义节点自己没有女儿时（作者允许编辑时删成那样）：什么都不画。
  //
  // 转义节点可能**一层套一层**（%Empty 的女儿还是 %Empty）。那种情况下要"从爷爷直接连到孙子"，
  // 所以这里写成递归：沿着"相反那一侧"的女儿一路往下带，每一层的交点都落在同一条直线上，
  // 侧枝再从各自的交点出发。
  /**
   * 画转义节点的连线（导出时用）—— **一条线捅到底**。
   *
   * 转义节点可能一层套一层（%Empty 的女儿还是 %Empty）。做法分三步：
   *
   *   ① **走链**：每一层挑"来向相反那一侧"的女儿（来向正好在本层正上方时挑中间那个）。
   *      挑中的如果还是转义节点，就以本层 cx 为新的来向继续往下走 ——
   *      一路走到第一个**不是**转义节点的节点，它就是端点。
   *   ② **只画一条直线**：来向起点 (ax, ay) → 端点框顶。
   *      于是"最上面那个母亲 → 最下面那个端点"是笔直的一条（夹角 180°）。
   *   ③ **链上每一层各自分叉**：分叉点取"这条直线与自己 cx 的交点"（所以必然落在这条线上），
   *      侧枝从各自的分叉点出发；侧枝自己若是转义节点，就递归走它自己那条链。
   *
   * @param {object} node 这一层的转义节点
   * @param {number} ax 来向起点的横坐标（母亲的框底中心，或上一层转义节点的分叉点）
   * @param {number} ay 来向起点的纵坐标
   */
  const drawEscape = (node, ax, ay, rootAnchor = false) => {
    // ① 走链：记下每一层的分叉依据（本层节点、本层 info、选中了第几个女儿）
    const chain = [];
    let cur = node;
    let fromX = ax;
    while (cur && o.hideEscapes && cur.escape && cur.children.length) {
      const ci2 = info.get(cur);
      if (!ci2) break;
      const same = Math.abs(fromX - ci2.cx) < 0.5;
      // 来向正好在本层正上方时挑"靠中间"那个；偶数个女儿时挑**靠右**那个，
      // 这样整棵树的脊线统一往右下走，左侧的女儿都挂成镜像侧枝（根节点也是转义节点时
      // 来向就是它自己的 cx，必然走这一支）
      const idx = same
        ? Math.floor(cur.children.length / 2)
        : fromX < ci2.cx
          ? cur.children.length - 1
          : 0;
      chain.push({ node: cur, info: ci2, idx });
      const next = cur.children[idx];
      fromX = ci2.cx; // 下一层的"来向"就是这一层的分叉点：它落在直线上，横坐标正是本层 cx
      cur = next;
      if (!cur || !o.hideEscapes || !cur.escape || !cur.children.length) break;
    }
    if (!chain.length) return;

    const ei = info.get(cur);
    if (!ei) return; // 端点没有布局信息（或链断了）：不画

    // ② 一条直线：来向起点 → 端点框顶
    const x1 = ax;
    const y1 = ay;
    const x2 = ei.cx;
    const y2 = ei.y - 3;
    gEdge.appendChild(el("line", { x1, y1, x2, y2, stroke: COLORS.edge, "stroke-width": 1.2 }));

    // ③ 链上每一层各自分叉。
    //
    //    分叉点必须落在这条直线上（不落上去 180° 就断了），但**它在直线上的位置是自由的** ——
    //    正好拿这个自由度去满足"**同一侧的侧枝彼此平行**"：顶层（链的第一层）照旧取
    //    "与本层 cx 的交点"、它的侧枝斜率当基准；下面每一层的分叉点在直线上滑动，
    //    让同侧侧枝的斜率与基准相同。于是嵌套时是等斜率的"人字形"，不会一层一个角度。
    const dx = x2 - x1;
    const dy = y2 - y1;
    const at = (tt) => ({ x: x1 + tt * dx, y: y1 + tt * dy });
    const tAtCx = (cx) => (Math.abs(dx) < 0.5 ? 0 : (cx - x1) / dx);
    // ⚠️ 坐标在 info 里，模型节点上没有 cx/y —— 直接写 d.cx 会得到 undefined，
    // 算出来的斜率变成 NaN，整段计算就静默失效（退回老路子，日志都不打一条）。
    const cxOf = (d) => info.get(d).cx;
    const topOf = (d) => info.get(d).y - 3;
    const isLeft = (step, d) => cxOf(d) < step.info.cx;

    /**
     * 侧枝的目标斜率（一律用 dy/dx 记）：
     *
     *   链本身（也就是"向右下那条线"）的斜率是 m；
     *   **向左的侧枝取 -m** —— 于是左枝正是右枝关于竖直方向的镜像，
     *   也就自然满足"左边几条侧枝斜率一致、且与右边那条互为相反数"。
     *
     * 单层时这条规则与"分叉点取本层 cx"是等价的（两个女儿同排、落差相同），
     * 所以老的单层效果一点不变；只有嵌套时更深那些层会滑动分叉点去对齐斜率。
     *
     * 竖直的链（dx≈0）没有"相反数"可言，退回老办法；
     * 向右的侧枝不可能与链同斜率（平行线不相交），也退回老办法。
     */
    const m = Math.abs(dx) < 0.5 ? null : dy / dx;
    const junctionFor = (step, d) => {
      const s = m == null ? null : isLeft(step, d) ? -m : m;
      if (s != null) {
        const denom = dy - s * dx;
        if (Math.abs(denom) > 1e-6) {
          const tt = (topOf(d) - y1 - s * (cxOf(d) - x1)) / denom;
          if (tt >= 0 && tt <= 1) return at(tt); // 分叉点必须落在这条线段内
          // 根节点自己就是转义节点时，第一层的解常常落在起点**上方**一点点：
          // 根没有母亲、也没有方框，脊线的起点本来就是自由的 —— 只要分叉点还落在
          // 根自己那一行之内就接受，并补一小段与脊线共线的延长线（看不出接缝）。
          if (rootAnchor && step === chain[0] && Math.abs(dy) > 1e-6) {
            const lo = (step.info.y - y1) / dy; // 本行顶对应的 t
            if (tt < 0 && tt >= lo) {
              const a = at(tt);
              const b = at(0);
              gEdge.appendChild(
                el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: COLORS.edge, "stroke-width": 1.2 }),
              );
              return a;
            }
          }
        }
      }
      return at(tAtCx(step.info.cx));
    };

    for (const step of chain) {
      step.node.children.forEach((d, di) => {
        if (di === step.idx) return; // 被选中走直线的那一支，不用再画
        const j = junctionFor(step, d);
        const Jx = j.x;
        const Jy = j.y;
        // 侧枝自己也是转义节点：递归 —— 它自己又是"一条线捅到底"
        if (o.hideEscapes && d.escape && d.children.length) {
          drawEscape(d, Jx, Jy);
          return;
        }
        const didx = info.get(d);
        const isTriangle = o.triangles && d.children.length === 0 && d.label.includes(" ");
        if (isTriangle) {
          const half = didx.textW / 2 + 4;
          gEdge.appendChild(
            el("polygon", {
              points: `${Jx},${Jy} ${didx.cx + half},${didx.y - 3} ${didx.cx - half},${didx.y - 3}`,
              fill: "none",
              stroke: COLORS.edge,
              "stroke-width": 1.2,
              "stroke-linejoin": "round",
            }),
          );
        } else if (o.terminalLines || d.children.length > 0) {
          gEdge.appendChild(
            el("line", {
              x1: Jx,
              y1: Jy,
              x2: didx.cx,
              y2: didx.y - 3,
              stroke: COLORS.edge,
              "stroke-width": 1.2,
            }),
          );
        }
      });
    }
  };

  for (const it of items) {
    const hiddenMother = o.hideEscapes && it.node.escape;
    if (hiddenMother) {
      // 转义节点不画方框，它的连线整体交给 drawEscape：
      // 非根的那些，连线已经在"母亲那一次循环"里从分叉点画过了（这里直接跳过）；
      // **根节点自己就是转义节点**时没人替它画，得在这里补一次 ——
      // 否则它的女儿会走下面那条"普通连线"的路，不参与镜像斜率（表现为"根上的那条不平行"）。
      //
      // ⚠️ 起点仍然是行底（和普通连线一致）；根那一层的分叉点若落在起点上方一点点，
      // junctionFor 会接受它并补一小段延长线（见那里的注释）。
      if (it === items[0]) drawEscape(it.node, it.cx, it.y + nodeH + 2, true);
      continue;
    }

    for (const c of it.node.children) {
      const ci = info.get(c);
      const hiddenChild = o.hideEscapes && c.escape;

      if (hiddenChild) {
        // 交给递归函数画：它会处理"母亲那一侧"的挑边、交点，以及女儿也是转义节点的嵌套情形
        drawEscape(c, it.cx, it.y + nodeH + 2);
        continue;
      }

      const isTriangle = o.triangles && c.children.length === 0 && c.label.includes(" ");

      if (isTriangle) {
        const half = ci.textW / 2 + 4;
        gEdge.appendChild(
          el("polygon", {
            points: `${it.cx},${it.y + nodeH + 2} ${ci.cx + half},${ci.y - 3} ${ci.cx - half},${ci.y - 3}`,
            fill: "none",
            stroke: COLORS.edge,
            "stroke-width": 1.2,
            "stroke-linejoin": "round",
          }),
        );
      } else if (o.terminalLines || c.children.length > 0) {
        gEdge.appendChild(
          el("line", {
            x1: it.cx,
            y1: it.y + nodeH + 2,
            x2: ci.cx,
            y2: ci.y - 3,
            stroke: COLORS.edge,
            "stroke-width": 1.2,
          }),
        );
      }
    }
  }

  // ---- 位移箭头：从节点指向落点，箭头头部在落点那一端
  const arrowBottoms = [];
  arrowList.forEach((a, i) => {
    const bottom = height + 8 + ARROW_LANE * (i + 1);
    arrowBottoms.push(bottom);
    const y1 = a.from.y + nodeH + 2 + ARROW_TAIL_DROP;
    const y2 = a.to.y + nodeH + 2 - ARROW_HEAD_LIFT; // 三角尖
    const yLine = y2 + HEAD_TUCK; // 线只画到三角形内部为止
    gArrow.appendChild(
      el("path", {
        d: `M ${a.from.cx},${y1} C ${a.from.cx},${bottom} ${a.to.cx},${bottom} ${a.to.cx},${yLine}`,
        fill: "none",
        stroke: COLORS.arrow,
        "stroke-width": 1.8,
      }),
    );
    gArrow.appendChild(head(a.to.cx, y2));
  });

  // ---- 节点
  for (const it of items) {
    const n = it.node;
    const g = el("g", {
      class: o.selected === n ? "ste-node is-selected" : "ste-node",
      "data-id": n.id,
    });

    // 导出时转义节点不画方框和标签（画布上照常画，方便点选）—— 见 hideEscapes
    const hiddenNode = o.hideEscapes && n.escape;
    if (hiddenNode) {
      gNode.appendChild(g);
      continue;
    }

    // 命中区域只覆盖标签本身，不覆盖整棵子树，否则命中会互相抢占
    g.appendChild(
      el("rect", {
        class: "ste-hit",
        x: it.cx - it.labelW / 2,
        y: it.y,
        width: it.labelW,
        height: nodeH,
        rx: 6,
        fill: "transparent",
        "pointer-events": "all",
      }),
    );

    const contentW = it.textW + it.subW;
    const contentLeft = it.cx - contentW / 2;
    // 只有"词"染红：叶子节点、而且是母亲节点唯一的女儿节点（也就是记法里写成裸标签的那种），
    // 或者带位移箭头的叶子。方括号包起来的空节点是范畴，跟非叶子一样用蓝色。
    // 这只是**默认画法**（opts.redWords !== false）：模型里并没有"隐式颜色声明"，
    // 编辑器的界面默认开着它（作者觉得词红好看）；函数式调用 / 命令行默认关掉，出一张全蓝的图。
    // 显式声明的颜色优先级最高，不受「关闭颜色」选项影响 —— 那是作者自己的选择
    const declared = n.color ? COLOR_VALUES[n.color] : null;
    const wordRed = o.redWords !== false && it.isWord;
    const fill = declared || (o.colors ? (wordRed ? COLORS.leaf : COLORS.branch) : COLORS.mono);

    const label = el("text", {
      x: contentLeft + it.textW / 2,
      y: it.y + nodeH / 2,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-family": o.fontFamily,
      "font-size": o.fontSize,
      fill,
      "pointer-events": "none",
    });
    if (n.italic) label.setAttribute("font-style", "italic");
    if (n.bold) label.setAttribute("font-weight", "bold");
    if (n.strike) label.setAttribute("text-decoration", "line-through");
    label.textContent = n.label;
    g.appendChild(label);

    const hasSub = n.sub != null && n.sub !== "";
    const ss = hasSub ? n.sub : n.sup != null && n.sup !== "" ? n.sup : null;
    if (ss != null) {
      const sub = el("text", {
        x: contentLeft + it.textW + it.subW / 2,
        y: it.y + nodeH / 2 + (hasSub ? nodeH * 0.22 : -nodeH * 0.22),
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-family": o.fontFamily,
        "font-size": lay.subSize,
        fill,
        "pointer-events": "none",
      });
      sub.textContent = String(ss);
      g.appendChild(sub);
    }

    gNode.appendChild(g);
  }

  return { width: W, height: H, arrowBottoms };
}
