import { redirect } from "next/navigation";
import { readSessionFromCookies } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const session = await readSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="shell stack">
      <ForgotPasswordForm />
    </main>
  );
}
