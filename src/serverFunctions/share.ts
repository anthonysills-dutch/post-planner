import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSharedPost } from "@/server/share";

// The public preview's data. Runs while /s/:token renders on the server, for
// anyone with the link; it returns the display name and body alone.
export const getPreview = createServerFn()
  .validator((data: unknown) => z.object({ token: z.string().max(100) }).strict().parse(data))
  .handler(({ data }) => getSharedPost(data.token));
