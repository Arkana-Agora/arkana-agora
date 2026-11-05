export type AppNavHref =
  | "/dashboard"
  | "/feed"
  | "/tirar"
  | "/minhas-tiragens"
  | "/meu-arcano"
  | "/horoscopos/ocidental"
  | "/perfil"

export function isAppNavActive(pathname: string, href: AppNavHref): boolean {
  switch (href) {
    case "/dashboard":
      return pathname === "/dashboard"
    case "/feed":
      return pathname === "/feed" || pathname.startsWith("/feed/")
    case "/tirar":
      return pathname === "/tirar"
    case "/minhas-tiragens":
      return (
        pathname.startsWith("/minhas-tiragens") ||
        pathname.startsWith("/tiragem")
      )
    case "/meu-arcano":
      return pathname.startsWith("/meu-arcano")
    case "/horoscopos/ocidental":
      return pathname.startsWith("/horoscopos")
    case "/perfil":
      return pathname === "/perfil" || pathname.startsWith("/perfil/")
  }
}
