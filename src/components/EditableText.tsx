import { type CSSProperties, type ClipboardEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";

type EditableTextProps = {
  as?: EditableTextTag;
  storageKey: string;
  children: string | number | null | undefined;
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
  enabled?: boolean;
};

export type EditableTextTag = "span" | "p" | "h1" | "h2" | "h3" | "h4" | "div" | "li";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainTextToHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export default function EditableText({
  as = "span",
  storageKey,
  children,
  className = "",
  style,
  multiline = false,
  enabled = false,
}: EditableTextProps) {
  const Tag = as as any;
  const isBlockTag = ["div", "p", "h1", "h2", "h3", "h4", "li"].includes(String(as));
  const Wrapper = isBlockTag ? "div" : "span";
  const ref = useRef<HTMLElement | null>(null);
  const initialHtml = useMemo(() => plainTextToHtml(String(children ?? "")), [children]);
  const [html, setHtml] = useState(initialHtml);
  const [active, setActive] = useState(false);
  const localStorageKey = `webview.inlineText.${storageKey}`;

  useEffect(() => {
    const saved = window.localStorage.getItem(localStorageKey);
    setHtml(saved || initialHtml);
  }, [initialHtml, localStorageKey]);

  const saveCurrent = () => {
    const next = ref.current?.innerHTML || "";
    setHtml(next);
    window.localStorage.setItem(localStorageKey, next);
  };

  const applyCommand = (event: MouseEvent<HTMLButtonElement>, command: "bold" | "italic" | "underline") => {
    event.preventDefault();
    ref.current?.focus();
    document.execCommand(command);
    saveCurrent();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      ref.current?.blur();
    }
  };

  return (
    <Wrapper className={`relative max-w-full align-baseline ${isBlockTag ? "block" : "inline-block"}`}>
      <Tag
        ref={ref}
        contentEditable={enabled}
        suppressContentEditableWarning={enabled}
        spellCheck={enabled}
        data-wv-editable={enabled ? "true" : undefined}
        data-wv-edit-key={enabled ? storageKey : undefined}
        className={`${className} ${enabled ? "cursor-text rounded outline-none transition hover:ring-2 hover:ring-indigo-200 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" : "select-text"}`}
        style={style}
        onFocus={enabled ? () => setActive(true) : undefined}
        onBlur={enabled ? () => {
          saveCurrent();
          window.setTimeout(() => setActive(false), 120);
        } : undefined}
        onInput={enabled ? saveCurrent : undefined}
        onKeyDown={enabled ? handleKeyDown : undefined}
        onPaste={enabled ? (event: ClipboardEvent<HTMLElement>) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          saveCurrent();
        } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {enabled && active && (
        <span
          data-export-remove="true"
          data-wv-format-toolbar="true"
          className="hide-in-export absolute -top-10 left-0 z-[220] inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xl"
          onMouseDown={(event) => event.preventDefault()}
        >
          <button type="button" data-wv-format-command="bold" onMouseDown={(event) => applyCommand(event, "bold")} className="px-2.5 py-1.5 hover:bg-slate-50">B</button>
          <button type="button" data-wv-format-command="italic" onMouseDown={(event) => applyCommand(event, "italic")} className="px-2.5 py-1.5 hover:bg-slate-50">I</button>
          <button type="button" data-wv-format-command="underline" onMouseDown={(event) => applyCommand(event, "underline")} className="px-2.5 py-1.5 hover:bg-slate-50">U</button>
        </span>
      )}
    </Wrapper>
  );
}
