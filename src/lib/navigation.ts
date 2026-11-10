export type AppNavHref =
  "/feed" | "/explorar" | "/notificacoes" | "/presentes" | "/perfil"

export function isAppNavActive(pathname: string, href: AppNavHref): boolean {
  switch (href) {
    case "/feed":
      return pathname === "/feed" || pathname.startsWith("/feed/")
    case "/explorar":
      return pathname === "/explorar" || pathname.startsWith("/busca")
    case "/notificacoes":
      return pathname === "/notificacoes"
    case "/presentes":
      return pathname === "/presentes" || pathname.startsWith("/presentes/")
    case "/perfil":
      return pathname === "/perfil" || pathname.startsWith("/perfil/")
  }
}
