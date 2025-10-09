/* eslint-disable @typescript-eslint/no-explicit-any */
// sbe/src/app/api/papers/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";

const API_ORIGIN = process.env.API_ORIGIN || "http://127.0.0.1:8000";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const target = new URL("/papers", API_ORIGIN);

  u.searchParams.forEach((v, k) => target.searchParams.set(k, v));

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
  } catch (e: any) {
    return NextResponse.json(
      { error: "Backend unavailable", detail: e.message },
      { status: 502 }
    );
  }
}
