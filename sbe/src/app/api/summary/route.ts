import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

export async function GET(req: Request) {
  const u = new URL(req.url);
  const link = u.searchParams.get("link")?.trim();
  const title = u.searchParams.get("title")?.trim();

  if (!link) {
    return NextResponse.json(
      { error: "Missing required query parameter: link" },
      { status: 400 }
    );
  }

  const target = new URL("/summary", getApiOrigin());
  target.searchParams.set("link", link);
  if (title) target.searchParams.set("title", title);

  try {
    const resp = await fetch(target.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const body = await resp.text();
    return new NextResponse(body || "{}", {
      status: resp.status,
      headers: {
        "content-type": resp.headers.get("content-type") || "application/json",
      },
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: "Backend unavailable", detail },
      { status: 502 }
    );
  }
}
