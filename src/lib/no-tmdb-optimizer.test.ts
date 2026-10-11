import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

// FIL-I7: TMDB images are served as-is. Vercel Hobby bills 5,000 image
// transformations a month and every poster + width counted as one, so any
// `<Image>` that isn't a local asset must be `unoptimized`, and nothing may
// build a `/_next/image` URL by hand. A text check, not a type check: enough
// that a future PR can't bring the cost back unnoticed.

const SRC = join(process.cwd(), "src");
const PROXY = join(SRC, "proxy.ts");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

const files = walk(SRC);
const isTest = (file: string) => file.endsWith(".test.ts") || file.endsWith(".test.tsx");
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** Every `<Image …>` opening tag (brace-aware, so `=>` inside props doesn't end it). */
const imageTags = (text: string) => {
  const tags: { index: number; tag: string }[] = [];
  for (const match of text.matchAll(/<Image(?=[\s/>])/g)) {
    let depth = 0;
    let end = match.index;
    for (; end < text.length; end += 1) {
      const char = text[end];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }
    tags.push({ index: match.index, tag: text.slice(match.index, end + 1) });
  }
  return tags;
};

/** `src="/filmia-mark.png"`: a literal local path never reaches TMDB. */
const isLocalLiteral = (tag: string) => /\bsrc="\/[^"]*"/.test(tag);
const isUnoptimized = (tag: string) => /\bunoptimized\b/.test(tag);

describe("TMDB images skip the Vercel optimizer", () => {
  it("every next/image <Image> is unoptimized unless its src is a local literal", () => {
    const offenders: string[] = [];
    for (const file of files.filter((f) => f.endsWith(".tsx") && !isTest(f))) {
      const text = readFileSync(file, "utf8");
      if (!text.includes('from "next/image"')) {
        continue;
      }
      for (const { index, tag } of imageTags(text)) {
        if (!isUnoptimized(tag) && !isLocalLiteral(tag)) {
          offenders.push(`${relative(process.cwd(), file)}:${lineOf(text, index)}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `<Image> sin \`unoptimized\` (cada imagen de TMDB nueva cuesta una transformación de Vercel); ` +
        `añade \`unoptimized={isTmdbImage(src)}\` o \`unoptimized\`:\n${offenders.join("\n")}`,
    );
  });

  it("PosterImage keeps unoptimized on every external poster", () => {
    const text = readFileSync(join(SRC, "components", "PosterImage.tsx"), "utf8");
    assert.match(text, /unoptimized=\{isExternal\}/, "PosterImage.tsx perdió `unoptimized={isExternal}`");
  });

  it("nothing in src builds a /_next/image URL outside src/proxy.ts", () => {
    const offenders: string[] = [];
    for (const file of files.filter((f) => /\.(ts|tsx)$/.test(f) && f !== PROXY && !isTest(f))) {
      const text = readFileSync(file, "utf8");
      let index = text.indexOf("_next/image");
      while (index !== -1) {
        offenders.push(`${relative(process.cwd(), file)}:${lineOf(text, index)}`);
        index = text.indexOf("_next/image", index + 1);
      }
    }
    assert.deepEqual(offenders, [], `\`_next/image\` fuera de src/proxy.ts:\n${offenders.join("\n")}`);
  });
});
