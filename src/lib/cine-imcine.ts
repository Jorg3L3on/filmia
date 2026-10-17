import { z } from "zod";

/** One row of `data/cines-mx.json` (see data/README.md). */
const imcineReleaseSchema = z.object({
  tmdbId: z.number().int().positive().nullable(),
  title: z.string().trim().min(1),
  mxReleaseDate: z.iso.date(),
  source: z.literal("imcine"),
  note: z.string().optional(),
});

export type ImcineRelease = z.infer<typeof imcineReleaseSchema>;

export type ImcineIssue = { index: number; title: string | null; error: string };

/**
 * Validate the file entry by entry: a bad row is reported and skipped, never fatal, so one typo
 * in a monthly update does not cost the other films their dates.
 */
export const parseImcineFile = (raw: unknown): { releases: ImcineRelease[]; issues: ImcineIssue[] } => {
  const rows = raw && typeof raw === "object" && Array.isArray((raw as { releases?: unknown }).releases)
    ? ((raw as { releases: unknown[] }).releases)
    : null;
  if (!rows) {
    return { releases: [], issues: [{ index: -1, title: null, error: "falta el arreglo releases" }] };
  }

  const releases: ImcineRelease[] = [];
  const issues: ImcineIssue[] = [];
  rows.forEach((row, index) => {
    const parsed = imcineReleaseSchema.safeParse(row);
    if (parsed.success) {
      releases.push(parsed.data);
      return;
    }
    const title = row && typeof row === "object" && typeof (row as { title?: unknown }).title === "string"
      ? (row as { title: string }).title
      : null;
    issues.push({
      index,
      title,
      error: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(fila)"}: ${issue.message}`).join("; "),
    });
  });
  return { releases, issues };
};
