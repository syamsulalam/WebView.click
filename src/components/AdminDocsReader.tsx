import { type ReactNode, useEffect, useMemo, useState } from "react";
import { BookOpen, FileText, Search, X } from "lucide-react";
import HoverTooltip from "./HoverTooltip";
import { adminDocs, adminDocsForPath } from "../lib/adminDocs";

type AdminDocsReaderProps = {
  pathname: string;
  defaultDocId?: string;
  tooltip?: string;
  buttonClassName?: string;
  iconSize?: number;
};

function inlineMarkdown(text: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={`${match.index}-code`} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a key={`${match.index}-link`} href={linkMatch[2]} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
            {linkMatch[1]}
          </a>,
        );
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length ? nodes : text;
}

function MarkdownRenderer({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const rendered: ReactNode[] = [];
    let codeLines: string[] = [];
    let inCode = false;
    let listItems: string[] = [];
    let listType: "ul" | "ol" = "ul";

    const flushList = () => {
      if (!listItems.length) return;
      const ListTag = listType;
      rendered.push(
        <ListTag key={`list-${rendered.length}`} className={`my-4 space-y-1 pl-6 text-sm leading-7 text-slate-700 ${listType === "ol" ? "list-decimal" : "list-disc"}`}>
          {listItems.map((item, index) => <li key={index}>{inlineMarkdown(item)}</li>)}
        </ListTag>,
      );
      listItems = [];
    };

    const flushCode = () => {
      rendered.push(
        <pre key={`code-${rendered.length}`} className="my-4 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      codeLines = [];
    };

    lines.forEach((line) => {
      if (line.startsWith("```")) {
        if (inCode) flushCode();
        else flushList();
        inCode = !inCode;
        return;
      }
      if (inCode) {
        codeLines.push(line);
        return;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        return;
      }
      if (trimmed === "---") {
        flushList();
        rendered.push(<hr key={`hr-${rendered.length}`} className="my-6 border-slate-200" />);
        return;
      }
      const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushList();
        const level = heading[1].length;
        const text = heading[2];
        const className = level === 1
          ? "mt-1 mb-5 text-2xl font-semibold text-slate-950"
          : level === 2
            ? "mt-8 mb-3 text-xl font-semibold text-slate-950"
            : level === 3
              ? "mt-6 mb-2 text-base font-semibold text-slate-900"
              : "mt-5 mb-2 text-sm font-semibold uppercase text-slate-600";
        if (level === 1) rendered.push(<h1 key={`h-${rendered.length}`} className={className}>{inlineMarkdown(text)}</h1>);
        else if (level === 2) rendered.push(<h2 key={`h-${rendered.length}`} className={className}>{inlineMarkdown(text)}</h2>);
        else if (level === 3) rendered.push(<h3 key={`h-${rendered.length}`} className={className}>{inlineMarkdown(text)}</h3>);
        else rendered.push(<h4 key={`h-${rendered.length}`} className={className}>{inlineMarkdown(text)}</h4>);
        return;
      }
      const list = trimmed.match(/^[-*]\s+(.+)$/);
      if (list) {
        if (listItems.length && listType !== "ul") flushList();
        listType = "ul";
        listItems.push(list[1]);
        return;
      }
      const orderedList = trimmed.match(/^\d+\.\s+(.+)$/);
      if (orderedList) {
        if (listItems.length && listType !== "ol") flushList();
        listType = "ol";
        listItems.push(orderedList[1]);
        return;
      }
      if (trimmed.startsWith(">")) {
        flushList();
        rendered.push(
          <blockquote key={`quote-${rendered.length}`} className="my-4 border-l-4 border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-7 text-indigo-950">
            {inlineMarkdown(trimmed.replace(/^>\s?/, ""))}
          </blockquote>,
        );
        return;
      }
      if (trimmed.includes("|") && trimmed.startsWith("|")) {
        flushList();
        rendered.push(
          <pre key={`table-${rendered.length}`} className="my-4 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-700">
            {line}
          </pre>,
        );
        return;
      }
      flushList();
      rendered.push(
        <p key={`p-${rendered.length}`} className="my-3 text-sm leading-7 text-slate-700">
          {inlineMarkdown(trimmed)}
        </p>,
      );
    });

    flushList();
    if (inCode || codeLines.length) flushCode();
    return rendered;
  }, [content]);

  return <div>{blocks}</div>;
}

export default function AdminDocsReader({
  pathname,
  defaultDocId = "",
  tooltip = "Read docs for the current admin page. Opens a markdown reader without leaving /admin.",
  buttonClassName = "group relative flex h-12 w-12 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700",
  iconSize = 24,
}: AdminDocsReaderProps) {
  const pageDocs = adminDocsForPath(pathname);
  const currentPageDefaultId = defaultDocId || pageDocs[0]?.id || adminDocs[0]?.id || "";
  const [open, setOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(currentPageDefaultId);
  const [query, setQuery] = useState("");
  const [contentCache, setContentCache] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState("");

  const selectedDoc = adminDocs.find((doc) => doc.id === selectedDocId) || pageDocs[0] || adminDocs[0];
  const selectedContent = selectedDoc ? contentCache[selectedDoc.id] || "" : "";
  const filteredDocs = adminDocs.filter((doc) => {
    const haystack = `${doc.title} ${doc.file} ${doc.category} ${doc.summary}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  useEffect(() => {
    if (!open || !selectedDoc) return;
    if (contentCache[selectedDoc.id]) {
      setLoadingContent(false);
      setContentError("");
      return;
    }
    let cancelled = false;
    setLoadingContent(true);
    setContentError("");
    selectedDoc.loadContent()
      .then((content) => {
        if (cancelled) return;
        setContentCache((current) => ({ ...current, [selectedDoc.id]: content }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setContentError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedDoc, contentCache]);

  const openReader = () => {
    if (currentPageDefaultId) setSelectedDocId(currentPageDefaultId);
    setOpen(true);
  };

  return (
    <>
      <HoverTooltip text={tooltip} widthClass="w-64">
        <button
          type="button"
          onClick={openReader}
          className={buttonClassName}
          aria-label="Read admin docs"
        >
          <BookOpen size={iconSize} />
        </button>
      </HoverTooltip>

      {open && selectedDoc && (
        <div className="fixed inset-0 z-[100000] flex bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Admin documentation reader">
          <div className="mx-auto flex h-full w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <aside className="hidden w-80 shrink-0 border-r border-slate-200 bg-slate-50 md:flex md:flex-col">
              <div className="border-b border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">Admin docs</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Suggested docs change based on the admin page you are viewing.</p>
                <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search docs"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-3">
                {!query && pageDocs.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 px-2 text-[11px] font-semibold uppercase text-slate-500">Relevant here</p>
                    <div className="space-y-2">
                      {pageDocs.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => setSelectedDocId(doc.id)}
                          className={`w-full rounded-xl border p-3 text-left transition ${selectedDoc.id === doc.id ? "border-indigo-200 bg-white shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-white"}`}
                        >
                          <span className="flex items-start gap-2">
                            <FileText size={15} className="mt-0.5 shrink-0 text-indigo-600" />
                            <span>
                              <span className="block text-sm font-semibold text-slate-950">{doc.title}</span>
                              <span className="mt-1 block text-xs leading-relaxed text-slate-500">{doc.summary}</span>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mb-2 px-2 text-[11px] font-semibold uppercase text-slate-500">{query ? "Search results" : "All docs"}</p>
                <div className="space-y-2">
                  {filteredDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${selectedDoc.id === doc.id ? "border-indigo-200 bg-white shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-white"}`}
                    >
                      <span className="block text-sm font-semibold text-slate-950">{doc.title}</span>
                      <span className="mt-1 block text-[11px] font-medium text-slate-400">{doc.file}</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">{selectedDoc.category}</span>
                    <span className="truncate text-xs font-medium text-slate-400">{selectedDoc.file}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-950">{selectedDoc.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedDoc.summary}</p>
                </div>
                <HoverTooltip text="Close documentation reader">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Close documentation reader"
                  >
                    <X size={18} />
                  </button>
                </HoverTooltip>
              </div>

              <div className="border-b border-slate-200 bg-slate-50 p-3 md:hidden">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                  <Search size={15} />
                  <select
                    value={selectedDoc.id}
                    onChange={(event) => setSelectedDocId(event.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                    aria-label="Select documentation file"
                  >
                    {filteredDocs.map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
                  </select>
                </label>
              </div>

              <article className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-8">
                {loadingContent && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Loading documentation...
                  </div>
                )}
                {contentError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    Documentation could not load: {contentError}
                  </div>
                )}
                {!loadingContent && !contentError && selectedContent && <MarkdownRenderer content={selectedContent} />}
              </article>
            </main>
          </div>
        </div>
      )}
    </>
  );
}
