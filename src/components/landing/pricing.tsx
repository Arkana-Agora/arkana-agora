"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import Link from "next/link"

const PRICING = [
  {
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    features: [
      "3 tiragens por dia",
      "10 interpretações IA por dia",
      "Arcano pessoal ilimitado",
      "Acesso à comunidade",
      "PWA offline básico",
    ],
    cta: "Começar grátis",
    href: "/tirar",
    popular: false,
    disabled: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Um plano simples e transparente
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Grátis para sempre. Sem surpresas.
          </p>
        </div>
        <div className="mx-auto max-w-md">
          <Card className="relative h-full">
            <CardHeader className="text-center">
              <CardTitle>Free</CardTitle>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">R$ 0</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {PRICING?.[0]?.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/tirar">
                <Button className="w-full" size="lg">
                  Começar grátis
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Mais recursos chegando em breve.
        </p>
      </div>
    </section>
  )
}
