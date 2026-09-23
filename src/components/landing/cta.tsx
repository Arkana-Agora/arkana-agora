"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-20 lg:py-28 bg-primary text-primary-foreground">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Pronto para começar sua jornada?
        </h2>
        <p className="mt-4 text-lg opacity-90">
          Junte-se a milhares de pessoas que já usam o Arkana Agora para
          autoconhecimento diário.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/tirar">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2"
            >
              Começar grátis agora
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/meu-arcano">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
            >
              Ver meu Arcano Pessoal
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
