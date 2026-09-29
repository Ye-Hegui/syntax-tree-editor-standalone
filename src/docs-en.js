/**
 * 教程正文（网页底部「使用方法」那一篇）的英文版。
 *
 * 为什么单独一个模块：正文是**一整篇 HTML**，用 `i18n.js` 那种"一条一条 key"的表不划算；
 * `main.js` 是按语言整体替换 `.docs` 里的 innerHTML 的（和 `setTerms()` 换称谓是同一套机制），
 * 所以这里只要把整篇 HTML 交出去就行。
 *
 * ⚠️ 改这一篇时的三条硬规矩：
 *   1. `id="doc-*"` 必须和目录里的 `href="#doc-*"` 一一配对，而且要**和中文正文用同一批 id**
 *      （`check-project.mjs` 会比对两边）；
 *   2. 图片标签原样保留（`src` 指向 `example/` 下的 SVG）—— 构建脚本会把它们内联成 data URI。
 *      ⚠️ 连**注释里**也别写出"src 等于一个 example 下的 .svg 文件名"这种完整写法：
 *      构建是按正则扫整个产物的，会把注释里那处当成真图片去找文件，然后报 ENOENT（踩过两次）；
 *   3. 亲属称谓一律写 `mother / sister / daughter` 那套原文，由 `TERMS.en` 换成
 *      neutral / paternal（界面默认是中性套）；写别的词就换不掉。
 *
 * 这个模块**只导出常量、不 import 任何东西** —— 扁平打包会整条去掉 `import`，少一层依赖少一分风险。
 */
export const DOCS_EN = `
<nav class="docs-toc">
  <ol>
    <li>
      <a href="#doc-basic">The basics</a>
      <ol>
        <li><a href="#doc-start">Starting from nothing</a></li>
        <li><a href="#doc-create">Creating nodes</a></li>
        <li><a href="#doc-delete">Deleting nodes</a></li>
        <li><a href="#doc-undo">Undo and redo</a></li>
        <li><a href="#doc-triangle">Making a triangle</a></li>
        <li><a href="#doc-arrow">Drawing an arrow</a></li>
        <li><a href="#doc-export">Exporting</a></li>
      </ol>
    </li>
    <li>
      <a href="#doc-advanced">Beyond the basics</a>
      <ol>
        <li><a href="#doc-align">Vertical alignment</a></li>
        <li><a href="#doc-hcenter">Horizontal position</a></li>
        <li><a href="#doc-keys">Selecting with the arrow keys</a></li>
        <li><a href="#doc-level">Move down</a></li>
        <li><a href="#doc-up">Move up</a></li>
        <li><a href="#doc-forceup">Force up</a></li>
        <li><a href="#doc-move">Move left and right</a></li>
        <li><a href="#doc-style">Font and colour</a></li>
      </ol>
    </li>
    <li>
      <a href="#doc-source">About the source code</a>
      <ol>
        <li><a href="#doc-bracket">Bracket notation</a></li>
        <li><a href="#doc-rules">Rule notation</a></li>
      </ol>
    </li>
    <li><a href="#doc-notes">Things to keep in mind</a></li>
  </ol>
</nav>

<h3 id="doc-basic">1. The basics</h3>

<h4 id="doc-start">1.1 Starting from nothing</h4>
<p class="tip">This editor is a small, lightweight syntax tree editor: it makes syntax trees quick and easy to build.</p>
<p>
  Click the “Blank” example button above to start with no nodes at all. The other examples work the same way —
  load one and edit it directly. Emptying the source box below also clears the canvas, and pasting bracketed
  source from anywhere else builds a tree straight away.
</p>
<p>
  Click anywhere on the blank canvas and the editor creates a root node and immediately opens the rename box.
  You can also click a category button (S, CP, VP, …) to create a root node with that label.
</p>
<p>
  Feel free to click through the five example buttons. Loading an example replaces the current tree, but
  <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes the load.
</p>

<h4 id="doc-create">1.2 Creating nodes</h4>
<p class="tip">You can add a daughter node or a sister node to a node.</p>
<table>
  <tbody>
    <tr><td><kbd>Enter</kbd></td><td>The editor creates a daughter node and immediately opens the rename box.</td></tr>
    <tr><td><kbd>Shift</kbd>+<kbd>Enter</kbd></td><td>The editor creates a sister node and immediately opens the rename box.</td></tr>
    <tr><td><kbd>F2</kbd></td><td>The editor opens the rename box for the selected node's label. Double-clicking does the same.</td></tr>
  </tbody>
</table>
<p>
  Keyboard shortcuts keep the selection inside the tree, so the whole tree can be built from the keyboard alone.
  Clicking “＋ Daughter” or “＋ Sister” on the toolbar does the same thing with the mouse, and
  clicking a node selects it.
</p>
<p>
  Clicking a category button (S, CP, VP, …) applies that label to the selected node, which is faster than typing.
  <i>v</i> and <i>pro</i> are also drawn in italic in the tree.
</p>

<h4 id="doc-delete">1.3 Deleting nodes</h4>
<p class="tip">Deleting a node removes that node and its whole subtree.</p>
<p>
  Press <kbd>Delete</kbd> with a node selected, or click “Delete” on the toolbar, and the editor removes
  that node together with its whole subtree.
</p>
<p>Deleting the root node is a special case:</p>
<ul>
  <li>With no daughter nodes, deleting it clears the canvas.</li>
  <li>With exactly one daughter node, the editor lifts that daughter up to become the new root.</li>
  <li>With two or more daughter nodes it cannot be deleted, because the remaining branches have nowhere to go.</li>
</ul>

<h4 id="doc-undo">1.4 Undo and redo</h4>
<p class="tip">Undo and redo move back and forth through the editing history.</p>
<table>
  <tbody>
    <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>The editor undoes the last step. This also works while the rename box is open.</td></tr>
    <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>The editor redoes the step that was undone.</td></tr>
  </tbody>
</table>
<p>
  Pressing <kbd>Ctrl</kbd>+<kbd>Z</kbd> inside the rename box happens in two steps: if the label has been
  changed, it first restores the label and stays in the box; if the label has not been touched, the editor
  leaves the rename box and then undoes the real previous step.
</p>

<h4 id="doc-triangle">1.5 Making a triangle</h4>
<p class="tip">A triangle means writing several words into one leaf node; the editor draws that node as a triangle.</p>
<p>
  Start with the most ordinary tree, where every word has a leaf node of its own:
</p>
<pre class="code-block">[XP [Z word1] [X' [X word2] [Y word3]]]</pre>
<img class="doc-shot" src="example/base.svg" alt="Before: four words, each in its own leaf node" />
<p>
  Now leave a space after <code>word2</code> and write one more word:
</p>
<pre class="code-block">[XP [Z word1] [X' [X word2 word4] [Y word3]]]</pre>
<p>
  Two adjacent words merge into <b>one and the same</b> leaf node, whose label is
  <code>"word2 word4"</code>. The editor draws this “several words under one node” case as a triangle:
</p>
<img class="doc-shot" src="example/triangle.svg" alt="After: word2 word4 merged into one leaf node, drawn as a triangle" />
<p>
  So making a triangle takes exactly one step: <b>write the words together</b>, and the editor draws
  the triangle for you. Note the difference from two separate leaf nodes — <code>[X word2] [Y word3]</code>
  is two leaf nodes, whereas <code>[X word2 word4]</code> is one.
</p>

<h4 id="doc-arrow">1.6 Drawing an arrow</h4>
<p class="tip">Writing a word ordinal after a leaf node's label creates a movement arrow pointing at that word.</p>
<p>Arrows cannot be drawn on the canvas itself; they are written in the code panel. Again, start from the same ordinary tree:</p>
<pre class="code-block">[XP [Z word1] [X' [X word2] [Y word3]]]</pre>
<img class="doc-shot" src="example/base.svg" alt="Before: no arrows yet" />
<p>
  The number in an arrow is a <b>word ordinal</b>: count the words from left to right.
  This tree has three words — <code>word1</code> is the 1st, <code>word2</code> the 2nd and
  <code>word3</code> the 3rd.
</p>
<p>
  Put the ordinal after a leaf node and that node carries an arrow. To make <code>word3</code> point at
  <code>word1</code>, add <code>-&gt;1</code> after <code>word3</code>:
</p>
<pre class="code-block">[XP [Z word1] [X' [X word2] [Y word3 ->1]]]</pre>
<img class="doc-shot" src="example/arrow.svg" alt="The movement arrow that appears after adding ->1" />
<p>
  An arrow must start at a leaf node and end at a leaf node — a word ordinal can only locate words.
  This numbering matches jsSyntaxTree, so its code can be pasted straight in.
</p>

<h4 id="doc-export">1.7 Exporting</h4>
<p class="tip">The current syntax tree can be exported as a vector image or a bitmap.</p>
<p>
  Click “SVG” to export a vector image, which can go straight into Word, LaTeX or Illustrator.
  Click “PNG” to export a bitmap at twice the resolution. The selection highlight is never exported.
</p>

<h3 id="doc-advanced">2. Beyond the basics</h3>

<h4 id="doc-align">2.1 Vertical alignment</h4>
<p class="tip">Vertical alignment changes where nodes sit vertically.</p>
<p>
  The three buttons under the toolbar — “By depth”, “Words at bottom” and “Tree at bottom” — decide the
  vertical position of each level. Load the “Movement” example above and switch between the three modes
  to see the difference.
</p>
<table>
  <tbody>
    <tr><td><b>By depth</b></td><td>Every node stays on its own level's row; nodes at the same level share one height.</td></tr>
    <tr><td><b>Words at bottom</b></td><td>All leaf nodes (that is, words) drop to the bottom row; inner nodes keep their level.</td></tr>
    <tr><td><b>Tree at bottom</b></td><td>With the leaves aligned at the bottom, inner nodes slide down as far as they can to hug their daughter nodes, compressing the whole tree onto the bottom line.</td></tr>
  </tbody>
</table>
<p>Vertical alignment only changes vertical positions; horizontal ones are decided by “Horizontal”.</p>

<h4 id="doc-hcenter">2.2 Horizontal position</h4>
<p class="tip">Horizontal position changes where a mother node sits horizontally.</p>
<p>“Horizontal” decides where a mother node stands from left to right:</p>
<table>
  <tbody>
    <tr><td><b>Mother centred</b></td><td>The mother lands <b>exactly between the leftmost and the rightmost daughter node</b>. (Default)</td></tr>
    <tr><td><b>Block centred</b></td><td>The mother is centred over the <b>bounding box of all its daughter nodes</b>, which makes the whole subtree look more balanced.</td></tr>
  </tbody>
</table>
<p>The two modes only differ when a node has two daughter nodes of unequal width.</p>

<h4 id="doc-keys">2.3 Selecting with the arrow keys</h4>
<p class="tip">The arrow keys move the selection from node to node with the keyboard.</p>
<p>
  Click once on the canvas to give it keyboard focus, and the arrow keys then move the selection
  between nodes. Four keys, four directions:
</p>
<table>
  <tbody>
    <tr><td><kbd>↑</kbd></td><td>Jump to the <b>mother node</b>.</td></tr>
    <tr><td><kbd>↓</kbd></td><td>Jump to the <b>leftmost</b> daughter node.</td></tr>
    <tr><td><kbd>←</kbd></td><td>Jump to the <b>left sister node</b>.</td></tr>
    <tr><td><kbd>→</kbd></td><td>Jump to the <b>right sister node</b>.</td></tr>
  </tbody>
</table>
<p>
  When the node is already at the edge, <kbd>←</kbd> and <kbd>→</kbd> cross over to the same side under
  the mother's sister node, looking for the nearest <b>cousin node</b>. That scope matches
  <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> for moving left and right.
</p>

<h4 id="doc-level">2.4 Move down</h4>
<p class="tip">Move down adds a projection level to this node in one step.</p>
<p>Move down <b>adds one level</b> to the projection chain. Start with this tree:</p>
<img class="doc-shot" src="example/base.svg" alt="Before" />
<p>
  Now <b>select X</b> and press <kbd>Tab</kbd> (or click “Move down” on the toolbar).
</p>
<p>
  The projection chain X belongs to is <code>X</code> → <code>X'</code>, and it stops there because
  <code>XP</code> is not <code>X''</code>. So the top of the chain is <code>X'</code>.
  The editor wraps <b>the top of the chain</b> in a level of its own: it copies the whole subtree at the
  top, clears the top's daughter nodes and adds a prime to its label, then hangs the copy back underneath:
</p>
<img class="doc-shot" src="example/down.svg" alt="After moving X down" />
<p>
  Look at the two changes: the new <code>X''</code> has exactly one daughter node, the copy of
  <code>X'</code>; and <code>X'</code> is untouched, with <code>X</code> and <code>Y</code> still where
  they were — the subtree is simply one level deeper. In bracket notation that is
  <code>[XP [Z word1] [X'' [X' [X word2] [Y word3]]]]</code>.
</p>
<p>
  After moving down, the selection is the copy of the node you had selected — the selection box follows
  one level down. Pressing <kbd>Tab</kbd> repeatedly therefore walks the selection down level by level.
  The root node cannot be moved down, because the top of the chain must still have a mother node above it.
</p>

<h4 id="doc-up">2.5 Move up</h4>
<p class="tip">Move up removes one projection level in one step.</p>
<p>Move up is the inverse of move down, but its conditions are stricter. This time start from the result of moving down:</p>
<img class="doc-shot" src="example/down.svg" alt="Starting point: X has already been moved down one level" />
<p>
  Selecting <code>X</code> cannot be moved up. <code>X</code>'s mother node is <code>X'</code>, and
  <code>X'</code> has two daughter nodes, <code>X</code> and <code>Y</code>, so it does not satisfy
  “the mother node has only the selected node as its daughter”. The “Move up” button is disabled here.
</p>
<p>
  Selecting <code>X'</code> (the copy made by moving down) can be moved up. <code>X'</code>'s mother node is
  <code>X''</code>, and <code>X''</code> really does have only <code>X'</code> as its daughter node,
  while <code>X''</code>'s label is exactly <code>X'</code> plus one prime — both conditions hold at once.
  The editor then deletes <code>X''</code> and lets <code>X'</code> take its place:
</p>
<img class="doc-shot" src="example/base.svg" alt="After moving X' up: back to the original" />
<p>
  The result is exactly the original <code>[XP [Z word1] [X' [X word2] [Y word3]]]</code>, the tree from
  before the move down. Every level above the mother node loses one prime as well, as long as its label is
  exactly one prime more than the level below, so that the rule “level k has k primes” is never broken.
</p>
<p>Move up needs both conditions at once: the mother node has only the selected node as its daughter, and the mother's label is the selected node's name plus one prime.</p>

<h4 id="doc-forceup">2.6 Force up</h4>
<p class="tip">Force up removes one projection level regardless of the conditions.</p>
<p>
  Move up has strict conditions, so it is greyed out whenever you actually want to drop a level.
  Force up simply removes that level, at the price of <b>deleting the selected node's sister nodes
  together with their whole subtrees</b>.
</p>
<p>Using the same tree again, this time select <code>X'</code>:</p>
<img class="doc-shot" src="example/base.svg" alt="Starting point" />
<p>
  “Move up” is greyed out here, because <code>X'</code>'s mother node <code>XP</code> still has
  <code>Z</code> as well; “Force up” is not bound by that, so press
  <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>↑</kbd> (or just click the toolbar button). It does four things:
</p>
<table>
  <tbody>
    <tr><td>①</td><td>Delete every sister node of <code>X'</code> (here <code>Z</code>) and its subtree.</td></tr>
    <tr><td>②</td><td>Lift the daughter nodes of <code>X'</code> under the mother node <code>XP</code>, keeping their order.</td></tr>
    <tr><td>③</td><td>Rename the mother node <code>XP</code> to <code>X'</code>, moving subscript and superscript across too.</td></tr>
    <tr><td>④</td><td>Delete <code>X'</code> itself — it has no daughter nodes left by now.</td></tr>
  </tbody>
</table>
<img class="doc-shot" src="example/forceup.svg" alt="After forcing X' up: Z is gone and XP has been renamed to X'" />
<p>
  Two changes to look at: the mother node stays exactly where it was and only changes its name, and the
  two daughter nodes of <code>X'</code> come up under it unchanged, <code>X</code> before <code>Y</code>
  as before. Afterwards the selection is the <b>renamed mother node</b>, so the next button you press
  acts on it.
</p>
<p>
  The selected node may also have no daughter nodes at all; the result is then an empty category with
  its name. The only node that cannot be forced up is the root, which has no mother node to rename.
</p>

<h4 id="doc-move">2.7 Move left and right</h4>
<p class="tip">Move left and move right move a node among its sisters.</p>
<p>Both act on the selected node and are fully symmetric. Each direction has two cases.</p>
<table>
  <tbody>
    <tr>
      <td><b>Move left</b></td>
      <td>
        ① If the selected node has a left sister node, the editor swaps the two, so the node simply moves one place left.<br />
        ② If the selected node is the leftmost daughter node, the editor moves it under the mother node's
        left sister node, as that sister's rightmost daughter node.
      </td>
    </tr>
    <tr>
      <td><b>Move right</b></td>
      <td>
        ① If the selected node has a right sister node, the editor swaps the two, so the node simply moves one place right.<br />
        ② If the selected node is the rightmost daughter node, the editor moves it under the mother node's
        right sister node, as that sister's leftmost daughter node.
      </td>
    </tr>
  </tbody>
</table>
<p>Using the same tree again, here are three cases:</p>
<img class="doc-shot" src="example/base.svg" alt="Starting point" />

<p><b>Select <code>X'</code> and move left</b>: <code>X'</code> has a left sister node <code>Z</code>, so case ① applies and the two swap.</p>
<img class="doc-shot" src="example/left-xp.svg" alt="After moving X' left: X' and Z swapped" />

<p>
  <b>Select <code>X</code> and move left</b>: <code>X</code> has no left sister node
  (it is the leftmost daughter node of <code>X'</code>), so case ② applies and it moves under
  <code>Z</code>, the left sister node of its mother <code>X'</code>, becoming <code>Z</code>'s rightmost daughter node.
</p>
<img class="doc-shot" src="example/left-x.svg" alt="After moving X left: X moved under Z" />

<p><b>Select <code>X</code> and move right</b>: <code>X</code> has a right sister node <code>Y</code>, so case ① applies and the two swap.</p>
<img class="doc-shot" src="example/right-x.svg" alt="After moving X right: X and Y swapped" />

<p>
  All three results are in the picture. If there is no sister node on that side and the mother node has
  none on that side either, the toolbar button becomes disabled and the shortcut does nothing.
</p>

<h4 id="doc-style">2.8 Font and colour</h4>
<p class="tip">Adding a declaration line at the end changes a node label's italic, bold, strikethrough or colour.</p>
<p>
  In linguistics some words are conventionally italic (small <i>v</i>, <i>pro</i>, traces).
  <b>Add one declaration line of its own at the end</b>, listing node numbers in brackets, to change those
  nodes' label styles:
</p>
<pre class="code-block">Italic(1, 3)
Bold(2)
Strike(4)
Red(5)</pre>
<p>
  All five kinds of declaration look the same: <b>a colour name is itself a declaration word</b>, the
  brackets may list several numbers separated by commas in any order, and declaration words are
  <b>case-insensitive</b> (<code>ITALIC(1)</code> equals <code>italic(1)</code>), exported with initial
  capitals. There are nine colours: <code>Red</code>, <code>Yellow</code>, <code>Blue</code>,
  <code>Green</code>, <code>Orange</code>, <code>Magenta</code>, <code>Purple</code>,
  <code>Black</code>, <code>White</code>.
  A node has at most one colour: if several colour declarations hit it, the later one wins.
  For how the numbers are counted see <a href="#doc-arrow">1.6 Drawing an arrow</a>.
</p>
<p>
  With no colour declarations at all, words are drawn red and the other nodes blue. That default rendering has
  an equivalent <b>implicit baseline</b> in the notation: colour every node blue first, then every word red.
  It never appears in the text and only acts behind the scenes, so the text always shows exactly what you wrote.
  The buttons on the <b>“Colour” row</b> write those declarations for you, so the effect can be undone and the
  text edited by hand at any time: <b>Words red</b> drops the colour declaration on every word (they fall
  back to the default red) — and if all the other nodes were only blue, those declarations go as well,
  otherwise only the words are touched and every other colour is kept — <b>All blue</b> drops every colour
  declaration first and then leaves a single <code>Blue(all)</code> (one blue for the whole tree), and
  <b>Node red</b> / <b>Node blue</b> act on the selected node only — they add or remove that node's own
  declaration and never touch the others. On the same row <b>Node italic</b> and <b>Node strike</b> are
  toggles: pressing one applies that style to the selected node, pressing it again removes it. Bold has no
  button and can only be written as a declaration.
</p>
<p>
  Besides node numbers the brackets also accept two <b>keywords</b> (case-insensitive, mixable with numbers):
  <code>words</code> means every word in the sense of the note “only words are drawn red” below, and
  <code>all</code> means every node. Declarations take effect in the order they are written, so writing
  <code>Blue(words)</code> after the baseline's red means “paint the words blue as well” — the whole tree blue:
</p>
<pre class="code-block">Blue(words)
Red(all, 0)</pre>
<p>
  <code>Blue(words)</code> only touches words and leaves categories alone, whereas <code>Red(all, 0)</code>
  paints the whole tree red together with node 0 (<code>all</code> already covers node 0; the number is only
  there to show that the two can be mixed). On export the shorter form is chosen automatically: <code>all</code>
  when a whole tree shares one colour, <code>words</code> when a whole set of words does (plus the numbers of
  any same-coloured nodes that are not words), and a plain number list otherwise.
</p>
<p>
  The baseline red and blue are <b>the same values</b> the colour declarations use
  (<code>Red</code> = <code>#CC0000</code>, <code>Blue</code> = <code>#0000CC</code>), so writing
  <code>Blue(words)</code> by hand looks exactly like writing nothing at all and letting the baseline paint
  the words red — never two different blues in one tree. For any other colour just write the declaration,
  for instance <code>Green(all)</code>.
</p>
<p>
  Declarations can only go at the end, one per line. In rule notation they come after all edges and
  movement arrows; in bracket notation they come after the whole tree:
</p>
<pre class="code-block">[vP [v [V know]] [pro [N him]] [NP syntax]]
Italic(1, 2)
Strike(3)
Red(4)</pre>
<img class="doc-shot" src="example/style.svg" alt="v and pro are italic, NP is struck through, V is red" />
<p>
  In this tree <code>vP=0</code>, its three daughter nodes are <code>v=1</code>, <code>pro=2</code> and
  <code>NP=3</code>, and the daughter of <code>v</code> is <code>V=4</code>. So <code>v</code> and
  <code>pro</code> become italic, <code>NP</code> is struck through and <code>V</code> turns red.
</p>
<p>Numbers are recomputed as the structure changes, so adding or deleting nodes never leaves styles on the wrong node.</p>

<h3 id="doc-source">3. About the source code</h3>
<p>
  Typing source straight into the code box has exactly the same effect as editing graphically — the two
  sides always stay in sync. The two buttons above the code box switch between the two equivalent
  notations. Switching does not change the tree, only the way it is written.
</p>
<table>
  <tbody>
    <tr><td><b>Bracket</b></td><td>The notation common in linguistics. Compatible with jsSyntaxTree code.</td></tr>
    <tr><td><b>Rules</b></td><td>One edge per line. Recommended for drawing movement arrows and for making nodes italic.</td></tr>
  </tbody>
</table>

<h4 id="doc-bracket">3.1 Bracket notation</h4>
<p>This notation follows the labelled bracket notation common in linguistics.</p>
<table>
  <tbody>
    <tr><td><code>[S [NP Dogs][VP barks]]</code></td><td>Square brackets mark nodes; a bare label is a leaf node.</td></tr>
    <tr><td><code>[N_s Dogs]</code></td><td>Whatever follows <code>_</code> is written as a subscript.</td></tr>
    <tr><td><code>[N^s Cats]</code></td><td>Whatever follows <code>^</code> is written as a superscript.</td></tr>
    <tr><td><code>["Main clause" [S][V][O]]</code></td><td>When a label contains spaces, quotes, <code>_</code> or <code>^</code>, wrap the whole label in double quotes.</td></tr>
    <tr><td><code>[S NP VP]</code></td><td>Adjacent bare labels merge into <b>one</b> multi-word leaf node, which the editor draws as a triangle to stand for elided structure.</td></tr>
    <tr><td><code>[S [NP] [VP]]</code></td><td>This is two leaf nodes with one word each. It looks identical to the row above, but means something different.</td></tr>
    <tr><td><code>[A [B C][D E][F G -&gt;6]]</code></td><td>A movement arrow; the number is a node number. Less readable than rule notation.</td></tr>
    <tr><td><code>[X'' [X word]]</code></td><td>An empty node in brackets means “a category that is not expanded”. It is <b>not</b> a word, and <b>Words red</b> will not colour it.</td></tr>
  </tbody>
</table>

<h4 id="doc-rules">3.2 Rule notation</h4>
<p>One “mother node → daughter node” edge per line; good for checking edge by edge. Take this tree:</p>
<pre class="code-block">[XP [D w1] [X' [X w2] [Y w3]]]</pre>
<p>In rule notation it reads:</p>
<pre class="code-block">0 XP -&gt; D
0 XP -&gt; X'
1 D -&gt; w1
2 X' -&gt; X
2 X' -&gt; Y
4 X -&gt; w2
5 Y -&gt; w3</pre>
<p>Each line reads: <b>mother node number · mother node label · arrow · daughter node label</b>.</p>
<table>
  <tbody>
    <tr><td><b>The root</b></td><td>Its number is always 0.</td></tr>
    <tr><td><b>Other nodes</b></td><td>A node's number is the <b>line number</b> of the line where it first appears to the right of an arrow.</td></tr>
    <tr><td><b>Line numbers</b></td><td>Shown in the gutter to the left of the code box, not in the text, so copying a selection never brings them along. The gutter numbers every line, including blank lines and arrow lines.</td></tr>
    <tr><td><b>Reference order</b></td><td>A mother node must have appeared earlier, so its number is always smaller than the current line number. The lines of one mother need not be adjacent.</td></tr>
    <tr><td><b>Labels</b></td><td>Wrap in double quotes when a label contains spaces, quotes, <code>_</code> or <code>^</code>. Subscripts and superscripts follow the label, e.g. <code>NP_1</code>, <code>N^s</code>, <code>"the mailman"_1</code>.</td></tr>
    <tr><td><b>Wrong numbers</b></td><td>Inserting or deleting a line shifts the references below it; the editor repairs the leading numbers for you, so there is no need to count.</td></tr>
  </tbody>
</table>
<p>
  The numbers in that tree are <code>XP=0 D=1 X'=2 w1=3 X=4 Y=5 w2=6 w3=7</code>, that is 1 to 7 in the
  gutter on the left. So “move w3 to where w2 is” is a line of its own:
</p>
<pre class="code-block">7 --&gt; 6</pre>
<table>
  <tbody>
    <tr><td><b>Shape</b></td><td><code>fromNumber --&gt; toNumber</code>, after all the edges.</td></tr>
    <tr><td><b>Start</b></td><td>Must be a leaf node, because in this notation arrows hang off leaves.</td></tr>
    <tr><td><b>Target</b></td><td>Can be any node, including the root (written <code>--&gt; 0</code>).</td></tr>
    <tr><td><b>Numbering</b></td><td><b>The two notations differ</b>: bracket notation uses word ordinals (which word, from 1), rule notation uses node numbers (root 0, others the line number).</td></tr>
  </tbody>
</table>

<h3 id="doc-notes">4. Things to keep in mind</h3>
<ul>
  <li>
    <b>Only words are coloured red.</b> The test is whether the node is written as a bare label, that is
    whether it is the only daughter node of its mother or carries a movement arrow. An empty node in
    brackets means “a category that is not expanded” and is drawn blue like a non-leaf node.
    In <code>[XP [D [X'' [X word] [Y]]] [X']]</code>, for instance, only <code>word</code> is a word, while
    <code>Y</code> and <code>X'</code> are blue.
    Red words are only the default rendering and can be changed: on the <b>“Colour” row</b>, <b>All blue</b>
    colours every node blue, <b>Words red</b> colours the words red, and <b>Node red</b> / <b>Node blue</b>
    act on the selected node. You can also write the declarations by hand, for instance
    <code>Blue(words)</code> to paint the words blue as well (the whole tree blue), or
    <code>Blue(all)</code> to write a blue declaration on every node.
  </li>
  <li>
    <b>Adjacent bare labels become one multi-word leaf node.</b> So <code>[S NP VP]</code> means S has a
    single leaf node <code>"NP VP"</code>, not two leaf nodes NP and VP. To mean two leaf nodes, write
    <code>[S [NP] [VP]]</code>. The two look identical but mean different things.
  </li>
  <li>
    <b>A label cannot contain a double quote</b>, because the notation has no escape. The editor strips
    double quotes as you type.
  </li>
  <li>
    <b>Once a leaf node gets daughter nodes, its movement arrow is cleared</b>, because the notation cannot
    express “a non-leaf node carrying an arrow”.
  </li>
  <li>
    Bracket notation also accepts <code>--&gt;</code>, <code>&lt;-</code> and <code>&lt;&gt;</code> as
    movement-arrow input; the editor reads them, but always rewrites them as <code>-&gt;</code>.
  </li>
  <li>
    <b>Rule notation needs at least one edge.</b> A tree that is a single lone node (such as <code>[X]</code>)
    is empty in rule notation.
  </li>
  <li>
    <b>What you type in the code box may not match the export exactly</b> — spaces, arrow style, and rule
    notation line numbers, for instance. That is expected: the code box never rewrites text as you type,
    because that would break the caret. The one exception is the leading numbers in rule notation, which the
    editor repairs on its own.
  </li>
</ul>
`;
