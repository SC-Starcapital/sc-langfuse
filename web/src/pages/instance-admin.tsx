import { type GetServerSideProps } from "next";

import { InstanceAdminPage } from "@/src/features/instance-admin/components/InstanceAdminPage";
import { getServerAuthSession } from "@/src/server/auth";

export default function InstanceAdmin() {
  return <InstanceAdminPage />;
}

// Everyone but an instance owner gets the same 404 as a missing route.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerAuthSession({ req: ctx.req, res: ctx.res });
  if (session?.user?.instanceOwner !== true) return { notFound: true };
  return { props: {} };
};
