"use client"

export function TrustIndicators() {
  return (
    <section className="border-y border-border py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-8 text-muted-foreground/60">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Grátis</span>
            <span>Para começar</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">LGPD</span>
            <span>Conformidade</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">PWA</span>
            <span>Instalável como app</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">IA</span>
            <span>Interpretações</span>
          </div>
        </div>
      </div>
    </section>
  )
}
