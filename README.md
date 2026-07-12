# atlas

Ask a research question, get a short survey-style answer where every claim cites a real arXiv paper.

Most assistants answer research questions from memory and invent citations when they don't know. Atlas retrieves actual papers first, writes only from what it found, and checks every citation against the source before showing you anything. Measured citation accuracy will live on a public eval page — that's part of the core scope, not an afterthought.

Status: early development. Working so far: arXiv search client and a search API route.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- arXiv API for paper retrieval

More gets added when it's needed.

## Run it

```bash
pnpm install
pnpm dev
```

Then try `http://localhost:3000/api/search?q=kv+cache+compression` — returns ranked papers as JSON.
