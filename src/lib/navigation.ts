export type AppNavHref =
  "/dashboard" | "/tirar" | "/minhas-tiragens" | "/meu-arcano" | "/perfil"

export function isAppNavActive(pathname: string, href: AppNavHref): boolean {
  switch (href) {
    case "/dashboard":
      return pathname === "/dashboard"
    case "/tirar":
      return pathname === "/tirar"
    case "/minhas-tiragens":
      return (
        pathname.startsWith("/minhas-tiragens") ||
        pathname.startsWith("/tiragem")
      )
    case "/meu-arcano":
      return pathname.startsWith("/meu-arcano")
    case "/perfil":
      return pathname === "/perfil" || pathname.startsWith("/perfil/")
  }
}
