import { XMLParser } from "fast-xml-parser";

const ARXIV_API = "https://export.arxiv.org/api/query";

export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  absUrl: string;
  pdfUrl: string;
}

export interface SearchOptions {
  maxResults?: number;
  start?: number;
  sortBy?: "relevance" | "submittedDate" | "lastUpdatedDate";
}

interface AtomLink {
  "@_href"?: string;
  "@_title"?: string;
}

interface AtomCategory {
  "@_term"?: string;
}

interface AtomAuthor {
  name?: string;
}

interface AtomEntry {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
  author?: AtomAuthor | AtomAuthor[];
  category?: AtomCategory | AtomCategory[];
  link?: AtomLink | AtomLink[];
}

interface AtomFeed {
  feed?: {
    entry?: AtomEntry | AtomEntry[];
  };
}

const parser = new XMLParser({ ignoreAttributes: false });

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export async function searchArxiv(
  query: string,
  options: SearchOptions = {},
): Promise<ArxivPaper[]> {
  const { maxResults = 10, start = 0, sortBy = "relevance" } = options;

  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: String(start),
    max_results: String(Math.min(maxResults, 25)),
    sortBy,
  });

  const res = await fetch(`${ARXIV_API}?${params}`);
  if (!res.ok) {
    throw new Error(`arxiv api responded with ${res.status}`);
  }

  const doc = parser.parse(await res.text()) as AtomFeed;

  return asArray(doc.feed?.entry).map((entry) => {
    const absUrl = entry.id ?? "";
    const pdfLink = asArray(entry.link).find((l) => l["@_title"] === "pdf");

    return {
      id: absUrl.split("/abs/")[1] ?? absUrl,
      title: collapse(entry.title ?? ""),
      summary: collapse(entry.summary ?? ""),
      authors: asArray(entry.author)
        .map((a) => a.name)
        .filter((n): n is string => Boolean(n)),
      published: entry.published ?? "",
      updated: entry.updated ?? "",
      categories: asArray(entry.category)
        .map((c) => c["@_term"])
        .filter((t): t is string => Boolean(t)),
      absUrl,
      pdfUrl: pdfLink?.["@_href"] ?? absUrl.replace("/abs/", "/pdf/"),
    };
  });
}
