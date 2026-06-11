import { redirect } from "next/navigation";
import { auth } from "@/auth";

const ROLE_REDIRECT: Record<string, string> = {
  super_admin: "/admin",
  admin: "/admin",
  tutor: "/tutor",
  parent: "/parent",
  student: "/student",
};

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as string;
  redirect(ROLE_REDIRECT[role] ?? "/admin");
}
