import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "@/src/env.mjs";
import { createExtendedPrismaAdapter, getAuthOptions } from "@/src/server/auth";
import { prisma } from "@langfuse/shared/src/db";
import { Role } from "@langfuse/shared";

describe("createExtendedPrismaAdapter.createUser with sign-up disabled", () => {
  const overriddenEnvKeys = [
    "AUTH_DISABLE_SIGNUP",
    "NEXT_PUBLIC_SIGN_UP_DISABLED",
  ] as const;
  const savedEnv: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of overriddenEnvKeys) savedEnv[key] = env[key];
    (env as any).AUTH_DISABLE_SIGNUP = "true";
    (env as any).NEXT_PUBLIC_SIGN_UP_DISABLED = undefined;
  });

  afterEach(() => {
    Object.assign(env, savedEnv);
  });

  it("rejects an email without a pending invitation", async () => {
    const email = uniqueEmail();

    await expect(createUser(email)).rejects.toThrow("Sign up is disabled.");

    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBe(
      null,
    );
  });

  it("creates the user and accepts the invitation for an invited email", async () => {
    const email = uniqueEmail();
    const { orgId } = await createOrgWithInvitation(email);

    const user = await createUser(email);

    await expectInvitationAccepted({ userId: user.id, email, orgId });
  });

  it("matches the invitation case-insensitively", async () => {
    const email = uniqueEmail();
    const { orgId } = await createOrgWithInvitation(email);

    // invitation is stored lowercase; the SSO profile reports mixed case
    const user = await createUser(
      email
        .replace("invited-user-", "Invited-User-")
        .replace("@example.com", "@Example.com"),
    );

    await expectInvitationAccepted({ userId: user.id, email, orgId });
  });
});

describe("createExtendedPrismaAdapter.createUser with sign-up enabled", () => {
  const savedEnv: Record<string, unknown> = {};

  beforeEach(() => {
    savedEnv.AUTH_DISABLE_SIGNUP = env.AUTH_DISABLE_SIGNUP;
    savedEnv.NEXT_PUBLIC_SIGN_UP_DISABLED = env.NEXT_PUBLIC_SIGN_UP_DISABLED;
    (env as any).AUTH_DISABLE_SIGNUP = undefined;
    (env as any).NEXT_PUBLIC_SIGN_UP_DISABLED = undefined;
  });

  afterEach(() => {
    Object.assign(env, savedEnv);
  });

  it("creates an uninvited user", async () => {
    const email = uniqueEmail();

    const user = await createUser(email);

    await expect(
      prisma.user.findUnique({ where: { id: user.id } }),
    ).resolves.toMatchObject({ email });
  });
});

describe("signIn callback for Google", () => {
  // invitations and account linking match on email, so it must be verified
  it("rejects a profile whose email is not verified", async () => {
    await expect(googleSignIn({ email_verified: false })).resolves.toBe(false);
    await expect(googleSignIn({})).resolves.toBe(false);
  });

  it("accepts a profile whose email is verified", async () => {
    await expect(googleSignIn({ email_verified: true })).resolves.toBe(true);
  });
});

async function googleSignIn(profile: { email_verified?: boolean }) {
  const signIn = (await getAuthOptions()).callbacks?.signIn;
  if (!signIn) throw new Error("signIn callback missing");
  return signIn({
    user: { id: randomUUID(), email: uniqueEmail() },
    account: { provider: "google", type: "oauth", providerAccountId: "1" },
    profile: profile as any,
  });
}

function uniqueEmail() {
  return `invited-user-${randomUUID()}@example.com`;
}

function createUser(email: string) {
  const adapter = createExtendedPrismaAdapter();
  if (!adapter.createUser) throw new Error("adapter.createUser missing");
  return adapter.createUser({ email, emailVerified: null, name: "Jane Doe" });
}

async function createOrgWithInvitation(email: string) {
  const org = await prisma.organization.create({
    data: { id: randomUUID(), name: `Invite Only Test Org ${randomUUID()}` },
  });
  await prisma.membershipInvitation.create({
    data: { email, orgId: org.id, orgRole: Role.MEMBER },
  });
  return { orgId: org.id };
}

async function expectInvitationAccepted({
  userId,
  email,
  orgId,
}: {
  userId: string;
  email: string;
  orgId: string;
}) {
  await expect(
    prisma.user.findUnique({ where: { id: userId } }),
  ).resolves.not.toBeNull();
  await expect(
    prisma.organizationMembership.findFirst({ where: { userId, orgId } }),
  ).resolves.toMatchObject({ role: Role.MEMBER });
  await expect(
    prisma.membershipInvitation.findFirst({ where: { email, orgId } }),
  ).resolves.toBeNull();
}
