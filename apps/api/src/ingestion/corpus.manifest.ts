import type { SourceType } from "@qa/schemas";

/**
 * Manually curated list of Wikipedia articles that make up our
 * manned-spaceflight knowledge base. Fifty entries across three categories
 * with deliberate cross-references (e.g. Apollo 11 ↔ Neil Armstrong ↔ Saturn V
 * ↔ Apollo CSM ↔ Apollo LM) so the eval set can test genuine multi-hop
 * retrieval rather than single-article lookup.
 *
 * - `title`  is the exact Wikipedia page title (used for the REST API call).
 * - `slug`   is the lowercase, hyphenated identifier used as filename and
 *            chunk-id prefix. It stays stable even if `title` gets renamed.
 * - `category` maps 1:1 to the `SourceType` enum in `@qa/schemas`.
 */
export interface CorpusEntry {
  readonly slug: string;
  readonly title: string;
  readonly category: SourceType;
}

export const CORPUS: readonly CorpusEntry[] = [
  // ── Missions (20) ────────────────────────────────────────────────────────
  { slug: "apollo-1", title: "Apollo 1", category: "mission" },
  { slug: "apollo-8", title: "Apollo 8", category: "mission" },
  { slug: "apollo-11", title: "Apollo 11", category: "mission" },
  { slug: "apollo-13", title: "Apollo 13", category: "mission" },
  { slug: "apollo-15", title: "Apollo 15", category: "mission" },
  { slug: "apollo-17", title: "Apollo 17", category: "mission" },
  { slug: "gemini-4", title: "Gemini 4", category: "mission" },
  { slug: "gemini-8", title: "Gemini 8", category: "mission" },
  { slug: "mercury-redstone-3", title: "Mercury-Redstone 3", category: "mission" },
  { slug: "vostok-1", title: "Vostok 1", category: "mission" },
  { slug: "soyuz-1", title: "Soyuz 1", category: "mission" },
  { slug: "apollo-soyuz", title: "Apollo–Soyuz", category: "mission" },
  { slug: "sts-1", title: "STS-1", category: "mission" },
  { slug: "sts-51-l", title: "STS-51-L", category: "mission" },
  { slug: "sts-107", title: "STS-107", category: "mission" },
  { slug: "sts-135", title: "STS-135", category: "mission" },
  { slug: "skylab-4", title: "Skylab 4", category: "mission" },
  { slug: "expedition-1", title: "Expedition 1", category: "mission" },
  { slug: "shenzhou-5", title: "Shenzhou 5", category: "mission" },
  { slug: "crew-dragon-demo-2", title: "Crew Dragon Demo-2", category: "mission" },

  // ── Astronauts (15) ──────────────────────────────────────────────────────
  { slug: "neil-armstrong", title: "Neil Armstrong", category: "astronaut" },
  { slug: "buzz-aldrin", title: "Buzz Aldrin", category: "astronaut" },
  { slug: "michael-collins", title: "Michael Collins (astronaut)", category: "astronaut" },
  { slug: "yuri-gagarin", title: "Yuri Gagarin", category: "astronaut" },
  { slug: "alan-shepard", title: "Alan Shepard", category: "astronaut" },
  { slug: "john-glenn", title: "John Glenn", category: "astronaut" },
  { slug: "jim-lovell", title: "Jim Lovell", category: "astronaut" },
  { slug: "gus-grissom", title: "Gus Grissom", category: "astronaut" },
  { slug: "valentina-tereshkova", title: "Valentina Tereshkova", category: "astronaut" },
  { slug: "sally-ride", title: "Sally Ride", category: "astronaut" },
  { slug: "christa-mcauliffe", title: "Christa McAuliffe", category: "astronaut" },
  { slug: "chris-hadfield", title: "Chris Hadfield", category: "astronaut" },
  { slug: "scott-kelly", title: "Scott Kelly (astronaut)", category: "astronaut" },
  { slug: "peggy-whitson", title: "Peggy Whitson", category: "astronaut" },
  { slug: "gene-cernan", title: "Gene Cernan", category: "astronaut" },

  // ── Spacecraft (15) ──────────────────────────────────────────────────────
  { slug: "apollo-csm", title: "Apollo command and service module", category: "spacecraft" },
  { slug: "apollo-lm", title: "Apollo Lunar Module", category: "spacecraft" },
  { slug: "saturn-v", title: "Saturn V", category: "spacecraft" },
  { slug: "mercury-spacecraft", title: "Project Mercury", category: "spacecraft" },
  { slug: "gemini-spacecraft", title: "Gemini (spacecraft)", category: "spacecraft" },
  { slug: "vostok-spacecraft", title: "Vostok (spacecraft)", category: "spacecraft" },
  { slug: "soyuz-spacecraft", title: "Soyuz (spacecraft)", category: "spacecraft" },
  { slug: "skylab", title: "Skylab", category: "spacecraft" },
  { slug: "space-shuttle-orbiter", title: "Space Shuttle orbiter", category: "spacecraft" },
  { slug: "space-shuttle-external-tank", title: "Space Shuttle external tank", category: "spacecraft" },
  { slug: "space-shuttle-srb", title: "Space Shuttle Solid Rocket Booster", category: "spacecraft" },
  { slug: "iss", title: "International Space Station", category: "spacecraft" },
  { slug: "dragon-2", title: "Dragon 2", category: "spacecraft" },
  { slug: "shenzhou-spacecraft", title: "Shenzhou (spacecraft)", category: "spacecraft" },
  { slug: "salyut-programme", title: "Salyut programme", category: "spacecraft" },
];

/** Map category → plural folder name under `data/corpus/`. */
export const CATEGORY_FOLDER: Record<SourceType, string> = {
  mission: "missions",
  astronaut: "astronauts",
  spacecraft: "spacecraft",
};
