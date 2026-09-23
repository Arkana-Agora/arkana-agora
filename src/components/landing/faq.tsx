"use client"

const FAQ = [
  {
    q: "O que é o Arkana Agora?",
    a: "Uma plataforma brasileira de tarot, Lenormand, numerologia e astrologia com interpretações via IA, focada em autoconhecimento e comunidade.",
  },
  {
    q: "A IA substitui leitores humanos?",
    a: "Não. A IA oferece interpretações baseadas em tradições esotéricas consolidadas. Para aconselhamento profundo, recomendamos consultar profissionais verificados na plataforma.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Seguimos a LGPD rigorosamente. Seus dados são criptografados, você controla o que compartilha e pode solicitar exclusão completa a qualquer momento.",
  },
  {
    q: "Como funciona o arcano pessoal?",
    a: "Baseado na numerologia pitagórica: soma dos dígitos da data de nascimento + valor das letras do nome (tabela pitagórica), reduzido a 1-22 (arcanos maiores).",
  },
  {
    q: "Posso usar offline?",
    a: "Sim! O Arkana Agora é um PWA. Instale no celular e acesse suas tiragens salvas e arcano pessoal mesmo sem internet.",
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Perguntas frequentes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Tudo que você precisa saber antes de começar.
          </p>
        </div>
        <div className="mx-auto max-w-3xl space-y-4">
          {FAQ.map((item, index) => (
            <details
              key={index}
              className="group rounded-lg border border-border bg-background p-6"
            >
              <summary className="flex cursor-pointer items-center justify-between text-left font-medium list-none">
                {item.q}
                <svg
                  className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="mt-4 text-muted-foreground">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
