import { redirect } from "next/navigation";
import { readSessionFromCookies } from "@/lib/auth";

export default async function ForgotPasswordPage() {
  const session = await readSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  redirect("/change-password");
}
