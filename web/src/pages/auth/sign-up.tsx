import { type GetServerSideProps } from "next";
import { env } from "@/src/env.mjs";
import { getServerSideProps as getSignInServerSideProps } from "@/src/pages/auth/sign-in";

export { default } from "@/src/features/auth/SignUpPage";

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (env.AUTH_DISABLE_SIGNUP === "true") {
    // invitation emails link here, but the password form cannot work while sign-up is closed
    const search = new URL(context.resolvedUrl, "https://langfuse.invalid")
      .search;
    return {
      redirect: { destination: `/auth/sign-in${search}`, permanent: false },
    };
  }
  return getSignInServerSideProps(context);
};
