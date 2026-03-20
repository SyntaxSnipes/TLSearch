"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { Spinner } from "@/components/ui/spinner";

type SearchItem = {
  title: string;
  url: string;
  contentPara1: string;
  paperID: number;
};

type SearchApiItem = {
  title?: string;
  name?: string;
  paper_title?: string;
  url?: string;
  link?: string;
  pdf?: string;
  contentPara1?: string;
  abstract?: string;
  summary?: string;
  paperID?: number;
  id?: number;
  _id?: number;
};

type SummaryApiResponse = {
  summary?: string;
  source?: string;
  detail?: string;
  error?: string;
};

type SummaryState = {
  loading: boolean;
  text?: string;
  error?: string;
  source?: string;
};

const PAGE_SIZE = 10;

function toErrorMessage(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

function normalizeResults(data: unknown): SearchApiItem[] {
  if (Array.isArray(data)) return data as SearchApiItem[];
  if (typeof data !== "object" || data === null) return [];

  const obj = data as Record<string, unknown>;
  const candidates = [
    obj.results,
    obj.data,
    obj.items,
    obj.papers,
    obj.result,
  ];

  const found = candidates.find((candidate) => Array.isArray(candidate));
  return (found as SearchApiItem[] | undefined) ?? [];
}

export default function SearchResults({
  params,
}: {
  params: Promise<{ q: string }>;
}) {
  const { q: qParam } = use(params);
  const initialQ = decodeURIComponent(qParam);

  const router = useRouter();
  const sp = useSearchParams();

  // state
  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // page state from URL (?p=)
  const pFromUrl = Number(sp.get("p") ?? "1");
  const [page, setPage] = useState<number>(
    Number.isFinite(pFromUrl) && pFromUrl > 0 ? pFromUrl : 1
  );

  // when q changes (new search), reset page to 1
  useEffect(() => {
    setPage(1);
  }, [q]);

  // fetch results for q
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ searchQuery: q, searchNum: "100" });
        const res = await fetch(`/api/papers?${qs.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));

        const text = await res.text();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }

        const list = normalizeResults(data);

        const mapped: SearchItem[] = list.map((x, i: number) => ({
          title: x.title ?? x.name ?? x.paper_title ?? "Untitled",
          url: x.url ?? x.link ?? x.pdf ?? "#",
          contentPara1: x.contentPara1 ?? x.abstract ?? x.summary ?? "",
          paperID: x.paperID ?? x.id ?? x._id ?? i,
        }));

        if (!cancelled) {
          setResults(mapped);
          setSummaries({});
        }
      } catch (e: unknown) {
        if (!cancelled) setError(toErrorMessage(e, "Fetch failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  // derived pagination
  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (clampedPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageItems = results.slice(startIdx, endIdx);

  // keep URL in sync with current page (?p=)
  useEffect(() => {
    // keep q in the path, p in the query
    const base = `/search/${encodeURIComponent(q)}`;
    const href = clampedPage > 1 ? `${base}?p=${clampedPage}` : base;
    router.replace(href, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedPage, q]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("q")?.toString().trim();
    if (!query) return;
    router.push(`/search/${encodeURIComponent(query)}`);
    setQ(query);
  };

  // pagination click helpers
  const gotoPage = (p: number) => setPage(Math.min(Math.max(p, 1), totalPages));
  const prevPage = () => gotoPage(clampedPage - 1);
  const nextPage = () => gotoPage(clampedPage + 1);

  const getSummaryKey = (item: SearchItem) =>
    `${item.paperID ?? "unknown"}:${item.url ?? "missing-url"}`;

  const fetchSummary = async (item: SearchItem) => {
    const key = getSummaryKey(item);
    const existing = summaries[key];

    if (existing?.loading || existing?.text) {
      return;
    }

    setSummaries((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), loading: true, error: undefined },
    }));

    try {
      const qs = new URLSearchParams({ link: item.url, title: item.title });
      const res = await fetch(`/api/summary?${qs.toString()}`, {
        cache: "no-store",
      });

      const payload = (await res.json()) as SummaryApiResponse;
      if (!res.ok) {
        throw new Error(payload?.detail || payload?.error || "Summary failed");
      }

      setSummaries((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          text: payload?.summary || "No summary available.",
          source: payload?.source,
        },
      }));
    } catch (e: unknown) {
      setSummaries((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: toErrorMessage(e, "Could not generate summary"),
        },
      }));
    }
  };

  // build a small page list (1, current-1, current, current+1, last) with ellipsis
  const pagesToShow = (() => {
    const set = new Set<number>([
      1,
      clampedPage - 1,
      clampedPage,
      clampedPage + 1,
      totalPages,
    ]);
    return [...set]
      .filter((n) => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);
  })();

  return (
    <>
      <nav className="relative flex flex-wrap py-3 sm:py-4 bg-[#202124]/95 gap-3 sm:gap-5 border-[#444647] border-b items-center px-3 sm:px-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/0 via-cyan-300/60 to-cyan-400/0" />
        <span className="flex flex-row items-center justify-start gap-2 sm:ml-9 sm:mr-4">
          <Link href={"/"}>
            <Image
              src="/logos/TLsearch.svg"
              alt="Logo"
              width={94}
              height={44}
              className="h-auto w-[88px] sm:w-[94px]"
            />
          </Link>
        </span>
        <form onSubmit={handleSubmit} className="flex justify-center w-full sm:w-auto sm:flex-1 sm:max-w-[720px]">
          <div className="group flex w-full items-center gap-2 rounded-2xl sm:rounded-full bg-[#4d5156] px-3 sm:px-4 py-2.5 sm:py-3 m-0 shadow-sm transition">
            <input
              autoFocus
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search experiments, datasets, assays…"
              className="mx-1 sm:mx-2 w-full bg-transparent text-[15px] outline-none text-[#FFFEFE] placeholder:text-gray-400"
              aria-label="Search"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl sm:rounded-2xl bg-gray-500 px-3 sm:px-4 py-2 text-sm text-white transition hover:bg-gray-50 hover:text-black"
            >
              Search
            </button>
          </div>
        </form>

        <div className="ml-auto mr-8 hidden lg:flex items-center gap-3 text-xs text-white/80">
          <span className="rounded-full border border-white/25 px-3 py-1">AI Summary Enabled</span>
          {!loading && !error && (
            <span className="text-white/65">{total} results</span>
          )}
        </div>
      </nav>

      <div className="p-4 sm:p-6 text-[#FFFEFE] min-h-dvh">
        <h1 className="mb-2 text-xl sm:text-2xl break-words">
          Results for <span className="opacity-90">“{q}”</span>
        </h1>
        {!loading && !error && (
          <p className="mb-6 text-sm opacity-70">
            Showing{" "}
            <span className="font-medium">{total ? startIdx + 1 : 0}</span>–
            <span className="font-medium">{endIdx}</span> of{" "}
            <span className="font-medium">{total}</span>
          </p>
        )}

        {loading && (
          <div className="w-dvw h-dvh fixed top-0 left-0 bg-black/80 flex flex-col m-auto items-center justify-center">
            <Spinner />
            <div className="opacity-60">Loading…</div>
          </div>
        )}
        {error && <div className="text-red-400">Search failed ({error})</div>}

        {!loading && !error && (
          <>
            <ul className="space-y-2 flex flex-col gap-5">
              {pageItems.length ? (
                pageItems.map((item, idx) => (
                  <li
                    key={item.paperID ?? `${startIdx}-${idx}`}
                    className="opacity-90 text-base sm:text-xl rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_10px_30px_rgba(34,211,238,0.18)]"
                  >
                    {(() => {
                      const summaryState = summaries[getSummaryKey(item)];
                      const summaryLocked = Boolean(summaryState?.text);

                      return (
                        <>
                    <Link
                      href={item.url}
                      className="text-blue-300 hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.contentPara1 && (
                      <p className="mt-2 text-sm opacity-80 text-white leading-relaxed">
                        {item.contentPara1}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => fetchSummary(item)}
                        disabled={summaryState?.loading || summaryLocked}
                        className="rounded-lg border border-white/25 px-3 py-2 text-sm text-white hover:bg-white/10 hover:text-white transition disabled:pointer-events-none disabled:opacity-60"
                      >
                        {summaryState?.loading
                          ? "Generating summary..."
                          : summaryLocked
                            ? "Summary generated"
                            : "AI Summary"}
                      </button>

                      {summaryState?.source && (
                        <span className="text-xs opacity-60">
                          {summaryState?.source === "openai"
                            ? "AI generated"
                            : "Fallback summary"}
                        </span>
                      )}
                    </div>

                    {summaryState?.error && (
                      <p className="mt-2 text-sm text-red-300">
                        {summaryState?.error}
                      </p>
                    )}

                    {summaryState?.text && (
                      <pre className="mt-3 whitespace-pre-wrap break-words text-sm bg-black/35 rounded-md p-3 border border-white/10">
                        {summaryState?.text}
                      </pre>
                    )}
                        </>
                      );
                    })()}
                  </li>
                ))
              ) : (
                <li className="opacity-60">No results</li>
              )}
            </ul>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="mt-8 overflow-x-auto pb-1">
                <Pagination className="justify-start sm:justify-center min-w-max">
                  <PaginationContent className="min-w-max">
                    <PaginationItem>
                      <PaginationPrevious
                        href={clampedPage > 1 ? `?p=${clampedPage - 1}` : "#"}
                        aria-disabled={clampedPage === 1}
                        className={
                          clampedPage === 1
                            ? "pointer-events-none opacity-50"
                            : "text-white hover:text-black hover:bg-white"
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          if (clampedPage > 1) prevPage();
                        }}
                      />
                    </PaginationItem>

                    {/* Pages with ellipsis */}
                    {pagesToShow.map((p, i) => {
                      const prev = pagesToShow[i - 1];
                      const showEllipsis = i > 0 && p - (prev ?? 0) > 1;
                      return (
                        <span key={p} className="flex">
                          {showEllipsis && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href={p === 1 ? "" : `?p=${p}`}
                              isActive={p === clampedPage}
                              className="text-white hover:text-black hover:bg-white"
                              onClick={(e) => {
                                e.preventDefault();
                                gotoPage(p);
                              }}
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        </span>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href={
                          clampedPage < totalPages
                            ? `?p=${clampedPage + 1}`
                            : "#"
                        }
                        aria-disabled={clampedPage === totalPages}
                        className={
                          clampedPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "text-white hover:text-black hover:bg-white"
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          if (clampedPage < totalPages) nextPage();
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
