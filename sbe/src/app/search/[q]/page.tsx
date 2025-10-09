/* eslint-disable @typescript-eslint/no-explicit-any */
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

const PAGE_SIZE = 10;

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
        const res = await fetch(
          `http://127.0.0.1:8000/papers?${qs.toString()}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(String(res.status));

        const text = await res.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }

        // Normalize to array
        let list: any[] = [];
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data?.results)) list = data.results;
        else if (Array.isArray(data?.data)) list = data.data;
        else if (Array.isArray(data?.items)) list = data.items;
        else if (Array.isArray(data?.papers)) list = data.papers;
        else if (Array.isArray(data?.result)) list = data.result;

        const mapped: SearchItem[] = list.map((x: any, i: number) => ({
          title: x.title ?? x.name ?? x.paper_title ?? "Untitled",
          url: x.url ?? x.link ?? x.pdf ?? "#",
          contentPara1: x.contentPara1 ?? x.abstract ?? x.summary ?? "",
          paperID: x.paperID ?? x.id ?? x._id ?? i,
        }));

        if (!cancelled) setResults(mapped);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Fetch failed");
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
      <nav className="flex flex-row py-4 bg-[#202124] gap-5 border-[#444647] border-b">
        <span className="flex flex-row items-center justify-start gap-2 ml-9 mr-4">
          <Link href={"/"}>
            <Image
              src="/logos/TLsearch.svg"
              alt="Logo"
              width={100}
              height={50}
            />
          </Link>
        </span>
        <form onSubmit={handleSubmit} className="flex justify-center">
          <div className="group flex w-[678px] max-w-full items-center gap-2 rounded-full bg-[#4d5156] px-4 py-3 m-0 shadow-sm transition">
            <input
              autoFocus
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search experiments, datasets, assays…"
              className="mx-2 w-full bg-transparent text-[15px] outline-none text-[#FFFEFE] placeholder:text-gray-400"
              aria-label="Search"
            />
            <button
              type="submit"
              className="rounded-2xl bg-gray-500 px-4 py-2 text-sm transition hover:bg-gray-50"
            >
              Search
            </button>
          </div>
        </form>
      </nav>

      <div className="p-6 text-[#FFFEFE] min-h-dvh">
        <h1 className="mb-2 text-2xl">
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
                    className="opacity-90 text-xl"
                  >
                    <Link
                      href={item.url}
                      className="text-blue-300 hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.contentPara1 && (
                      <span className="ml-2 text-xs opacity-60 text-white">
                        ({item.contentPara1})
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <li className="opacity-60">No results</li>
              )}
            </ul>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href={clampedPage > 1 ? `?p=${clampedPage - 1}` : "#"}
                        aria-disabled={clampedPage === 1}
                        className={
                          clampedPage === 1
                            ? "pointer-events-none opacity-50"
                            : ""
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
                            : ""
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
