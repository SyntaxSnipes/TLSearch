"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto] font-sans">
      <NavBar />
      <main className="flex flex-col items-center justify-center px-4">
        <SearchHero />
      </main>
      <Footer />
    </div>
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-50 w-full min-h-[72px] md:h-[93px] flex items-center border-[#444647] border-b bg-[#202124]/95 backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/0 via-cyan-300/60 to-cyan-400/0" />
      <nav className="flex h-14 w-full max-w-6xl mx-auto items-center justify-between px-4">
        <span className="flex flex-row items-center justify-start gap-2">
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

        <div className="hidden md:flex items-center gap-4 text-sm text-white/80">
          <span className="rounded-full border border-white/20 px-3 py-1">
            NASA Space Apps 2026
          </span>
          <span className="text-white/60">Space Biology Search</span>
        </div>
      </nav>
    </header>
  );
}

function SearchHero() {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("q")?.toString().trim();
    if (!query) return;
    router.push(`/search/${encodeURIComponent(query)}`);
  }

  return (
    <section className="flex w-full flex-col items-center justify-center py-10 sm:py-16">
      <div className="mb-8 flex flex-col items-center gap-3">
        <h1 className="text-center text-4xl sm:text-5xl font-semibold tracking-tight text-[#FFFEFE] leading-tight">
          Space Biology Engine
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/80 px-2">
          <span className="rounded-full border border-cyan-200/40 bg-cyan-300/10 px-3 py-1">600+ Publications</span>
          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">Semantic Ranking</span>
          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">Per-paper AI Summary</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex justify-center">
        <div
          className="group flex w-full max-w-[678px] items-center gap-2 
                        rounded-2xl sm:rounded-full bg-[#4d5156] px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm transition"
        >
          <input
            autoFocus
            type="text"
            name="q"
            placeholder="Search experiments, datasets, assays…"
            className="mx-1 sm:mx-2 w-full bg-transparent text-[15px] outline-none 
                       text-[#FFFEFE] placeholder:text-gray-400"
            aria-label="Search"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl sm:rounded-2xl bg-gray-500 px-3 sm:px-4 py-2 text-sm text-white transition hover:bg-gray-50 hover:text-black hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]"
          >
            Search
          </button>
        </div>
      </form>

      <p className="mt-4 text-xs text-gray-500">
        Tip: press <kbd className="rounded border bg-gray-50 px-1">Enter</kbd>{" "}
        to search
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="w-full border-t border-[#444647] bg-[#171616]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-gray-500 sm:flex-row">
        <span className="text-center sm:text-left">United Arab Emirates</span>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-center">
          <a
            className="hover:underline"
            href="https://www.spaceappschallenge.org/"
            target="_blank"
            rel="noreferrer"
          >
            NASA Space Apps
          </a>
          <span>•</span>
          <span>
            2025 TerraLumen Space Biology Engine
          </span>
        </div>
      </div>
    </footer>
  );
}
