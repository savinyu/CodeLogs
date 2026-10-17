import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { userTag } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export interface UserSettings {
  publicProfile: boolean;
  globalBoard: boolean;
  dailyGoal: number;
}

/** The user's preferences. The columns are read here rather than through Better Auth's session. */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  "use cache: remote";
  cacheLife("user");
  cacheTag(userTag(userId));
  const [row] = await db
    .select({
      publicProfile: users.publicProfile,
      globalBoard: users.globalBoard,
      dailyGoal: users.dailyGoal,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? { publicProfile: false, globalBoard: false, dailyGoal: 3 };
}
