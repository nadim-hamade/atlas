import { NextResponse } from "next/server";
import { searchArxiv } from "@/lib/arxiv";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2 || query.length > 200) {
    return NextResponse.json(
      { error: "q must be between 2 and 200 characters" },
      { status: 400 },
    );
  }

  try {
    const papers = await searchArxiv(query, { maxResults: 10 });
    return NextResponse.json({ query, count: papers.length, papers });
  } catch {
    return NextResponse.json({ error: "arxiv search failed" }, { status: 502 });
  }
}
