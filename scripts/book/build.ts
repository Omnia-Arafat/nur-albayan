/**
 * Build seed/content/ from the hand-checked book: the curriculum in seed/book/curriculum.json
 * and one page file per book page in seed/book/NNN.txt.
 *   pnpm book:build
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parsePage } from "./dsl";

const src = join(process.cwd(), "seed", "book");
const outDir = join(process.cwd(), "seed", "content");
const pagesDir = join(outDir, "pages");
rmSync(pagesDir, { recursive: true, force: true });
mkdirSync(pagesDir, { recursive: true });

type Named = { slug: string; i18n: Record<string, { title: string }> };
type Curriculum = {
  slug: string;
  edition?: string;
  i18n: Record<string, { title: string; subtitle?: string }>;
  stages: Named[];
  topics: (Named & { stage: string })[];
};

const curriculum: Curriculum = JSON.parse(readFileSync(join(src, "curriculum.json"), "utf8"));
const stageSlugs = new Set(curriculum.stages.map((st) => st.slug));
for (const topic of curriculum.topics) {
  if (!stageSlugs.has(topic.stage)) throw new Error(`curriculum.json: topic "${topic.slug}" has unknown stage "${topic.stage}"`);
}
const stageOfTopic = new Map(curriculum.topics.map((t) => [t.slug, t.stage]));

let stage = "";
let topic = "";
const usedTopics = new Set<string>();
const files = readdirSync(src).filter((f) => /^\d+\.txt$/.test(f)).sort();
for (const f of files) {
  const text = readFileSync(join(src, f), "utf8");
  const declared = text.match(/^stage:\s*(\S+)/m);
  if (declared) stage = declared[1];
  const declaredTopic = text.match(/^topic:\s*(\S+)/m);
  if (declaredTopic) topic = declaredTopic[1];
  else if (declared) topic = stage;
  if (!stage) throw new Error(`${f}: no stage declared yet`);
  if (!stageSlugs.has(stage)) throw new Error(`${f}: stage "${stage}" is not in curriculum.json`);
  if (stageOfTopic.get(topic) !== stage) throw new Error(`${f}: topic "${topic}" is not a topic of stage "${stage}" in curriculum.json`);
  usedTopics.add(topic);
  const lesson = parsePage(text, () => ({ stage, topic }));
  writeFileSync(join(pagesDir, f.replace(".txt", ".json")), JSON.stringify(lesson, null, 2) + "\n");
}
const unused = curriculum.topics.filter((t) => !usedTopics.has(t.slug)).map((t) => t.slug);
if (unused.length) throw new Error(`curriculum.json: no page uses topic(s) ${unused.join(", ")}`);

writeFileSync(
  join(outDir, "book.json"),
  JSON.stringify(
    {
      slug: curriculum.slug,
      ...(curriculum.edition ? { edition: curriculum.edition } : {}),
      i18n: curriculum.i18n,
      stages: curriculum.stages.map((st, position) => ({ slug: st.slug, position, i18n: st.i18n })),
      topics: curriculum.topics.map((t, position) => ({ slug: t.slug, stage: t.stage, position, i18n: t.i18n })),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Built ${files.length} pages, ${curriculum.stages.length} stages, ${curriculum.topics.length} topics.`);
