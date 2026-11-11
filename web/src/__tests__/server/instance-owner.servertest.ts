import { randomUUID } from "node:crypto";

import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@langfuse/shared/src/db";
import { env } from "@/src/env.mjs";
import { appRouter } from "@/src/server/api/root";
import { createInnerTRPCContext } from "@/src/server/api/trpc";
import { getAuthOptions } from "@/src/server/auth";

// Security contracts for instance owners: OWNER access to every organization
// without a membership, and an administration surface closed to everyone else.

const savedBootstrapEmail = env.LANGFUSE_INIT_INSTANCE_OWNER_EMAIL;

afterEach(() => {
  (env as any).LANGFUSE_INIT_INSTANCE_OWNER_EMAIL = savedBootstrapEmail;
});

async function createUser(instanceOwner = false) {
  const email = `instance-owner-${randomUUID()}@example.com`;
  return prisma.user.create({ data: { email, name: "User", instanceOwner } });
}

async function createForeignOrg() {
  const org = await prisma.organization.create({
    data: { name: `Instance Owner Org ${randomUUID()}` },
  });
  return org.id;
}

async function sessionFor(email: string): Promise<Session> {
  const sessionCallback = (await getAuthOptions()).callbacks
    ?.session as (params: { session: Session; token: JWT }) => Promise<Session>;
  return sessionCallback({
    session: { expires: "1", user: null } as unknown as Session,
    token: { email, loginAt: Date.now() },
  });
}

async function callerFor(email: string) {
  const session = await sessionFor(email);
  const ctx = createInnerTRPCContext({ session, headers: {} });
  return appRouter.createCaller({ ...ctx, prisma });
}

async function orgInSession(email: string, orgId: string) {
  const session = await sessionFor(email);
  return session.user?.organizations.find((org) => org.id === orgId);
}

const isOwnerInDb = async (userId: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
    .instanceOwner;

describe("instance owner session", () => {
  it("adds organizations without a membership as OWNER, only for owners", async () => {
    const orgId = await createForeignOrg();
    const owner = await createUser(true);
    const normalUser = await createUser();

    expect(await orgInSession(owner.email!, orgId)).toMatchObject({
      role: "OWNER",
      instanceOwnerAccess: true,
    });
    expect(await orgInSession(normalUser.email!, orgId)).toBeUndefined();
  });

  it("treats the bootstrap email as an owner without the database flag", async () => {
    const orgId = await createForeignOrg();
    const user = await createUser();
    (env as any).LANGFUSE_INIT_INSTANCE_OWNER_EMAIL = user.email;

    expect(await orgInSession(user.email!, orgId)).toMatchObject({
      role: "OWNER",
      instanceOwnerAccess: true,
    });
  });
});

describe("instanceAdmin router", () => {
  it("rejects a non-owner as NOT_FOUND and promotes nobody", async () => {
    const normalUser = await createUser();
    const target = await createUser();
    const caller = await callerFor(normalUser.email!);

    await expect(
      caller.instanceAdmin.promote({ email: target.email! }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await isOwnerInDb(target.id)).toBe(false);
  });

  it("lets an owner promote a user but not demote themselves or the bootstrap owner", async () => {
    const owner = await createUser(true);
    const target = await createUser();
    const caller = await callerFor(owner.email!);

    await caller.instanceAdmin.promote({ email: target.email! });
    expect(await isOwnerInDb(target.id)).toBe(true);

    await expect(
      caller.instanceAdmin.demote({ userId: owner.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await isOwnerInDb(owner.id)).toBe(true);

    (env as any).LANGFUSE_INIT_INSTANCE_OWNER_EMAIL = target.email;
    await expect(
      caller.instanceAdmin.demote({ userId: target.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await isOwnerInDb(target.id)).toBe(true);
  });
});
