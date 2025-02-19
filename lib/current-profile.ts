import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const currentProfile = async () => {
  const authData = await auth(); 
  const userId = authData?.userId;

  if (!userId) {
    return null;
  }

  return await db.profile.findUnique({
    where: { userId }
  });
};