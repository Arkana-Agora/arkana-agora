"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BookOpen,
  Brain,
  Shield,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react"

const FEATURES = [
  {
    icon: Sparkles,
    title: "Tiragens Autênticas",
    description:
      "Baralhos Rider-Waite, Lenormand e Thoth com algoritmos de embaralhamento certificados e semente auditável.",
  },
  {
    icon: Brain,
    title: "Interpretação com IA",
    description:
      "GPT-4o analisa suas cartas considerando seu perfil astrológico, arcano pessoal e humor do momento.",
  },
  {
    icon: BookOpen,
    title: "Arcano Pessoal",
    description:
      "Descubra seu arcano maior de nascimento via numerologia pitagórica e receba interpretação profunda.",
  },
  {
    icon: Users,
    title: "Comunidade Vertical",
    description:
      "Compartilhe tiragens, siga leitores favoritos e participe de discussões temáticas moderadas.",
  },
  {
    icon: Shield,
    title: "Privacidade LGPD",
    description:
      "Seus dados são seus. Exclusão garantida em 30 dias, anonimato opcional, sem venda de dados.",
  },
  {
    icon: Smartphone,
    title: "PWA Offline",
    description:
      "Instale como app, acesse tiragens salvas offline e receba notificações push do tarô do dia.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tudo que você precisa para sua jornada
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Ferramentas autênticas, tecnologia moderna e comunidade acolhedora.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card
              key={feature.title}
              className="h-full transition-shadow hover:shadow-lg"
            >
              <CardHeader>
                <feature.icon
                  className="mx-auto h-10 w-10 text-primary"
                  aria-hidden="true"
                />
                <CardTitle className="text-center">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
