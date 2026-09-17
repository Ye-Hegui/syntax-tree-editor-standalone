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
  for (const it of items) {
    for (const c of it.node.children) {
      const ci = info.get(c);
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
    // 默认【全部蓝色】：没有任何颜色声明时，词和范畴同色。
    // （以前是"只有词才染红"，需求⑥ 取消了这个自动判定；要红色得自己声明，或者点工具栏的标红按钮。）
    // 显式声明的颜色优先级最高，不受「关闭颜色」选项影响 —— 那是作者自己的选择
    const declared = n.color ? COLOR_VALUES[n.color] : null;
    const fill = declared || (o.colors ? COLORS.branch : COLORS.mono);

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
