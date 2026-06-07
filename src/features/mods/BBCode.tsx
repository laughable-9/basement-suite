// Minimal BBCode renderer for Steam Workshop mod descriptions. Handles the
// tag set we actually see on Isaac mods: [b] [i] [u] [url=...] [img] [list]
// [*] [h1]. Everything else (including unknown attributes) is dropped
// without breaking the surrounding render.
//
// Remote images render as real <img> with caps (max-height 180px, lazy,
// hidden on error). Tauri's CSP is null in this app so imgur / Workshop
// CDN URLs load without extra config.

import type { JSX, ReactNode } from "react";

interface OpenTag {
  type: "open";
  tag: string;
  value: string | null;
}
interface CloseTag {
  type: "close";
  tag: string;
}
interface TextTok {
  type: "text";
  text: string;
}
type Token = OpenTag | CloseTag | TextTok;

const TAG_RE = /\[(\/?)([a-zA-Z*][a-zA-Z0-9]*)(?:=([^\]]*))?\]/g;

function tokenize(input: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(input)) !== null) {
    if (m.index > i) out.push({ type: "text", text: input.slice(i, m.index) });
    const [, slash, name, value] = m;
    const tag = name.toLowerCase();
    if (slash === "/") out.push({ type: "close", tag });
    else out.push({ type: "open", tag, value: value ?? null });
    i = m.index + m[0].length;
  }
  if (i < input.length) out.push({ type: "text", text: input.slice(i) });
  return out;
}

interface Node {
  tag: string;
  value: string | null;
  children: (Node | string)[];
}

function parse(tokens: Token[]): Node {
  const root: Node = { tag: "root", value: null, children: [] };
  const stack: Node[] = [root];
  for (const tok of tokens) {
    const top = stack[stack.length - 1];
    if (tok.type === "text") {
      top.children.push(tok.text);
    } else if (tok.type === "open") {
      const node: Node = { tag: tok.tag, value: tok.value, children: [] };
      top.children.push(node);
      stack.push(node);
    } else {
      // Close: pop until matching tag (auto-close stray opens like [*]).
      const idx = stack.findIndex((n) => n.tag === tok.tag);
      if (idx > 0) stack.splice(idx);
    }
  }
  return root;
}

function renderChildren(
  children: (Node | string)[],
  keyPrefix: string,
): ReactNode {
  return children.map((c, i) =>
    typeof c === "string" ? (
      <span key={`${keyPrefix}-${i}`}>{c}</span>
    ) : (
      renderNode(c, `${keyPrefix}-${i}`)
    ),
  );
}

function renderNode(node: Node, key: string): ReactNode {
  const k = key;
  switch (node.tag) {
    case "b":
      return <strong key={k}>{renderChildren(node.children, k)}</strong>;
    case "i":
      return <em key={k}>{renderChildren(node.children, k)}</em>;
    case "u":
      return (
        <span key={k} style={{ textDecoration: "underline" }}>
          {renderChildren(node.children, k)}
        </span>
      );
    case "h1":
    case "h2":
      return <h3 key={k}>{renderChildren(node.children, k)}</h3>;
    case "url": {
      // [url=...]label[/url] or [url]href[/url]
      const inner = node.children;
      const labelText = inner
        .map((c) => (typeof c === "string" ? c : ""))
        .join("");
      const href = node.value ?? labelText;
      return (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer">
          {inner.length === 0 || (inner.length === 1 && typeof inner[0] === "string" && !inner[0].trim())
            ? href
            : renderChildren(inner, k)}
        </a>
      );
    }
    case "img": {
      // [img]src[/img] — render the actual remote image. Tauri's CSP is
      // null so img-src ≈ *; we still hide broken loads and cap the size
      // so a banner image can't dominate the description column.
      const url = node.children
        .map((c) => (typeof c === "string" ? c : ""))
        .join("")
        .trim();
      if (!/^https?:\/\//i.test(url)) return null;
      return (
        <img
          key={k}
          src={url}
          alt=""
          loading="lazy"
          className="bbcode-image"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Failed loads (404, blocked) shouldn't leave a broken-image
            // icon — drop the element instead.
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      );
    }
    case "list":
      return <ul key={k} className="bbcode-list">{splitListItems(node.children, k)}</ul>;
    case "*":
      // Bare [*] outside a [list] — render as a bullet line.
      return <li key={k}>{renderChildren(node.children, k)}</li>;
    default:
      // Unknown tag: pass children through unstyled.
      return <span key={k}>{renderChildren(node.children, k)}</span>;
  }
}

/** Convert a [list]'s alternating "[*] text [*] text" children into <li>s. */
function splitListItems(
  children: (Node | string)[],
  keyPrefix: string,
): JSX.Element[] {
  const items: JSX.Element[] = [];
  let current: (Node | string)[] = [];
  let i = 0;
  const flush = () => {
    if (current.length === 0) return;
    items.push(
      <li key={`${keyPrefix}-li-${items.length}`}>
        {renderChildren(current, `${keyPrefix}-li-${items.length}`)}
      </li>,
    );
    current = [];
  };
  for (const c of children) {
    if (typeof c !== "string" && c.tag === "*") {
      flush();
      current = c.children;
    } else {
      current.push(c);
    }
    i++;
  }
  flush();
  return items;
}

export function BBCode({ text }: { text: string }) {
  // Trim BBCode `\r` / leading whitespace and collapse blank lines so the
  // rendered output looks like a real description not a transcript.
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  const root = parse(tokenize(cleaned));
  return <div className="bbcode">{renderChildren(root.children, "n")}</div>;
}
