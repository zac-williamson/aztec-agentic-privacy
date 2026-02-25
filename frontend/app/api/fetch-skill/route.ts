/**
 * Server-side proxy for fetching skill files.
 *
 * Allows the Trust Browser to compute a skill hash from a URL without hitting
 * CORS restrictions in the browser. The server fetches the raw file and returns
 * its bytes directly to the client, which then computes the SHA-256 hash locally.
 *
 * NOTE: This route only runs in `next dev` / `next start` (server mode).
 *       In the static GitHub Pages export, this route does not exist — the
 *       frontend falls back to a direct browser fetch with CORS headers.
 *
 * Usage: GET /api/fetch-skill?url=<encoded-skill-url>
 */

import { NextRequest, NextResponse } from "next/server";

// Do not cache — always fetch the current file content.
export const dynamic = "force-dynamic";

// Maximum skill file size we'll proxy: 2 MB.
const MAX_BYTES = 2 * 1024 * 1024;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rawUrl = req.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing ?url parameter" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Only allow https:// to avoid SSRF against internal services.
  if (targetUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only https:// URLs are supported" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      headers: { "User-Agent": "IsnadChain-SkillHasher/1.0" },
      // Limit redirect following to avoid open-redirect abuse.
      redirect: "follow",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch skill URL" },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: 502 },
    );
  }

  // Read body with size limit.
  const reader = upstream.body?.getReader();
  if (!reader) {
    return NextResponse.json({ error: "Empty response from upstream" }, { status: 502 });
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    if (totalBytes > MAX_BYTES) {
      reader.cancel();
      return NextResponse.json(
        { error: "Skill file exceeds 2 MB limit" },
        { status: 413 },
      );
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
