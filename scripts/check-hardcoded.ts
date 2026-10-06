/**
 * Fails when source code carries values that belong in the database:
 * colours (hex, rgb, hsl) and Arabic text. Comments and tests are ignored.
 * Numbers for scoring are caught by review: they live in scoring_profiles.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(process.cwd(), "src");
const exts = /\.(ts|tsx|css)$/;
const skip = /\.test\.tsx?$/;

const rules: { name: string; re: RegExp }[] = [
  { name: "hex colour", re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: "rgb/hsl colour", re: /\b(rgba?|hsla?)\(/g },
  { name: "Arabic text (use ui_messages or content tables)", re: /[؀-ۿݐ-ݿࢠ-ࣿ]/g },
];

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : exts.test(p) && !skip.test(p) ? [p] : [];
  });

const problems: string[] = [];
for (const file of walk(root)) {
  const lines = stripComments(readFileSync(file, "utf8")).split("\n");
  lines.forEach((line, i) => {
    for (const r of rules) {
      if (r.re.test(line)) problems.push(`${relative(process.cwd(), file)}:${i + 1}  ${r.name}: ${line.trim()}`);
      r.re.lastIndex = 0;
    }
  });
}

if (problems.length) {
  console.error(`Hardcoded values found (move them to seed/ and the database):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("No hardcoded colours or Arabic text in src/.");
