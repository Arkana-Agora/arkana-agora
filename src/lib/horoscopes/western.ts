// Horóscopo Ocidental — SPEC-006 RF-HORO-001 + design.md §1.1/§2.1.
// Catálogo canônico de 12 signos (datas, elementos, regentes, emojis, keywords).
// Fronteiras idênticas a `src/lib/calculations/zodiac.ts` (Sprint 1).

export interface WesternSign {
  id: string // 'aries', 'touro', ...
  name: string // nome PT para exibição
  emoji: string // símbolo unicode (U+2648 …)
  element: string // 'Fogo' | 'Terra' | 'Ar' | 'Água'
  ruler: string // regente
  startDate: string // '21/03'
  endDate: string // '19/04'
  startMonth: number // 1-12
  startDay: number
  endMonth: number
  endDay: number
  keywords: string[]
}

export const WESTERN_SIGNS: readonly WesternSign[] = [
  {
    id: "aries",
    name: "Áries",
    emoji: "♈",
    element: "Fogo",
    ruler: "Marte",
    startDate: "21/03",
    endDate: "19/04",
    startMonth: 3,
    startDay: 21,
    endMonth: 4,
    endDay: 19,
    keywords: ["Coragem", "Iniciativa", "Determinação"],
  },
  {
    id: "touro",
    name: "Touro",
    emoji: "♉",
    element: "Terra",
    ruler: "Vênus",
    startDate: "20/04",
    endDate: "20/05",
    startMonth: 4,
    startDay: 20,
    endMonth: 5,
    endDay: 20,
    keywords: ["Paciência", "Segurança", "Prazer"],
  },
  {
    id: "gemeos",
    name: "Gêmeos",
    emoji: "♊",
    element: "Ar",
    ruler: "Mercúrio",
    startDate: "21/05",
    endDate: "20/06",
    startMonth: 5,
    startDay: 21,
    endMonth: 6,
    endDay: 20,
    keywords: ["Curiosidade", "Comunicação", "Versatilidade"],
  },
  {
    id: "cancer",
    name: "Câncer",
    emoji: "♋",
    element: "Água",
    ruler: "Lua",
    startDate: "21/06",
    endDate: "22/07",
    startMonth: 6,
    startDay: 21,
    endMonth: 7,
    endDay: 22,
    keywords: ["Cuidado", "Intuição", "Família"],
  },
  {
    id: "leao",
    name: "Leão",
    emoji: "♌",
    element: "Fogo",
    ruler: "Sol",
    startDate: "23/07",
    endDate: "22/08",
    startMonth: 7,
    startDay: 23,
    endMonth: 8,
    endDay: 22,
    keywords: ["Carisma", "Criatividade", "Generosidade"],
  },
  {
    id: "virgem",
    name: "Virgem",
    emoji: "♍",
    element: "Terra",
    ruler: "Mercúrio",
    startDate: "23/08",
    endDate: "22/09",
    startMonth: 8,
    startDay: 23,
    endMonth: 9,
    endDay: 22,
    keywords: ["Análise", "Perfeição", "Dedicação"],
  },
  {
    id: "libra",
    name: "Libra",
    emoji: "♎",
    element: "Ar",
    ruler: "Vênus",
    startDate: "23/09",
    endDate: "22/10",
    startMonth: 9,
    startDay: 23,
    endMonth: 10,
    endDay: 22,
    keywords: ["Harmonia", "Justiça", "Diplomacia"],
  },
  {
    id: "escorpiao",
    name: "Escorpião",
    emoji: "♏",
    element: "Água",
    ruler: "Plutão",
    startDate: "23/10",
    endDate: "21/11",
    startMonth: 10,
    startDay: 23,
    endMonth: 11,
    endDay: 21,
    keywords: ["Intensidade", "Mistério", "Transformação"],
  },
  {
    id: "sagitario",
    name: "Sagitário",
    emoji: "♐",
    element: "Fogo",
    ruler: "Júpiter",
    startDate: "22/11",
    endDate: "21/12",
    startMonth: 11,
    startDay: 22,
    endMonth: 12,
    endDay: 21,
    keywords: ["Aventura", "Otimismo", "Liberdade"],
  },
  {
    id: "capricornio",
    name: "Capricórnio",
    emoji: "♑",
    element: "Terra",
    ruler: "Saturno",
    startDate: "22/12",
    endDate: "19/01",
    startMonth: 12,
    startDay: 22,
    endMonth: 1,
    endDay: 19,
    keywords: ["Disciplina", "Ambição", "Paciência"],
  },
  {
    id: "aquario",
    name: "Aquário",
    emoji: "♒",
    element: "Ar",
    ruler: "Urano",
    startDate: "20/01",
    endDate: "18/02",
    startMonth: 1,
    startDay: 20,
    endMonth: 2,
    endDay: 18,
    keywords: ["Originalidade", "Humanidade", "Independência"],
  },
  {
    id: "peixes",
    name: "Peixes",
    emoji: "♓",
    element: "Água",
    ruler: "Netuno",
    startDate: "19/02",
    endDate: "20/03",
    startMonth: 2,
    startDay: 19,
    endMonth: 3,
    endDay: 20,
    keywords: ["Empatia", "Imaginação", "Espiritualidade"],
  },
]

export function getWesternSign(day: number, month: number): WesternSign {
  const mmdd = month * 100 + day

  for (const sign of WESTERN_SIGNS) {
    const start = sign.startMonth * 100 + sign.startDay
    const end = sign.endMonth * 100 + sign.endDay

    if (start > end) {
      // Capricórnio cruza o ano (22/12 → 19/01)
      if (mmdd >= start || mmdd <= end) return sign
    } else if (mmdd >= start && mmdd <= end) {
      return sign
    }
  }

  throw new Error("Data inválida para cálculo de signo")
}
