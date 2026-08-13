import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>
        Olá, {session.user.name ?? session.user.email} — sessão autenticada.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit">Sair</button>
      </form>
    </main>
  );
}
