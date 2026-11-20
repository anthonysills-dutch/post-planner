import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as library from "@/server/library";
import { createPost } from "@/server/posts";
import { ensureProfile } from "@/server/profile";

// Library entries are shared by the organization; collections are each member's own.

export const getLibrary = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await ensureProfile(user);
    const admin = isAdmin(user);
    const [entries, collections] = await Promise.all([
      library.listEntries(user.orgId),
      library.listCollections(user.id, user.orgId),
    ]);
    return {
      entries: entries.map(({ addedBy, ...entry }) => ({ ...entry, canDelete: admin || addedBy === user.id })),
      collections: collections.map((c) => ({ id: c.id, name: c.name })),
    };
  });

export const addEntry = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.addEntryInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await library.addEntry(user.orgId, user.id, data);
    return { ok: true as const };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.idInput.parse(data))
  .handler(async ({ data, context: { user } }) => ({
    ok: await library.deleteEntry(user.orgId, user.id, isAdmin(user), data.id),
  }));

export const remixEntry = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.idInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const entry = await library.getEntry(user.orgId, data.id);
    if (!entry) return null;
    await ensureProfile(user);
    return createPost(user.id, { body: entry.body.slice(0, 3000), status: "idea" });
  });

export const getCollections = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context: { user } }) => library.listCollections(user.id, user.orgId));

export const createCollection = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.createCollectionInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await library.createCollection(user.id, data.name);
    return { ok: true as const };
  });

export const renameCollection = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.renameCollectionInput.parse(data))
  .handler(async ({ data, context: { user } }) => ({
    ok: await library.renameCollection(user.id, data.id, data.name),
  }));

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.idInput.parse(data))
  .handler(async ({ data, context: { user } }) => ({
    ok: await library.deleteCollection(user.id, data.id),
  }));

export const addToCollection = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.itemInput.parse(data))
  .handler(async ({ data, context: { user } }) => ({
    ok: await library.addToCollection(user.id, user.orgId, data),
  }));

export const removeFromCollection = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.itemInput.parse(data))
  .handler(async ({ data, context: { user } }) => ({
    ok: await library.removeFromCollection(user.id, data),
  }));
