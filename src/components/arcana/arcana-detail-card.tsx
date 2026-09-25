import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ArcanaData } from "@/data/arcana"

const ROMAN_NUMERALS: Record<number, string> = {
  0: "0",
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "XI",
  12: "XII",
  13: "XIII",
  14: "XIV",
  15: "XV",
  16: "XVI",
  17: "XVII",
  18: "XVIII",
  19: "XIX",
  20: "XX",
  21: "XXI",
  22: "XXII",
}

interface ArcanaDetailCardProps {
  arcana: ArcanaData
}

export function ArcanaDetailCard({ arcana }: ArcanaDetailCardProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <p className="text-sm text-muted-foreground">
          {ROMAN_NUMERALS[arcana.number] ?? arcana.number}
        </p>
        <CardTitle className="text-2xl">{arcana.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-sm">Significado</h4>
          <p className="text-sm text-muted-foreground">{arcana.upright}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm">Invertido</h4>
          <p className="text-sm text-muted-foreground">{arcana.reversed}</p>
        </div>
        <div className="flex gap-4">
          <div>
            <h4 className="font-semibold text-sm">Elemento</h4>
            <p className="text-sm text-muted-foreground">{arcana.element}</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm">Planeta</h4>
            <p className="text-sm text-muted-foreground">{arcana.planet}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
