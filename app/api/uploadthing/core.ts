import { getAuth } from "@clerk/nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { NextRequest } from "next/server"; 

const f = createUploadthing();

const handleAuth = (req: NextRequest) => {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("Unauthorized");
  return { userId };
};

export const ourFileRouter = {
  serverImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(({ req }) => handleAuth(req as NextRequest)) 
    .onUploadComplete(() => {}),

  messageFile: f(["image", "pdf"])
    .middleware(({ req }) => handleAuth(req as NextRequest)) 
    .onUploadComplete(() => {}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;