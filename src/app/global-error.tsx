"use client"

// global-error substitui o root layout inteiro (incluindo o import de CSS de
// layout.tsx) — sem este import a página de erro raiz renderiza sem estilos.
import "./globals.css"

import { RouteError, type RouteErrorProps } from "@/components/route-error"

export default function GlobalError(props: RouteErrorProps) {
  return (
    <html lang="pt-BR">
      <body>
        <RouteError {...props} />
      </body>
    </html>
  )
}
