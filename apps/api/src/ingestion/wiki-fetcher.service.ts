import { Injectable, Logger } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CORPUS, CATEGORY_FOLDER, type CorpusEntry } from "./corpus.manifest.js";
import { CORPUS_DIR } from "../common/paths.js";

/**
 * Fetches article bodies from Wikipedia's MediaWiki API using
 * `action=query&prop=extracts&explaintext=1` — this returns the full article
 * body as plain text (no HTML, no navboxes, no reference markup), which saves
 * us an entire HTML-cleaning pass and keeps chunks free of template cruft.
 *
 * One HTTP call per article, sequential with a polite delay. Free-tier friendly
 * (the manned-spaceflight corpus is ~50 articles — no need for parallelism or
 * elaborate rate limiting).
 */

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const WIKI_PAGE = "https://en.wikipedia.org/wiki";
const USER_AGENT = "QA-Agent-Ingestion/0.1 (Tappz AI Engineer take-home; https://github.com/)";
const REQUEST_DELAY_MS = 250;

interface WikiExtractResponse {
  query?: {
    pages?: Record<string, { title?: string; extract?: string; missing?: string }>;
  };
}

export interface FetchedArticle {
  entry: CorpusEntry;
  url: string;
  body: string;
  fetchedAt: string;
}

@Injectable()
export class WikiFetcherService {
  private readonly logger = new Logger(WikiFetcherService.name);

  async fetchAll(options: { force?: boolean } = {}): Promise<FetchedArticle[]> {
    const force = options.force ?? false;
    this.logger.log(`Fetching ${CORPUS.length} articles (force=${force}) → ${CORPUS_DIR}`);

    const results: FetchedArticle[] = [];
    let skipped = 0;
    let fetched = 0;
    let failed = 0;

    for (const entry of CORPUS) {
      const path = this.filePathFor(entry);
      if (!force && existsSync(path)) {
        skipped += 1;
        continue;
      }

      try {
        const article = await this.fetchOne(entry);
        await this.writeMarkdown(article);
        results.push(article);
        fetched += 1;
        this.logger.log(`✓ ${entry.title} (${article.body.length.toLocaleString()} chars)`);
      } catch (error) {
        failed += 1;
        this.logger.error(`✗ ${entry.title}: ${(error as Error).message}`);
      }

      await sleep(REQUEST_DELAY_MS);
    }

    this.logger.log(`Done. fetched=${fetched} skipped=${skipped} failed=${failed}`);
    return results;
  }

  async fetchOne(entry: CorpusEntry): Promise<FetchedArticle> {
    const url = new URL(WIKI_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("prop", "extracts");
    url.searchParams.set("explaintext", "1");
    url.searchParams.set("exlimit", "1");
    url.searchParams.set("redirects", "1");
    url.searchParams.set("titles", entry.title);
    url.searchParams.set("origin", "*");

    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as WikiExtractResponse;

    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) {
      throw new Error(`Wikipedia page not found for title "${entry.title}"`);
    }

    const extract = page.extract?.trim() ?? "";
    if (extract.length < 200) {
      throw new Error(`Extract suspiciously short (${extract.length} chars) — likely a disambiguation page`);
    }

    return {
      entry,
      url: `${WIKI_PAGE}/${encodeURIComponent(entry.title.replace(/\s+/g, "_"))}`,
      body: cleanWikiText(extract),
      fetchedAt: new Date().toISOString(),
    };
  }

  /** Reads a previously-fetched article from disk. Returns null if missing. */
  async readOne(entry: CorpusEntry): Promise<FetchedArticle | null> {
    const path = this.filePathFor(entry);
    if (!existsSync(path)) return null;
    const raw = await readFile(path, "utf8");
    return parseMarkdown(entry, raw);
  }

  filePathFor(entry: CorpusEntry): string {
    return join(CORPUS_DIR, CATEGORY_FOLDER[entry.category], `${entry.slug}.md`);
  }

  private async writeMarkdown(article: FetchedArticle): Promise<void> {
    const path = this.filePathFor(article.entry);
    await mkdir(join(CORPUS_DIR, CATEGORY_FOLDER[article.entry.category]), { recursive: true });

    const frontmatter = [
      "---",
      `title: ${escapeYaml(article.entry.title)}`,
      `slug: ${article.entry.slug}`,
      `category: ${article.entry.category}`,
      `url: ${article.url}`,
      `fetchedAt: ${article.fetchedAt}`,
      "---",
      "",
    ].join("\n");

    await writeFile(path, frontmatter + article.body + "\n", "utf8");
  }
}

/**
 * Normalises a Wikipedia plaintext extract into clean markdown.
 *
 * Crucially, we *preserve* section hierarchy (`== Background ==` → `## Background`)
 * rather than stripping it, because the chunker uses that structure to:
 *   1. Prefer section boundaries as chunk break points.
 *   2. Prepend the article + section path to each chunk for retrieval signal.
 *
 * We don't attempt to normalise references — the extract API already removes
 * reflinks, so there's nothing to clean.
 */
function cleanWikiText(raw: string): string {
  return raw
    .replace(/^(=+)\s*([^=\n]+?)\s*\1\s*$/gm, (_m, equals: string, title: string) => {
      const level = Math.min(equals.length, 6);
      return `\n${"#".repeat(level)} ${title}\n`;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeYaml(value: string): string {
  if (/[:#\[\]&*?|<>=!%@`"']/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function parseMarkdown(entry: CorpusEntry, raw: string): FetchedArticle {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error(`Corpus file for "${entry.slug}" is missing YAML frontmatter`);
  }
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]!] = stripQuotes(kv[2]!);
  }
  return {
    entry,
    url: meta.url ?? "",
    fetchedAt: meta.fetchedAt ?? "",
    body: match[2]!.trim(),
  };
}

function stripQuotes(s: string): string {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/\\"/g, '"') : s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
