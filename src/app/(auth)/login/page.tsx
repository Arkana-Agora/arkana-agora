import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — Arkana Agora",
};

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <h1>Entrar</h1>
        <LoginForm />
      </div>
    </main>
  );
}
