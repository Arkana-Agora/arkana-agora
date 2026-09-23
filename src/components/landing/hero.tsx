"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:py-32 lg:py-40">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Novo: Arcano Pessoal com IA
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Tarot, Numerologia e Astrologia{" "}
            <span className="text-primary">com IA</span> para seu
            Autoconhecimento
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            Tiragens autênticas, arcano pessoal via numerologia pitagórica e
            interpretações profundas com GPT-4o. Sua jornada de autoconhecimento
            começa aqui.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/tirar">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Fazer minha primeira tiragem
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/meu-arcano">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Descobrir meu Arcano Pessoal
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Grátis para começar · Sem cartão de crédito · Cancelamento a
            qualquer momento
          </p>
        </div>
      </div>
    </section>
  )
}
