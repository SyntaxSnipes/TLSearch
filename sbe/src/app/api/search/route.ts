import { NextResponse } from "next/server";

// Toggle between mock and proxy easily
const USE_BACKEND = process.env.USE_BACKEND === "1";

function getApiOrigin() {
  const configured = process.env.API_ORIGIN?.trim();
  // Guard against misconfiguration that points back to Next.js itself.
  if (
    configured?.includes("localhost:3000") ||
    configured?.includes("127.0.0.1:3000")
  ) {
    return "http://127.0.0.1:8000";
  }
  return configured || "http://127.0.0.1:8000";
}

type SearchItem = {
  id: string;
  name: string;
  type: "experiment" | "dataset" | "assay";
};

const MOCK: SearchItem[] = [
  { id: "exp-1", name: "Microgravity Growth", type: "experiment" },
  { id: "exp-2", name: "Radiation Response", type: "experiment" },
  { id: "ds-1",  name: "Arabidopsis RNA-seq", type: "dataset" },
  { id: "as-1",  name: "Yeast DNA Repair Assay", type: "assay" },
];

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  if (!USE_BACKEND) {
    const results = q ? MOCK.filter(x => x.name.toLowerCase().includes(q)) : [];
    return NextResponse.json({ results });
  }

  // Proxy to FastAPI when ready
  try {
    const target = new URL("/search", getApiOrigin());
    searchParams.forEach((v, k) => target.searchParams.set(k, v));

    const resp = await fetch(target.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const body = await resp.text();
    return new NextResponse(body || "{}", {
      status: resp.status,
      headers: { "content-type": resp.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Backend unavailable", detail: (err as Error).message },
      { status: 502 }
    );
  }
}
