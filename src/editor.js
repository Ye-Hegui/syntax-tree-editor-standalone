// SyntaxTreeEditor —— 图与代码双向可编辑的语法树组件
//
//   new SyntaxTreeEditor(container, { value, onChange })
//
// 设计要点：
//   - 单一真相来源是模型（model.js）。文本面板只是模型的一个视图 + 一个输入通道。
//   - 图上任何改动 -> 模型 -> 重新布局 -> 重绘 -> 回写文本。
//   - 文本改动 -> 解析 -> 替换模型 -> 重绘。文本与模型不一致时不回写文本，
//     避免打断正在输入的光标。
//   - 每次结构性改动前做快照（序列化成文本），所以撤销/重做非常廉价。

import {
  node,
  preorder,
  findParent,
  addChild,
  removeNode,
  moveNodeLeft,
  moveNodeRight,
  canAddPrimeLevel,
  addPrimeLevel,
  canCollapsePrimeLevel,
  collapsePrimeLevel,
} from "./model.js";
import { parse, serialize, NotationError } from "./notation.js";
import { parseRules, serializeRules, RuleError } from "./rules.js";
import { layout, ALIGN_MODES, CENTER_MODES } from "./layout.js";
import { drawTree } from "./render.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// 常用范畴标签 —— 点一下就把标签套到选中节点上，比打字快。
// 按"从树顶到树底"的顺序排：先句子层，再各功能投射，再词汇层，
// 最后是斜体的小 v 和 pro（习惯上这两个词类用斜体写）。
const PALETTE = [
  "S", "CP", "C", "IP", "I", "TP", "T", "NegP", "Neg",
  "VP", "V", "NP", "N", "PP", "P", "DP", "D", "Det",
  "Adj", "Adv", "Aux", "X",
  "v", "pro",
];


/** 点这些范畴按钮时顺手打开斜体位 */
const ITALIC_CHIPS = new Set(["v", "pro"]);

/** 提示行开头那句加粗的建议 */
const TIPS = "复制粘贴源代码用括号记法，画箭头建议用规则记法。";

const HINT =
  "Enter 加女儿节点 · Shift+Enter 加姊妹节点 · Tab 下移(加一层投射) · Shift+Tab 上移 · " +
  "↑ 母亲节点 · ↓ 第一个女儿节点 · ←→ 姊妹节点，到边了跨到堂表姊妹节点 · " +
  "F2 或双击改名 · Alt+←/→ 左移右移";

// 三种垂直对齐方式：取值来自 layout.js，这里只补按钮文字和说明，
// 所以不可能出现"布局支持某个模式、界面上却没有按钮"的情况。
const ALIGN_TEXT = {
  depth: ["按层级", "每个节点都待在自己的层级行上，同一层的节点等高（默认）"],
  leaves: ["词对齐底部", "所有叶子（词）落到最下面一行等高，中间节点保持原来的层级"],
  compact: ["整树贴底", "叶子节点对齐到底部后，中间节点也尽量下移贴着女儿节点，整棵树压到底线"],
};
const ALIGN_CHOICES = ALIGN_MODES.map((mode) => [mode, ...ALIGN_TEXT[mode]]);

// 水平位置：两种模式，说明见 layout.js 的 CENTER_MODES
const CENTER_TEXT = {
  mother: ["母亲节点居中", "母亲节点正好落在最左和最右那两个女儿节点的正中间（默认）"],
  block: ["节点整体居中", "母亲节点居中于所有女儿节点的包围盒，整棵树看起来更平衡"],
};
const CENTER_CHOICES = CENTER_MODES.map((mode) => [mode, ...CENTER_TEXT[mode]]);

// 两套等价的记法，随时可切换
const TEXT_MODES = [
  ["bracket", "括号记法", "方括号嵌套式，适合整棵粘贴"],
  ["rules", "规则记法", "一行一条 mother -> daughter，适合逐条核对"],
];

const TEXT_DEBOUNCE = 220;

function makeMeasurer() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const cache = new Map();
  return (text, size, family) => {
    const key = `${size}|${family}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    ctx.font = `${size}px ${family}`;
    const w = ctx.measureText(text).width;
    cache.set(key, w);
    return w;
  };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stripUnsupported(text) {
  // 双引号在括号记法里无法转义，只能是引号本身
  return String(text).replace(/"/g, "");
}

/** 字符偏移 -> {行, 列}（都从 0 开始） */
function offsetToLineCol(text, offset) {
  let line = 0;
  let start = 0;
  for (let i = 0; i < text.length && i < offset; i++) {
    if (text[i] === "\n") {
      line++;
      start = i + 1;
    }
  }
  return { line, col: offset - start };
}

/** {行, 列} -> 字符偏移，列超出时贴到行尾 */
function lineColToOffset(text, line, col) {
  const lines = text.split("\n");
  const at = Math.min(Math.max(line, 0), lines.length - 1);
  let offset = 0;
  for (let i = 0; i < at; i++) offset += lines[i].length + 1;
  return offset + Math.min(Math.max(col, 0), lines[at].length);
}

export class SyntaxTreeEditor {
  constructor(host, options = {}) {
    this.opts = {
      value: "[S [NP [D the][N dog]][VP [V barks]]]",
      fontSize: 16,
      fontFamily: "sans-serif",
      vscale: 1,
      colors: true,
      triangles: true,
      terminalLines: true,
      align: "depth",
    center: "mother",
      showText: true,
      textMode: "bracket",
      onChange: null,
      ...options,
    };

    this.host = typeof host === "string" ? document.querySelector(host) : host;
    if (!this.host) throw new Error("SyntaxTreeEditor: 找不到挂载点");

    this.undoStack = [];
    this.redoStack = [];
    this.selected = null;
    this.editing = null;
    this.editBackup = "";
    this.byId = new Map();
    this.textTimer = null;
    this.size = { width: 1, height: 1 };

    this.measure = makeMeasurer();
    this.textMode = TEXT_MODES.some(([v]) => v === this.opts.textMode) ? this.opts.textMode : "bracket";
    this.#buildDom();
    this.#syncTextareaSize();

    this.root = this.opts.value && this.opts.value.trim() ? parse(this.opts.value) : null;
    this.selected = this.root;
    this.#refresh({ syncText: true });

    this.el.addEventListener("keydown", (ev) => this.#onKeyDown(ev));
    this.svg.addEventListener("pointerdown", (ev) => this.#onCanvasDown(ev));
    this.svg.addEventListener("dblclick", (ev) => this.#onCanvasDblClick(ev));
    this.textarea.addEventListener("input", () => this.#onTextInput());
    this.textarea.addEventListener("input", () => this.#syncGutter()); // 立刻更新行号，不等防抖
    this.textarea.addEventListener("scroll", () => this.#syncGutterScroll());
    this.textarea.addEventListener("click", () => this.#selectFromCaret());
    this.textarea.addEventListener("keyup", (ev) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(
          ev.key,
        )
      )
        this.#selectFromCaret();
    });
  }

  // ------------------------------------------------------------ 公开 API

  /**
   * 用括号记法设置整棵树。
   * 传空字符串（或全空白）会清成【空白画布】—— 没有任何节点，可以重新开始画。
   */
  setValue(text) {
    const trimmed = text == null ? "" : String(text);
    this.root = trimmed.trim() ? parse(trimmed) : null;
    this.selected = this.root;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.#refresh({ syncText: true });
  }

  /**
   * 设置选中节点的字体样式。italic / bold 会写进记法末尾的 Italic(...) / Bold(...) 声明里。
   * @param {{italic?: boolean, bold?: boolean}} style
   */
  setStyle(style) {
    const n = this.selected;
    if (!this.root || !n) return;
    this.#mutate(() => {
      if (style.italic != null) n.italic = !!style.italic;
      if (style.bold != null) n.bold = !!style.bold;
    });
  }

  /** 导出为括号记法；空白画布返回空字符串 */
  getValue() {
    return this.root ? serialize(this.root).text : "";
  }

  /**
   * 载入一棵新树，但**保留撤销历史** —— 按 Ctrl+Z 可以退回载入之前的那棵树。
   * 适合"载入示例"这类操作。setValue() 会清空历史，适合当作"打开新文档"。
   */
  loadValue(text) {
    this.#pushUndo();
    const trimmed = text == null ? "" : String(text);
    this.root = trimmed.trim() ? parse(trimmed) : null;
    this.selected = this.root;
    this.#refresh({ syncText: true });
  }

  /** 当前是不是空白画布 */
  get isEmpty() {
    return this.root === null;
  }

  /** 清成空白画布 */
  clear() {
    this.setValue("");
  }

  /** 运行期改外观选项 */
  setOptions(patch = {}) {
    Object.assign(this.opts, patch);
    this.#refresh({ syncText: false });
  }

  /** 序列化成独立的 SVG 字符串（可脱离本页面使用） */
  toSvgString({ background = false } = {}) {
    const clone = this.svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("viewBox", `0 0 ${this.size.width} ${this.size.height}`);
    clone.setAttribute("width", this.size.width);
    clone.setAttribute("height", this.size.height);
    clone.querySelectorAll(".is-selected").forEach((e) => e.classList.remove("is-selected"));
    if (background) {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", 0);
      rect.setAttribute("y", 0);
      rect.setAttribute("width", this.size.width);
      rect.setAttribute("height", this.size.height);
      rect.setAttribute("fill", "#ffffff");
      clone.insertBefore(rect, clone.firstChild);
    }
    return new XMLSerializer().serializeToString(clone);
  }

  exportSvg(filename = "syntax-tree.svg") {
    download(new Blob([this.toSvgString({ background: true })], { type: "image/svg+xml;charset=utf-8" }), filename);
  }

  async exportPng(filename = "syntax-tree.png", scale = 2) {
    const svgText = this.toSvgString({ background: true });
    const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("SVG 转 PNG 失败"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, this.size.width * scale);
      canvas.height = Math.max(1, this.size.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if (blob) download(blob, filename);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ------------------------------------------------------------ DOM 骨架

  #buildDom() {
    const mk = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };

    this.el = mk("div", "ste");

    // 工具栏。每个按钮下面带一行快捷键说明；没有快捷键的就不显示那一行。
    const toolbar = mk("div", "ste-toolbar");
    const button = (label, key, title, fn) => {
      const b = mk("button", "ste-btn");
      b.type = "button";
      b.title = key ? `${title}　（${key}）` : title;
      const labelEl = mk("span", "ste-btn-label", label);
      b.appendChild(labelEl);
      if (key) b.appendChild(mk("span", "ste-btn-key", key));
      b.labelEl = labelEl;
      b.addEventListener("click", () => {
        fn();
        this.scroller.focus();
      });
      toolbar.appendChild(b);
      return b;
    };

    this.termNodes = [];
    this.termPairs = null;
    this.btnChild = this.#term(button("＋女儿节点", "Enter", "给选中的节点增加一个女儿节点", () => this.addChild()), "title", "给选中的节点增加一个女儿节点");
    this.btnSibling = this.#term(button("＋姊妹节点", "Shift+Enter", "增加一个姊妹节点", () => this.addSibling()), "title", "增加一个姊妹节点");
    this.#term(this.btnSibling.labelEl, "textContent", "＋姊妹节点");
    toolbar.appendChild(mk("span", "ste-sep"));
    this.btnAddLevel = button("下移", "Tab", "增加一层投射层，选中的节点连同整条投射链一起下移", () =>
      this.addLevel(),
    );
    this.btnCollapseLevel = button("上移", "Shift+Tab", "去掉紧挨着自己上面的那一层投射层", () =>
      this.collapseLevel(),
    );
    toolbar.appendChild(mk("span", "ste-sep"));
    // 左移在左、右移在右，和方向键一致
    this.btnMoveLeft = this.#term(button(
      "左移",
      "Alt+←",
      "如果有左姊妹节点就和它交换位置；如果自己是最左边的女儿节点，就搬到母亲节点的左姊妹节点底下",
      () => this.moveLeft(),
    ), "title", "如果有左姊妹节点就和它交换位置；如果自己是最左边的女儿节点，就搬到母亲节点的左姊妹节点底下");
    this.btnMoveRight = this.#term(button(
      "右移",
      "Alt+→",
      "如果有右姊妹节点就和它交换位置；如果自己是最右边的女儿节点，就搬到母亲节点的右姊妹节点底下",
      () => this.moveRight(),
    ), "title", "如果有右姊妹节点就和它交换位置；如果自己是最右边的女儿节点，就搬到母亲节点的右姊妹节点底下");
    toolbar.appendChild(mk("span", "ste-sep"));
    this.btnDelete = button("删除", "Delete", "删除该节点及其整棵子树", () => this.remove());
    this.btnUndo = button("撤销", "Ctrl+Z", "撤销上一步", () => this.undo());
    this.btnRedo = button("重做", "Ctrl+Shift+Z", "重做被撤销的一步", () => this.redo());
    toolbar.appendChild(mk("span", "ste-sep"));
    this.btnSvg = button("SVG", "矢量图", "导出 SVG 矢量图", () => this.exportSvg());
    this.btnPng = button("PNG", "位图", "导出 PNG 位图", () => this.exportPng());

    // 垂直对齐方式。三个按钮必须紧贴在一起，中间不能有 gap，
    // 否则相邻边框只画了一半，分隔竖线会看起来时有时无。
    const alignRow = mk("div", "ste-align");
    alignRow.appendChild(mk("span", "ste-align-label", "垂直对齐"));
    const segGroup = mk("div", "ste-seg-group");
    this.alignButtons = {};
    for (const [value, label, hint] of ALIGN_CHOICES) {
      const b = mk("button", "ste-seg", label);
      b.type = "button";
      b.title = hint;
      b.addEventListener("click", () => {
        this.setAlign(value);
        this.scroller.focus();
      });
      this.#term(b, "textContent", label);
this.#term(b, "title", hint);
segGroup.appendChild(b);
      this.alignButtons[value] = b;
    }
    alignRow.appendChild(segGroup);

    // 水平位置。和垂直对齐分开一行，因为这是两件独立的事。
    const centerRow = mk("div", "ste-align");
    centerRow.appendChild(mk("span", "ste-align-label", "水平位置"));
    const centerGroup = mk("div", "ste-seg-group");
    this.centerButtons = {};
    for (const [value, label, hint] of CENTER_CHOICES) {
      const b = mk("button", "ste-seg", label);
      b.type = "button";
      b.title = hint;
      b.addEventListener("click", () => {
        this.setCenter(value);
        this.scroller.focus();
      });
      this.#term(b, "textContent", label);
this.#term(b, "title", hint);
centerGroup.appendChild(b);
      this.centerButtons[value] = b;
    }
    centerRow.appendChild(centerGroup);

    // 范畴快捷标签
    const palette = mk("div", "ste-palette");
    for (const label of PALETTE) {
      const chip = mk("button", "ste-chip", label);
      chip.type = "button";
      // 小 v 和 pro 习惯上写斜体，点这两个按钮时顺手把斜体位打开（斜体本身由记法决定）
      if (ITALIC_CHIPS.has(label)) chip.style.fontStyle = "italic";
      chip.title = `把标签设为 ${label}`;
      chip.addEventListener("click", () => {
        this.setLabel(label);
        if (ITALIC_CHIPS.has(label)) this.setStyle({ italic: true });
        this.scroller.focus();
      });
      palette.appendChild(chip);
    }

    // 画布
    this.scroller = mk("div", "ste-scroll");
    this.scroller.tabIndex = 0;
    this.surface = mk("div", "ste-surface");
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("class", "ste-svg");
    this.input = mk("input", "ste-input");
    this.input.type = "text";
    this.input.hidden = true;
    this.input.spellcheck = false;

    // 空白画布上的引导层。pointer-events:none，所以点它等于点底下的画布；
    // 只有按钮自己接收点击。
    this.placeholder = mk("div", "ste-placeholder");
    const newRootBtn = mk("button", "ste-placeholder-btn", "＋ 创建根节点");
    newRootBtn.type = "button";
    newRootBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      this.createRoot();
    });
    // 这行提示里也有亲属称谓，所以要登记进 termNodes —— 只过一遍 #t() 是不够的，
    // 因为这里只在建 DOM 时求值一次，切换称谓时不会重新生成。
    const blankHint = "点画布任意处创建根节点。然后按 Enter 增加女儿节点、按 Shift+Enter 增加姊妹节点、按 Tab 增加一层投射层。";
    this.placeholder.append(
      mk("div", "ste-placeholder-title", "空白画布"),
      this.#term(mk("div", "ste-placeholder-sub", blankHint), "textContent", blankHint),
      newRootBtn,
    );

    this.surface.append(this.svg, this.input);
    this.scroller.append(this.surface, this.placeholder);

    // 空白画布时，点哪儿都算"开始画"。按钮的 click 也走这条路。
    this.scroller.addEventListener("pointerdown", (ev) => {
      if (this.root) return; // 有树时交给 svg 上的处理器
      ev.preventDefault();
      this.createRoot();
    });

    // 文本面板
    this.textWrap = mk("div", "ste-text");
    this.textarea = mk("textarea", "ste-textarea");
    this.textarea.spellcheck = false;
    this.errBox = mk("div", "ste-err");
    this.status = mk("div", "ste-status");

    const textHead = mk("div", "ste-text-head");
    textHead.appendChild(mk("div", "ste-caption", "源代码 —— 和上面的图双向同步"));
    const modeGroup = mk("div", "ste-seg-group");
    this.textModeButtons = {};
    for (const [value, label, hint] of TEXT_MODES) {
      const b = mk("button", "ste-seg", label);
      b.type = "button";
      b.title = hint;
      b.addEventListener("click", () => {
        this.setTextMode(value);
        this.scroller.focus();
      });
      modeGroup.appendChild(b);
      this.textModeButtons[value] = b;
    }
    textHead.appendChild(modeGroup);

    this.textWrap.append(textHead, this.#buildCodeBox(), this.errBox);
    if (!this.opts.showText) this.textWrap.hidden = true;

    const hint = mk("div", "ste-hint");
    hint.appendChild(mk("b", "", `${TIPS} `));
    this.hintEl = this.#term(mk("span", "", HINT), "textContent", HINT);
    hint.appendChild(this.hintEl);

    this.el.append(
      toolbar,
      alignRow,
      centerRow,
      palette,
      this.scroller,
      this.textWrap,
      this.status,
      hint,
    );
    this.host.replaceChildren(this.el);

    // 内联改名输入框
    this.input.addEventListener("input", () => {
      if (!this.editing) return;
      const raw = this.input.value;
      const clean = stripUnsupported(raw);
      if (clean !== raw) this.input.value = clean;
      this.editing.label = clean;
      this.#relayout();
      this.#positionEditor();
    });
    this.input.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      const ctrl = ev.ctrlKey || ev.metaKey;

      // 改名框里的撤销 / 重做，和主键盘区保持一致（重做是 Ctrl+Shift+Z）。
      // 撤销分两步走，符合直觉：
      //   已经改过标签 -> 先把标签恢复原样，留在框里继续编辑
      //   标签没动过   -> 退出编辑，并弹掉"进入改名"时压的那条历史，
      //                   让这次撤销落到真正的上一步（通常是刚创建的这个节点）
      if (ctrl && (ev.key === "z" || ev.key === "Z")) {
        ev.preventDefault();
        if (ev.shiftKey) {
          this.#commitEdit(true);
          this.redo();
          return;
        }
        if (this.input.value !== this.editBackup) {
          this.input.value = this.editBackup;
          this.editing.label = this.editBackup;
          this.#relayout();
          this.#positionEditor();
          this.input.select();
          return;
        }
        this.editing = null;
        this.input.hidden = true;
        this.undoStack.pop();
        this.undo();
        this.scroller.focus();
        return;
      }

      if (ev.key === "Enter") {
        ev.preventDefault();
        this.#commitEdit(true);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        this.#cancelEdit(true);
      } else if (ev.key === "Tab") {
        ev.preventDefault();
        const shift = ev.shiftKey;
        this.#commitEdit(true);
        shift ? this.collapseLevel() : this.addLevel();
      }
    });
    // 鼠标点到别处而失焦：照常提交，但不要抢回焦点（用户是主动点走的）
    this.input.addEventListener("blur", () => {
      if (this.editing) this.#commitEdit();
    });
  }

  // ------------------------------------------------------------ 渲染管线

  #reindex() {
    this.byId = new Map(this.root ? preorder(this.root).map((n) => [n.id, n]) : []);
  }

  #relayout() {
    // 空白画布：清空 SVG，显示引导层
    if (!this.root) {
      this.lay = null;
      this.nodeEls = new Map();
      this.editing = null;
      this.input.hidden = true;
      while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
      this.svg.setAttribute("xmlns", SVG_NS);
      this.svg.setAttribute("viewBox", "0 0 1 1");
      this.svg.setAttribute("width", 1);
      this.svg.setAttribute("height", 1);
      this.size = { width: 1, height: 1 };
      this.surface.style.width = "1px";
      this.surface.style.height = "1px";
      this.placeholder.hidden = false;
      return;
    }
    this.placeholder.hidden = true;

    this.lay = layout(this.root, this.measure, {
      fontSize: this.opts.fontSize,
      fontFamily: this.opts.fontFamily,
      vscale: this.opts.vscale,
      align: this.opts.align,
      center: this.opts.center,
    });
    this.size = drawTree(this.svg, this.lay, {
      selected: this.selected,
      triangles: this.opts.triangles,
      terminalLines: this.opts.terminalLines,
      colors: this.opts.colors,
      fontFamily: this.opts.fontFamily,
      fontSize: this.opts.fontSize,
    });
    this.surface.style.width = `${this.size.width}px`;
    this.surface.style.height = `${this.size.height}px`;

    // 记住每个节点对应的 <g>，这样切换选中态只需改 class，不用重建 SVG
    this.nodeEls = new Map();
    for (const g of this.svg.querySelectorAll(".ste-node")) {
      this.nodeEls.set(Number(g.dataset.id), g);
    }
  }

  #refresh({ syncText = false } = {}) {
    this.#reindex();
    this.#relayout();
    this.#syncAlignButtons();
    this.#syncCenterButtons();
    this.#syncTextModeButtons();
    if (syncText) this.#writeText();
    this.#updateStatus();
    this.#emitChange();
  }

  /** 用当前记法把模型渲染成文本 */
  #serializeCurrent(root = this.root) {
    return this.textMode === "rules" ? serializeRules(root) : serialize(root);
  }

  /** 用当前记法解析文本 */
  #parseCurrent(text) {
    return this.textMode === "rules" ? parseRules(text) : parse(text);
  }

  #syncTextModeButtons() {
    if (!this.textModeButtons) return;
    for (const [value, b] of Object.entries(this.textModeButtons)) {
      if (value === this.textMode) b.classList.add("is-active");
      else b.classList.remove("is-active");
    }
  }

  /** 切换代码框用的记法。模型不动，只是换个写法，所以是无损的。 */
  setTextMode(mode) {
    if (!TEXT_MODES.some(([v]) => v === mode) || this.textMode === mode) return;
    this.textMode = mode;
    this.#syncTextareaSize();
    this.#writeText(); // 里面会顺带刷新装订线
    this.#syncTextModeButtons();
  }

  /**
   * 代码框 = 左边一条装订线（行号）+ 右边真正的 textarea。
   *
   * 行号刻意【不写进文本】：写进文本的话一选中就连行号一起复制走了。
   * 装订线不可选中（user-select:none）、不接收键盘焦点，点它只会把焦点交给 textarea，
   * 行为跟 VS Code / PyCharm 一样。规则记法里行号就是节点编号，所以它同时是查表用的。
   */
  #buildCodeBox() {
    const mk = (tag, cls) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      return e;
    };

    this.codeBox = mk("div", "ste-code");
    this.gutter = mk("div", "ste-gutter");
    this.gutterLines = mk("div", "ste-gutter-lines");
    this.gutter.appendChild(this.gutterLines);
    this.gutter.title = "行号 = 本行引入的女儿节点编号（根节点是 0）";
    this.#term(this.gutter, "title", "行号 = 本行引入的女儿节点编号（根节点是 0）");
    this.gutter.addEventListener("pointerdown", (ev) => {
      ev.preventDefault(); // 别让装订线拿到选区或焦点
      this.textarea.focus();
    });

    this.codeBox.append(this.gutter, this.textarea);
    return this.codeBox;
  }

  /**
   * 按当前文本刷新装订线。
   * 装订线给每一行都编号（和 VS Code 一样），因为规则记法里"行号就是节点编号"，
   * 新起一行马上就能看到它的号。
   */
  #syncGutter() {
    if (this.textMode !== "rules") {
      this.gutter.hidden = true;
      return;
    }
    this.gutter.hidden = false;

    const count = this.textarea.value.split("\n").length;
    let marks = "";
    for (let i = 1; i <= count; i++) marks += (i > 1 ? "\n" : "") + i;
    this.gutterLines.textContent = marks;
    this.#syncGutterScroll();
  }

  #syncGutterScroll() {
    if (this.gutter.hidden) return;
    this.gutterLines.style.transform = `translateY(${-this.textarea.scrollTop}px)`;
  }

  /**
   * 规则记法里"编号就是行号"，所以在上面插一行、删一行都会让下面所有引用错位。
   * 这里在每次成功解析之后，把每一行开头的母亲节点编号改回正确值。
   *
   * 只动行首那个数字，其它字符（包括用户自己加的空行）一律不碰，
   * 光标按"距离行尾的距离"还原，所以打字不会被打断。
   */
  #repairRulesNumbers() {
    if (this.textMode !== "rules") return;
    const text = this.textarea.value;

    let root;
    try {
      root = parseRules(text);
    } catch {
      return; // 还没写完，先别动
    }

    // 行号 -> 那一行引入的节点
    const byLine = new Map();
    for (const n of preorder(root)) if (n.line != null) byLine.set(n.line, n);

    const lines = text.split("\n");
    let changed = false;

    const fixed = lines.map((line, index) => {
      const t = line.trim();
      if (t === "" || t.includes("-->") || !t.includes("->")) return line;

      const child = byLine.get(index + 1);
      if (!child) return line;

      const mother = findParent(root, child);
      const want = String(mother ? mother.line : 0);
      const m = /^(\s*)(\d+)(\s+)([\s\S]*)$/.exec(line);
      if (!m || m[2] === want) return line;

      changed = true;
      return m[1] + want + m[3] + m[4];
    });

    if (!changed) return;

    // 只有行首的数字会变，所以按"距离行尾的距离"还原光标最稳
    const before = offsetToLineCol(text, this.textarea.selectionStart);
    const colFromEnd = (lines[before.line] ?? "").length - before.col;
    const next = fixed.join("\n");
    const caret = lineColToOffset(next, before.line, (fixed[before.line] ?? "").length - colFromEnd);

    this.textarea.value = next;
    this.textarea.setSelectionRange(caret, caret);
    this.#syncGutter();
  }

  /** 规则记法一行一条，比括号记法长得多，所以给它更高的框 */
  #syncTextareaSize() {
    this.textarea.rows = this.textMode === "rules" ? 9 : 3;
  }

  /** 导出为规则记法 */
  getRules() {
    return this.root ? serializeRules(this.root).text : "";
  }

  /** 用规则记法设置整棵树 */
  setRules(text) {
    const trimmed = text == null ? "" : String(text);
    this.root = trimmed.trim() ? parseRules(trimmed) : null;
    this.selected = this.root;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.#refresh({ syncText: true });
  }

  #syncCenterButtons() {
    if (!this.centerButtons) return;
    for (const [value, b] of Object.entries(this.centerButtons)) {
      if (value === this.opts.center) b.classList.add("is-active");
      else b.classList.remove("is-active");
    }
  }

  /** 切换水平位置模式："mother" | "block" */
  setCenter(center) {
    if (!CENTER_CHOICES.some(([v]) => v === center)) return;
    if (this.opts.center === center) return;
    this.opts.center = center;
    this.#refresh({ syncText: false });
  }

  #syncAlignButtons() {
    if (!this.alignButtons) return;
    for (const [value, b] of Object.entries(this.alignButtons)) {
      if (value === this.opts.align) b.classList.add("is-active");
      else b.classList.remove("is-active");
    }
  }

  /** 切换垂直对齐方式："depth" | "leaves" | "compact" */
  setAlign(align) {
    if (!ALIGN_CHOICES.some(([v]) => v === align)) return;
    if (this.opts.align === align) return;
    this.opts.align = align;
    this.#refresh({ syncText: false });
  }

  #writeText() {
    const text = this.root ? this.#serializeCurrent().text : "";
    if (this.textarea.value !== text) this.textarea.value = text;
    this.#syncGutter();
    this.#clearError();
  }

  #emitChange() {
    if (typeof this.opts.onChange === "function") {
      this.opts.onChange({
        text: this.root ? serialize(this.root).text : "",
        rules: this.root ? serializeRules(this.root).text : "",
        mode: this.textMode,
        editor: this,
      });
    }
  }

  #updateStatus() {
    const n = this.selected;

    if (!this.root) {
      this.status.textContent = "空白画布 —— 还没有任何节点";
      for (const b of [
        this.btnDelete,
        this.btnSibling,
        this.btnMoveLeft,
        this.btnMoveRight,
        this.btnAddLevel,
        this.btnCollapseLevel,
      ])
        b.disabled = true;
      this.btnChild.disabled = false; // 此时它是"创建根节点"
      this.btnChild.labelEl.textContent = "＋根节点";
      this.btnUndo.disabled = this.undoStack.length === 0;
      this.btnRedo.disabled = this.redoStack.length === 0;
      return;
    }
    this.btnChild.labelEl.textContent = this.#t("＋女儿节点");

    const ord = preorder(this.root);
    if (!n) {
      this.status.textContent = "未选中任何节点";
    } else {
      const i = ord.indexOf(n);
      const kind = n.children.length === 0 ? "叶子节点" : "非叶子节点";
      const label = n.label === "" ? "(空标签)" : n.label;
      this.status.textContent = `已选中第 ${i + 1} 个（共 ${ord.length} 个）：${label} · ${kind} · 子树共 ${countSubtree(n)} 个节点`;
    }

    // 根节点：没有女儿节点时可以删（回到空白画布）；只有一个女儿节点时可以删（把它提上来）；
    // 有两个以上女儿节点时不允许删（删了没法安置其余分支）。
    this.btnDelete.disabled = !n || (n === this.root && n.children.length > 1);
    this.btnChild.disabled = !n;
    this.btnSibling.disabled = !n || n === this.root;
    this.btnMoveRight.disabled = !this.#canMoveRight();
    this.btnMoveLeft.disabled = !this.#canMoveLeft();
    this.btnAddLevel.disabled = !canAddPrimeLevel(this.root, n);
    this.btnCollapseLevel.disabled = !canCollapsePrimeLevel(this.root, n);
    this.btnUndo.disabled = this.undoStack.length === 0;
    this.btnRedo.disabled = this.redoStack.length === 0;
  }

  #showError(err) {
    let msg;
    if (err instanceof NotationError) msg = `第 ${err.index} 个字符附近：${err.message}`;
    else if (err instanceof RuleError) msg = `第 ${err.line} 行：${err.message}`;
    else msg = err && err.message ? err.message : String(err);
    this.errBox.textContent = msg;
    this.errBox.classList.add("is-visible");
  }

  #clearError() {
    this.errBox.textContent = "";
    this.errBox.classList.remove("is-visible");
  }

  /**
   * 切换选中态。
   *
   * ⚠️ 这里刻意【不重建 SVG】：浏览器判断双击要求两次点击落在同一个元素上，
   * 如果在 pointerdown 里重建整棵 SVG，双击改名就永远触发不了。
   * 所以只改相关 <g> 的 class。
   */
  #select(n) {
    const prev = this.selected;
    if (prev === n) return;

    if (prev && this.nodeEls && this.nodeEls.has(prev.id)) {
      this.nodeEls.get(prev.id).classList.remove("is-selected");
    }
    this.selected = n || null;
    if (this.selected && this.nodeEls && this.nodeEls.has(this.selected.id)) {
      this.nodeEls.get(this.selected.id).classList.add("is-selected");
    }
    this.#updateStatus();
  }

  // ------------------------------------------------------------ 历史

  #snapshot() {
    const ord = this.root ? preorder(this.root) : [];
    return {
      text: this.root ? serialize(this.root).text : "",
      sel: this.selected ? ord.indexOf(this.selected) : 0,
    };
  }

  #pushUndo() {
    this.undoStack.push(this.#snapshot());
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack.length = 0;
    this.#updateStatus();
  }

  #restore(snap) {
    this.root = snap.text && snap.text.trim() ? parse(snap.text) : null;
    if (!this.root) {
      this.selected = null;
      this.#refresh({ syncText: true });
      return;
    }
    const ord = preorder(this.root);
    this.selected = ord[Math.min(Math.max(snap.sel, 0), ord.length - 1)] || this.root;
    this.#refresh({ syncText: true });
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.#snapshot());
    this.#restore(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.#snapshot());
    this.#restore(this.redoStack.pop());
  }

  #mutate(fn, after) {
    this.#pushUndo();
    fn();
    if (after) after();
    this.#refresh({ syncText: true });
  }

  // ------------------------------------------------------------ 编辑动作

  /**
   * 在空白画布上创建根节点，并直接进入改名状态。
   * 已经有树时只做选中 —— 所以可以安全地重复调用。
   */
  createRoot(label = "S") {
    if (this.root) {
      if (this.selected !== this.root) this.#select(this.root);
      return this.root;
    }
    const created = node(label);
    this.#mutate(
      () => {
        this.root = created;
      },
      () => {
        this.selected = created;
      },
    );
    this.#startEdit(created);
    return created;
  }

  addChild() {
    if (!this.root) return this.createRoot();
    const target = this.selected || this.root;
    if (!target) return;
    let created = null;
    this.#mutate(
      () => {
        created = addChild(target, node("X"));
      },
      () => {
        this.selected = created;
      },
    );
    this.#startEdit(created);
  }

  addSibling() {
    const n = this.selected;
    if (!this.root || !n || n === this.root) return this.addChild();
    const p = findParent(this.root, n);
    if (!p) return this.addChild();
    let created = null;
    this.#mutate(
      () => {
        created = addChild(p, node("X"), p.children.indexOf(n) + 1);
      },
      () => {
        this.selected = created;
      },
    );
    this.#startEdit(created);
  }

  /**
   * 下移（Tab）：在投射链的最顶端之上插入一个新的投射层，
   * 选中的节点连同整条链一起下移一层。例：
   *   [XP [Z word1] [X'' [X' [X word2]]]]  ->  [XP [Z word1] [X''' [X'' [X' [X word2]]]]]
   */
  addLevel() {
    if (!this.root || !this.selected) return;
    if (!canAddPrimeLevel(this.root, this.selected)) return;
    this.#mutate(() => addPrimeLevel(this.root, this.selected));
  }

  /**
   * 上移（Shift+Tab）：下移的逆。要求母亲节点只有自己这一个女儿节点、
   * 并且母亲节点的标签正好是自己加一个撇。删掉母亲节点、自己顶替它的位置，
   * 再把母亲节点以上的每一层各减一个撇。例：
   *   [CP [C that] [TP [N Chomsky] [T'' [T' [T will]] [V]]]]   对 T 上移
   *   -> [CP [C that] [TP [N Chomsky] [T' [T will] [V]]]]
   */
  collapseLevel() {
    if (!this.root || !this.selected) return;
    if (!canCollapsePrimeLevel(this.root, this.selected)) return;
    this.#mutate(() => {
      const next = collapsePrimeLevel(this.root, this.selected);
      if (next) this.root = next; // 母亲节点就是根时，自己变成新的根
    });
  }

  /** 能不能左移：自己有左姊妹节点，或者母亲节点有左姊妹节点 */
  #canMoveLeft() {
    if (!this.root || !this.selected) return false;
    const mother = findParent(this.root, this.selected);
    if (!mother) return false;
    const index = mother.children.indexOf(this.selected);
    if (index > 0) return true; // ① 有左姊妹节点，可以换位
    const grandmother = findParent(this.root, mother);
    if (!grandmother) return false;
    return grandmother.children.indexOf(mother) > 0; // ② 母亲节点有左姊妹节点
  }

  /** 能不能右移：自己有右姊妹节点，或者母亲节点有右姊妹节点 */
  #canMoveRight() {
    if (!this.root || !this.selected) return false;
    const mother = findParent(this.root, this.selected);
    if (!mother) return false;
    const index = mother.children.indexOf(this.selected);
    if (index >= 0 && index < mother.children.length - 1) return true; // ① 有右姊妹节点
    const grandmother = findParent(this.root, mother);
    if (!grandmother) return false;
    const motherIndex = grandmother.children.indexOf(mother);
    return motherIndex >= 0 && motherIndex < grandmother.children.length - 1;
  }

  /**
   * 左移（Alt+← / Ctrl+←）：自己是最左边的女儿节点时，搬到母亲节点的左姊妹节点底下。
   */
  moveLeft() {
    if (!this.#canMoveLeft()) return;
    this.#mutate(() => moveNodeLeft(this.root, this.selected));
  }

  /**
   * 右移（Alt+→ / Ctrl+→）：自己是最右边的女儿节点时，搬到母亲节点的右姊妹节点底下。
   */
  moveRight() {
    if (!this.#canMoveRight()) return;
    this.#mutate(() => moveNodeRight(this.root, this.selected));
  }

  /**
   * 删除选中的节点。
   * 根节点比较特殊：没有女儿节点就删回【空白画布】，
   * 只有一个女儿节点就把它提上来（等价于"去掉这层括号"，无损），
   * 有两个以上女儿节点时不允许删（删了没法安置其余分支）。
   */
  remove() {
    const n = this.selected;
    if (!this.root || !n) return;

    if (n === this.root) {
      if (n.children.length === 0) {
        this.#mutate(() => {
          this.root = null;
          this.selected = null;
        });
      } else if (n.children.length === 1) {
        const promoted = n.children[0];
        this.#mutate(
          () => {
            this.root = promoted;
          },
          () => {
            this.selected = promoted;
          },
        );
      }
      return;
    }

    const p = findParent(this.root, n);
    const i = p.children.indexOf(n);
    const next = p.children[i + 1] || p.children[i - 1] || p;
    this.#mutate(
      () => {
        removeNode(this.root, n);
      },
      () => {
        this.selected = next;
      },
    );
  }

  /** 套用标签（范畴快捷按钮 / 外部调用）。空白画布上会用它当根节点开一棵树 */
  setLabel(text) {
    const clean = stripUnsupported(text);
    if (!this.root) {
      this.createRoot(clean || "S");
      return;
    }
    const n = this.selected || this.root;
    if (!n || n.label === clean) return;
    this.#mutate(() => {
      n.label = clean;
    });
  }

  // ------------------------------------------------------------ 内联改名

  #startEdit(n) {
    if (!n) return;
    const it = this.lay && this.lay.info.get(n);
    if (!it) return;
    this.#pushUndo();
    this.editBackup = n.label;
    this.editing = n;
    this.input.hidden = false;
    this.input.value = n.label;
    this.#positionEditor();
    this.input.focus();
    this.input.select();
  }

  #positionEditor() {
    const n = this.editing;
    if (!n || !this.lay) return;
    const it = this.lay.info.get(n);
    if (!it) return;
    const w = Math.max(it.labelW, 60);
    this.input.style.left = `${it.cx - w / 2}px`;
    this.input.style.top = `${it.y}px`;
    this.input.style.width = `${w}px`;
    this.input.style.height = `${this.lay.nodeH}px`;
    this.input.style.fontSize = `${this.lay.options.fontSize}px`;
    this.input.style.fontFamily = this.lay.options.fontFamily;
  }

  /**
   * 提交改名。
   * refocus=true 时会把键盘焦点还给画布 —— 输入框一旦隐藏，焦点就掉回 body，
   * 不还回去的话用户必须再点一下图才能用方向键，所以键盘提交的路径都要传 true。
   */
  #commitEdit(refocus = false) {
    if (!this.editing) return;
    const n = this.editing;
    this.editing = null;
    this.input.hidden = true;
    if (n.label === this.editBackup) this.undoStack.pop(); // 没有实际改动，撤掉这条历史
    this.#refresh({ syncText: true });
    if (refocus) this.scroller.focus();
  }

  #cancelEdit(refocus = false) {
    if (!this.editing) return;
    const n = this.editing;
    this.editing = null;
    this.input.hidden = true;
    n.label = this.editBackup;
    this.undoStack.pop();
    this.#refresh({ syncText: true });
    if (refocus) this.scroller.focus();
  }

  // ------------------------------------------------------------ 事件

  #onCanvasDown(ev) {
    if (!this.root) return; // 空白画布交给 scroller 上的处理器去创建根节点
    const g = ev.target.closest ? ev.target.closest(".ste-node") : null;
    if (!g) {
      this.#select(null);
      this.scroller.focus();
      return;
    }
    const n = this.byId.get(Number(g.dataset.id));
    this.#select(n);
    this.scroller.focus();
  }

  #onCanvasDblClick(ev) {
    const g = ev.target.closest ? ev.target.closest(".ste-node") : null;
    if (!g) return;
    this.#startEdit(this.byId.get(Number(g.dataset.id)));
  }

  /**
   * 换一套亲属称谓。**只改界面上的文字**（按钮名、提示行、装订线说明），
   * 对树的结构和任何行为都没有影响。
   * @param {Array<[string,string]>|null} pairs 替换表；null 表示恢复母系默认文案
   */
  setTerms(pairs) {
    this.termPairs = pairs || null;
    for (const [el, prop, base] of this.termNodes) el[prop] = this.#t(base);
    this.#updateStatus();
  }

  /** 把当前称谓套用到一段文案上 */
  #t(s) {
    if (!this.termPairs) return s;
    return this.termPairs.reduce((acc, [a, b]) => acc.split(a).join(b), s);
  }

  /** 界面文案要在切换称谓时重新生成的，都登记在这里 */
  #term(el, prop, base) {
    (this.termNodes || (this.termNodes = [])).push([el, prop, base]);
    return el;
  }

  #onKeyDown(ev) {
    const t = ev.target;
    if (t === this.input || t === this.textarea) return; // 各自处理原生行为

    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && (ev.key === "z" || ev.key === "Z")) {
      ev.preventDefault();
      ev.shiftKey ? this.redo() : this.undo(); // 重做是 Ctrl+Shift+Z，不是 Ctrl+Y
      return;
    }
    // 吸收相邻姊妹的子树。Alt+←/→ 是用户要的键位，但浏览器把 Alt+←/→ 当成
    // "后退/前进"，未必拦得住，所以 Ctrl+←/→ 也绑一份，另外工具栏还有按钮。
    if ((ev.altKey || ctrl) && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
      ev.preventDefault();
      ev.key === "ArrowRight" ? this.moveRight() : this.moveLeft();
      return;
    }

    // 空白画布：只认"创建根节点"
    if (!this.root) {
      if (ev.key === "Enter" || ev.key === "F2") {
        ev.preventDefault();
        this.createRoot();
      }
      return;
    }

    const n = this.selected || this.root;

    // 方向键按树本身的方向走：
    //   ↑ 母亲节点   ↓ 最左边的那个女儿节点
    //   ← → 左右姊妹节点；到边了就跨到堂表姊妹节点（范围与 Alt+←/→ 一致）
    // 走到头就停住（不绕回），这和大多数大纲 / 树控件的手感一致。
    switch (ev.key) {
      case "ArrowUp": {
        const mother = findParent(this.root, n);
        if (mother) {
          ev.preventDefault();
          this.#select(mother);
        }
        return;
      }
      case "ArrowDown": {
        if (n.children.length) {
          ev.preventDefault();
          this.#select(n.children[0]);
        }
        return;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        const dir = ev.key === "ArrowLeft" ? -1 : 1;
        const mother = findParent(this.root, n);
        if (!mother) return;

        // ① 先在同一条母亲节点底下找同侧的姊妹节点
        const here = mother.children.indexOf(n);
        const sister = mother.children[here + dir];
        if (sister) {
          ev.preventDefault();
          this.#select(sister);
          return;
        }

        // ② 自己已经是最边上那个了：跨到母亲节点的同侧姊妹节点底下，
        //    找最靠近自己的那个女儿节点 —— 也就是堂表姊妹节点。
        //    范围因此和 Alt+←/→ 一致。
        const grandmother = findParent(this.root, mother);
        if (!grandmother) return;
        const aunt = grandmother.children[grandmother.children.indexOf(mother) + dir];
        if (!aunt || !aunt.children.length) return;
        const cousin = dir < 0 ? aunt.children[aunt.children.length - 1] : aunt.children[0];
        ev.preventDefault();
        this.#select(cousin);
        return;
      }
      case "Enter":
        // 加女儿节点最常用，所以给 Enter；加姊妹节点挪到 Shift+Enter
        ev.preventDefault();
        ev.shiftKey ? this.addSibling() : this.addChild();
        return;
      case "Tab":
        // Tab 是"下移"：加一层投射；Shift+Tab 是它的逆
        ev.preventDefault();
        ev.shiftKey ? this.collapseLevel() : this.addLevel();
        return;
      case "F2":
        ev.preventDefault();
        this.#startEdit(n);
        return;
      case "Delete":
      case "Backspace":
        ev.preventDefault();
        this.remove();
        return;
      default:
        return;
    }
  }

  // ------------------------------------------------------------ 文本面板

  #onTextInput() {
    clearTimeout(this.textTimer);
    this.textTimer = setTimeout(() => {
      const text = this.textarea.value;

      // 清空文本框 = 回到空白画布
      if (!text.trim()) {
        this.root = null;
        this.selected = null;
        this.#clearError();
        this.#refresh({ syncText: false });
        return;
      }

      const caret = this.textarea.selectionStart;
      let root;
      try {
        root = this.#parseCurrent(text);
      } catch (err) {
        this.#showError(err); // 解析失败时保留上一棵好树，不打断输入
        return;
      }
      this.root = root;
      this.#clearError();
      this.#selectByOffset(root, caret);
      this.#refresh({ syncText: false });
      this.#repairRulesNumbers(); // 编号 = 行号，插行/删行后要把下面的引用改回去
    }, TEXT_DEBOUNCE);
  }

  #selectFromCaret() {
    const text = this.textarea.value;
    if (!text.trim()) {
      if (!this.root) return;
      this.root = null;
      this.selected = null;
      this.#clearError();
      this.#refresh({ syncText: false });
      return;
    }
    let root;
    try {
      root = this.#parseCurrent(text);
    } catch {
      return;
    }
    this.root = root;
    this.#selectByOffset(root, this.textarea.selectionStart);
    this.#refresh({ syncText: false });
  }

  /** 光标偏移 -> 最内层的那个节点 */
  #selectByOffset(root, offset) {
    const { spans } = this.#serializeCurrent(root);
    let best = null;
    let bestLen = Infinity;
    for (const [n, [s, e]] of spans) {
      if (offset >= s && offset <= e && e - s < bestLen) {
        best = n;
        bestLen = e - s;
      }
    }
    this.selected = best || root;
  }
}

function countSubtree(n) {
  let c = 0;
  (function rec(x) {
    c++;
    for (const y of x.children) rec(y);
  })(n);
  return c;
}
