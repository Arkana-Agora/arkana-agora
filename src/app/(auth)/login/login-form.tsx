"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { signIn } from "next-auth/react";

type Status = "idle" | "loading" | "sent" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    const result = await signIn("email", {
      email,
      redirect: false,
      callbackUrl: "/dashboard",
    });
    if (result?.error) {
      setStatus("error");
      setError("Não foi possível enviar o link de acesso. Tente novamente.");
    } else {
      setStatus("sent");
    }
  }

  async function handleGoogleSignIn() {
    setStatus("loading");
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setStatus("error");
      setError("Não foi possível entrar com o Google. Tente novamente.");
    }
  }

  if (status === "sent") {
    return (
      <p>Enviamos um link de acesso para {email}. Verifique sua caixa de entrada.</p>
    );
  }

  return (
    <form onSubmit={handleEmailSubmit} style={{ display: "grid", gap: "0.75rem" }}>
      <label>
        E-mail
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@email.com"
        />
      </label>

      {status === "error" && error && <p role="alert">{error}</p>}

      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Enviando..." : "Enviar link de acesso"}
      </button>

      <button type="button" disabled={status === "loading"} onClick={handleGoogleSignIn}>
        Entrar com Google
      </button>
    </form>
  );
}
