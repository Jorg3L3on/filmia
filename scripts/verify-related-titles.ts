import { config as loadEnv } from "dotenv";
import { and, eq, inArray, ne } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { db, titleTags, titles } from "../src/db";

const DEMO_EMAIL = "demo@filmia.local";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  const user = await db.query.users.findFirst({
    where: (table, { eq: equals }) => equals(table.email, DEMO_EMAIL),
    columns: { id: true },
  });
  assert(user, `Missing demo user ${DEMO_EMAIL}`);

  const tagged = await db
    .select({
      titleId: titleTags.titleId,
      tagId: titleTags.tagId,
    })
    .from(titleTags)
    .innerJoin(titles, eq(titles.id, titleTags.titleId))
    .where(eq(titles.userId, user!.id))
    .limit(8);

  if (tagged.length === 0) {
    console.log("✓ Related-titles query skipped (demo user has no tagged titles)");
    return;
  }

  const titleId = tagged[0]!.titleId;
  const tagIds = [...new Set(tagged.filter((row) => row.titleId === titleId).map((row) => row.tagId))];

  const matching = await db
    .selectDistinct({ titleId: titleTags.titleId })
    .from(titleTags)
    .innerJoin(titles, eq(titles.id, titleTags.titleId))
    .where(
      and(
        eq(titles.userId, user!.id),
        ne(titles.id, titleId),
        inArray(titleTags.tagId, tagIds),
      ),
    );

  const related =
    matching.length === 0
      ? []
      : await db.query.titles.findMany({
          where: inArray(
            titles.id,
            matching.map((row) => row.titleId),
          ),
          columns: { id: true, name: true },
          limit: 12,
        });

  assert(
    related.every((row) => row.id !== titleId),
    "Related titles must exclude the source title",
  );
  console.log(
    `✓ Related titles for ${titleId}: ${related.length} (no Title alias error)`,
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
