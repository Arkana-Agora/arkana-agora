"use client"

import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <h3 className="font-semibold">Arkana Agora</h3>
            <p className="text-sm text-muted-foreground">
              Tarot, Lenormand, numerologia e astrologia com IA para
              autoconhecimento.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Twitter"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
                </svg>
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Instagram"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Discord"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.38-.44.864-.608 1.25a18.27 18.27 0 0 0-5.062 0 11.65 11.65 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58 0 18.107a.077.077 0 0 0 .023.055 19.9 19.9 0 0 0 3.604 4.2 19.79 19.79 0 0 0 3.843.32.074.074 0 0 0 .078-.037c.391-.61.877-1.384 1.28-2.19a.076.076 0 0 1 .082-.005c.53.31 1.092.58 1.673.782a17.392 17.392 0 0 0 2.634 0c.57-.19 1.134-.462 1.662-.77.084.024.17.024.258 0 .362.597.84 1.36 1.28 2.19a.074.074 0 0 0 .079.037 19.736 19.736 0 0 0 3.845-.32.077.077 0 0 0 .023-.055c-.309-4.75-1.162-9.1-1.3-13.874a.061.061 0 0 0-.031-.03z" />
                  <circle cx="10" cy="15" r="1" />
                  <circle cx="14" cy="15" r="1" />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Produto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/tirar"
                  className="hover:text-foreground transition-colors"
                >
                  Fazer Tiragem
                </Link>
              </li>
              <li>
                <Link
                  href="/meu-arcano"
                  className="hover:text-foreground transition-colors"
                >
                  Arcano Pessoal
                </Link>
              </li>
              <li>
                <Link
                  href="/minhas-tiragens"
                  className="hover:text-foreground transition-colors"
                >
                  Minhas Tiragens
                </Link>
              </li>
              <li>
                <Link
                  href="/perfil"
                  className="hover:text-foreground transition-colors"
                >
                  Perfil
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="#"
                  className="hover:text-foreground transition-colors"
                >
                  Sobre nos
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-foreground transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-foreground transition-colors"
                >
                  Carreiras
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-foreground transition-colors"
                >
                  Imprensa
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/perfil/privacidade"
                  className="hover:text-foreground transition-colors"
                >
                  Politica de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-foreground transition-colors"
                >
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-foreground transition-colors"
                >
                  Politica de Cookies
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-foreground transition-colors"
                >
                  Seus Direitos LGPD
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-center text-sm text-muted-foreground">
            Ac {new Date().getFullYear()} Arkana Agora. Todos os direitos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
