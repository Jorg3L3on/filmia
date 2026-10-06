import { config as loadEnv } from "dotenv";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import {
  db,
  listItems,
  lists,
  pickEvents,
  tags,
  titleTags,
  titles,
  tonightPicks,
  users,
} from "@/db";
import { hashPassword } from "@/lib/auth/password";

const [sourceEmailArg, targetEmailArg, targetPassword, targetName] = process.argv.slice(2);
const sourceEmail = sourceEmailArg?.trim().toLowerCase();
const targetEmail = targetEmailArg?.trim().toLowerCase();
const dryRun = process.env.DRY_RUN === "1";

if (!sourceEmail || !targetEmail || !targetPassword) {
  console.error(
    "Uso: npm run db:clone-account -- <origen> <destino> <contraseña> [nombre]  (DRY_RUN=1 solo cuenta)",
  );
  process.exit(1);
}

const chunk = <T>(rows: T[], size = 200): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
};

const main = async () => {
  const source = await db.query.users.findFirst({ where: eq(users.email, sourceEmail) });
  if (!source) {
    console.error(`No se encontró la cuenta origen ${sourceEmail}`);
    process.exit(1);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, targetEmail),
    columns: { id: true },
  });
  if (existing) {
    console.error(`Ya existe ${targetEmail}; no se toca. Bórrala primero si quieres rehacerla.`);
    process.exit(1);
  }

  const sourceTitles = await db.select().from(titles).where(eq(titles.userId, source.id));
  const sourceTags = await db.select().from(tags).where(eq(tags.userId, source.id));
  const sourceLists = await db.select().from(lists).where(eq(lists.userId, source.id));
  const sourcePicks = await db.select().from(tonightPicks).where(eq(tonightPicks.userId, source.id));
  const sourceEvents = await db.select().from(pickEvents).where(eq(pickEvents.userId, source.id));

  const titleIds = new Set(sourceTitles.map((row) => row.id));
  const tagIds = new Set(sourceTags.map((row) => row.id));
  const listIds = new Set(sourceLists.map((row) => row.id));

  const sourceTitleTags = (await db.select().from(titleTags)).filter(
    (row) => titleIds.has(row.titleId) && tagIds.has(row.tagId),
  );
  const sourceListItems = (await db.select().from(listItems)).filter(
    (row) => listIds.has(row.listId) && titleIds.has(row.titleId),
  );

  console.log(
    `Origen ${sourceEmail}: ${sourceTitles.length} títulos, ${sourceTags.length} tags, ` +
      `${sourceTitleTags.length} títulos-tag, ${sourceLists.length} listas, ` +
      `${sourceListItems.length} items de lista, ${sourcePicks.length} picks, ${sourceEvents.length} eventos`,
  );
  console.log(`Plataformas: ${JSON.stringify(source.streamingPlatforms)}`);

  if (dryRun) {
    console.log("DRY_RUN=1: no se escribió nada.");
    process.exit(0);
  }

  const userId = createId();
  const titleMap = new Map(sourceTitles.map((row) => [row.id, createId()]));
  const tagMap = new Map(sourceTags.map((row) => [row.id, createId()]));
  const listMap = new Map(sourceLists.map((row) => [row.id, createId()]));
  const mapped = (map: Map<string, string>, id: string) => {
    const value = map.get(id);
    if (!value) {
      throw new Error(`Id sin mapear: ${id}`);
    }
    return value;
  };

  const passwordHash = await hashPassword(targetPassword);

  const statements = [
    db.insert(users).values({
      id: userId,
      email: targetEmail,
      passwordHash,
      name: targetName?.trim() || null,
      streamingPlatforms: source.streamingPlatforms,
      nightEndsAt: source.nightEndsAt,
      // A clone copies a lived-in account: never send it through the Bienvenida.
      onboardedAt: source.onboardedAt ?? new Date(),
      onboardingStep: null,
    }),
    ...chunk(sourceTitles, 100).map((rows) =>
      db.insert(titles).values(
        rows.map((row) => ({ ...row, id: mapped(titleMap, row.id), userId })),
      ),
    ),
    ...chunk(sourceTags).map((rows) =>
      db.insert(tags).values(rows.map((row) => ({ ...row, id: mapped(tagMap, row.id), userId }))),
    ),
    ...chunk(sourceTitleTags).map((rows) =>
      db.insert(titleTags).values(
        rows.map((row) => ({
          titleId: mapped(titleMap, row.titleId),
          tagId: mapped(tagMap, row.tagId),
        })),
      ),
    ),
    ...chunk(sourceLists).map((rows) =>
      db.insert(lists).values(rows.map((row) => ({ ...row, id: mapped(listMap, row.id), userId }))),
    ),
    ...chunk(sourceListItems).map((rows) =>
      db.insert(listItems).values(
        rows.map((row) => ({
          ...row,
          listId: mapped(listMap, row.listId),
          titleId: mapped(titleMap, row.titleId),
        })),
      ),
    ),
    ...chunk(sourcePicks).map((rows) =>
      db.insert(tonightPicks).values(
        rows
          .filter((row) => titleMap.has(row.titleId))
          .map((row) => ({ ...row, userId, titleId: mapped(titleMap, row.titleId) })),
      ),
    ),
    ...chunk(sourceEvents).map((rows) =>
      db.insert(pickEvents).values(
        rows
          .filter((row) => titleMap.has(row.titleId))
          .map((row) => ({
            ...row,
            id: createId(),
            userId,
            titleId: mapped(titleMap, row.titleId),
          })),
      ),
    ),
  ];

  // One HTTP round-trip, atomic: either the whole copy lands or nothing does.
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);

  console.log(`Cuenta ${targetEmail} creada (${userId}) con una copia de ${sourceEmail}.`);

};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
