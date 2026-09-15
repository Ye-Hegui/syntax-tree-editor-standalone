// 极简 DOM 垫片 —— 只实现 editor.js / render.js / layout.js 实际用到的那部分 API。
//
// 目的：这台机器上的 Edge/Chrome 无法在受限环境里启动（crashpad IPC 被拦截，
// 连 about:blank 的 --dump-dom 都是空的），所以交互层没法用真浏览器验证。
// 这个垫片让编辑器的逻辑能在 Node 里端到端跑起来：挂载、渲染、选中、
// 内联改名、快捷键、撤销重做、双向同步。视觉呈现仍需人眼确认。

class ClassList {
  constructor(el) {
    this.el = el;
  }
  #list() {
    return (this.el._attrs.get("class") || "").split(/\s+/).filter(Boolean);
  }
  #set(list) {
    this.el._attrs.set("class", list.join(" "));
  }
  add(...names) {
    const list = this.#list();
    for (const n of names) if (n && !list.includes(n)) list.push(n);
    this.#set(list);
  }
  remove(...names) {
    this.#set(this.#list().filter((x) => !names.includes(x)));
  }
  contains(name) {
    return this.#list().includes(name);
  }
}

let NODE_SEQ = 0;

export class El {
  constructor(tag, ns = null) {
    this._uid = ++NODE_SEQ;
    this.tagName = String(tag).toUpperCase();
    this.ns = ns;
    this._attrs = new Map();
    this._listeners = new Map();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this._text = "";
    this._value = "";
    this.hidden = false;
    this.disabled = false;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.classList = new ClassList(this);
  }

  // --- 属性
  setAttribute(k, v) {
    this._attrs.set(String(k), String(v));
  }
  getAttribute(k) {
    return this._attrs.has(String(k)) ? this._attrs.get(String(k)) : null;
  }
  get className() {
    return this.getAttribute("class") || "";
  }
  set className(v) {
    this.setAttribute("class", v);
  }
  get dataset() {
    const out = {};
    for (const [k, v] of this._attrs) {
      const m = /^data-(.+)$/.exec(k);
      if (m) out[m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    }
    return out;
  }

  // --- 文本与值
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    this.children.length = 0;
    this._text = String(v);
  }
  get value() {
    return this._value;
  }
  set value(v) {
    this._value = String(v);
  }

  // --- 树结构
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  append(...nodes) {
    for (const n of nodes) this.appendChild(n);
  }
  insertBefore(node, ref) {
    node.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(node);
    else this.children.splice(i, 0, node);
    return node;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  replaceChildren(...nodes) {
    this.children.length = 0;
    this._text = "";
    this.append(...nodes);
  }
  get firstChild() {
    return this.children[0] || null;
  }

  // --- 选择器
  matches(sel) {
    if (sel.startsWith(".")) return this.classList.contains(sel.slice(1));
    return this.tagName === sel.toUpperCase();
  }
  closest(sel) {
    let n = this;
    while (n) {
      if (n.matches(sel)) return n;
      n = n.parentNode;
    }
    return null;
  }
  #descendants(out = []) {
    for (const c of this.children) {
      out.push(c);
      c.#descendants(out);
    }
    return out;
  }
  querySelectorAll(sel) {
    const parts = sel.split(",").map((s) => s.trim());
    return this.#descendants().filter((n) => parts.some((p) => n.matches(p)));
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  // --- 事件
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const ls = this._listeners.get(type);
    if (ls) this._listeners.set(type, ls.filter((f) => f !== fn));
  }
  dispatchEvent(ev) {
    if (!ev.target) ev.target = this;
    let n = this;
    while (n) {
      const ls = n._listeners.get(ev.type);
      if (ls) {
        ev.currentTarget = n;
        for (const fn of [...ls]) fn.call(n, ev);
      }
      n = n.parentNode;
    }
    return true;
  }
  click() {
    this.dispatchEvent(makeEvent("click"));
  }

  // --- 焦点
  focus() {
    doc.activeElement = this;
  }
  blur() {
    if (doc.activeElement === this) doc.activeElement = null;
    this.dispatchEvent(makeEvent("blur"));
  }
  select() {
    this.selectionStart = 0;
    this.selectionEnd = this._value.length;
  }
  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end ?? start;
  }

  cloneNode(deep = false) {
    const copy = new El(this.tagName, this.ns);
    for (const [k, v] of this._attrs) copy._attrs.set(k, v);
    copy._text = this._text;
    if (deep) for (const c of this.children) copy.appendChild(c.cloneNode(true));
    return copy;
  }
}

export function makeEvent(type, props = {}) {
  return {
    type,
    target: null,
    currentTarget: null,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    ...props,
  };
}

const ctx2d = {
  font: "16px sans-serif",
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  measureText(text) {
    const m = /^(\d+(?:\.\d+)?)px/.exec(this.font);
    const size = m ? Number(m[1]) : 16;
    return { width: String(text).length * size * 0.55 };
  },
  clearRect() {},
  setTransform() {},
  translate() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  bezierCurveTo() {},
  rect() {},
  fill() {},
  stroke() {},
  fillText() {},
};

export const doc = {
  activeElement: null,
  _selectors: new Map(),
  /** 把某个选择器映射到元素，供 document.querySelector 用 */
  register(selector, el) {
    this._selectors.set(selector, el);
    return el;
  },
  querySelector(selector) {
    return this._selectors.get(selector) || null;
  },
  querySelectorAll(selector) {
    const v = this._selectors.get(selector);
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  },
  createElement(tag) {
    const e = new El(tag);
    if (String(tag).toLowerCase() === "canvas") e.getContext = () => ctx2d;
    return e;
  },
  createElementNS(ns, tag) {
    return new El(tag, ns);
  },
};

export class XMLSerializer {
  serializeToString(el) {
    const attrs = [...el._attrs].map(([k, v]) => ` ${k}="${v}"`).join("");
    const tag = el.tagName.toLowerCase();
    const inner = el.children.length
      ? el.children.map((c) => this.serializeToString(c)).join("")
      : escapeXML(el._text);
    return `<${tag}${attrs}>${inner}</${tag}>`;
  }
}

function escapeXML(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 安装到全局，之后才能 import editor.js */
export function installDom() {
  globalThis.document = doc;
  globalThis.XMLSerializer = XMLSerializer;
  globalThis.window = globalThis;
  globalThis.location = { search: "" };
  return doc;
}
