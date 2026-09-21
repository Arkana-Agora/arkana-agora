import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ProfileAstrologyProps {
  sunSign?: string | null
  personalArcana?: number | null
  kinMaya?: string | null
}

const ARCANA_NAMES: Record<number, string> = {
  1: "O Mago",
  2: "A Sacerdotisa",
  3: "A Imperatriz",
  4: "O Imperador",
  5: "O Hierofante",
  6: "Os Amantes",
  7: "O Carro",
  8: "A Força",
  9: "O Eremita",
  10: "A Roda da Fortuna",
  11: "A Justiça",
  12: "O Enforcado",
  13: "A Morte",
  14: "A Temperança",
  15: "O Diabo",
  16: "A Torre",
  17: "A Estrela",
  18: "A Lua",
  19: "O Sol",
  20: "O Julgamento",
  21: "O Mundo",
  22: "O Louco",
}

export function ProfileAstrology({
  sunSign,
  personalArcana,
  kinMaya,
}: ProfileAstrologyProps) {
  if (!sunSign && !personalArcana && !kinMaya) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Astrologia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sunSign && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Signo solar</span>
            <span className="font-medium">{sunSign}</span>
          </div>
        )}
        {personalArcana && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Arcano pessoal</span>
            <span className="font-medium">
              {personalArcana} —{" "}
              {ARCANA_NAMES[personalArcana] ?? "Desconhecido"}
            </span>
          </div>
        )}
        {kinMaya && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kin Maya</span>
            <span className="font-medium">{kinMaya}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
