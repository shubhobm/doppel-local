import { redirect } from "next/navigation";
import { readSessionFromCookies } from "@/lib/auth";

export default async function HomePage() {
  const session = await readSessionFromCookies();
  redirect(session ? "/dashboard" : "/login");
}
