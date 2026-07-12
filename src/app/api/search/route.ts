import { NextResponse } from "next/server";
import { searchArxiv } from "@/lib/arxiv";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const SEARCHES_PER_MINUTE = 15;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2 || query.length > 200) {
    return NextResponse.json(
      { error: "q must be between 2 and 200 characters" },
      { status: 400 },
    );
  }

  const limit = rateLimit(`search:${clientIp(request)}`, SEARCHES_PER_MINUTE, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — try again later" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterS) } },
    );
  }

  try {
    const papers = await searchArxiv(query, { maxResults: 10 });
    return NextResponse.json({ query, count: papers.length, papers });
  } catch (err) {
    console.error("[search] arxiv search failed:", err);
    return NextResponse.json({ error: "arxiv search failed" }, { status: 502 });
  }
}
