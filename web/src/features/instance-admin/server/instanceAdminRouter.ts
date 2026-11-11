import * as z from "zod";
import { TRPCError } from "@trpc/server";
import {
  authenticatedProcedure,
  createTRPCRouter,
} from "@/src/server/api/trpc";
import { env } from "@/src/env.mjs";
import { escapeSqlLikePattern } from "@langfuse/shared/src/server";
import { isBootstrapInstanceOwner } from "@/src/features/instance-admin/server/instanceOwner";

// NOT_FOUND so the surface is indistinguishable from a missing route.
const instanceOwnerProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.instanceOwner !== true) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return next();
});

export const instanceAdminRouter = createTRPCRouter({
  organizations: instanceOwnerProcedure.query(async ({ ctx }) => {
    const organizations = await ctx.prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            organizationMemberships: true,
            projects: { where: { deletedAt: null } },
          },
        },
        organizationMemberships: {
          where: { role: "OWNER" },
          orderBy: { createdAt: "asc" },
          select: { user: { select: { name: true, email: true } } },
        },
      },
    });
    return organizations.map((org) => ({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      memberCount: org._count.organizationMemberships,
      projectCount: org._count.projects,
      owners: org.organizationMemberships.map((m) => m.user),
    }));
  }),

  owners: instanceOwnerProcedure.query(async ({ ctx }) => {
    const bootstrapEmail = env.LANGFUSE_INIT_INSTANCE_OWNER_EMAIL;
    const users = await ctx.prisma.user.findMany({
      where: {
        OR: [
          { instanceOwner: true },
          // The bootstrap owner needs no flag. Guarded: an empty filter here
          // would match every user.
          ...(bootstrapEmail
            ? [
                {
                  email: {
                    equals: escapeSqlLikePattern(bootstrapEmail),
                    mode: "insensitive" as const,
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true },
    });
    return users.map((user) => ({
      ...user,
      bootstrap: isBootstrapInstanceOwner(user.email),
      self: user.id === ctx.session.user.id,
    }));
  }),

  promote: instanceOwnerProcedure
    .input(z.object({ email: z.email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: { id: true },
      });
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user with this email. They need to sign in once first.",
        });
      }
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { instanceOwner: true },
      });
    }),

  demote: instanceOwnerProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own system owner access.",
        });
      }
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }
      if (isBootstrapInstanceOwner(user.email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The bootstrap system owner cannot be removed.",
        });
      }
      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { instanceOwner: false },
      });
    }),
});
