import { prisma } from "@langfuse/shared/src/db";
import { env } from "@/src/env.mjs";

type InstanceOwnerCandidate = {
  email: string | null;
  instanceOwner: boolean;
};

/** The bootstrap owner from the environment; cannot be demoted. */
export function isBootstrapInstanceOwner(email: string | null): boolean {
  const bootstrapEmail = env.LANGFUSE_INIT_INSTANCE_OWNER_EMAIL;
  return (
    !!bootstrapEmail &&
    !!email &&
    email.toLowerCase() === bootstrapEmail.toLowerCase()
  );
}

export function isInstanceOwner(user: InstanceOwnerCandidate | null): boolean {
  if (!user) return false;
  return user.instanceOwner || isBootstrapInstanceOwner(user.email);
}

/**
 * Synthetic OWNER memberships for every organization an instance owner does
 * not already reach, in the shape of the session's membership list.
 */
export async function getInstanceOwnerMemberships(
  user: InstanceOwnerCandidate | null,
  excludedOrgIds: string[],
) {
  if (!isInstanceOwner(user)) return [];

  // shortcut: loads every organization and project on each session read,
  // paginate or cache once the instance has hundreds of organizations
  const organizations = await prisma.organization.findMany({
    where: { id: { notIn: excludedOrgIds } },
    orderBy: { createdAt: "desc" },
    include: {
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return organizations.map((organization) => ({
    organization,
    role: "OWNER" as const,
    ProjectMemberships: [],
    instanceOwnerAccess: true as const,
  }));
}
