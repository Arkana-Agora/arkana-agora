"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { DeckId } from "@/types/tarot"

interface DrawnCardState {
  id: string
  cardId: string
  positionIndex: number
  isReversed: boolean
}

export type SessionStep = "deck" | "spread" | "draw" | "reveal"

interface ReadingState {
  deckId: DeckId | null
  spreadId: string | null
  cards: DrawnCardState[]
  step: SessionStep
  selectedCardIndex: number | null
}

interface ReadingActions {
  selectDeck: (deckId: DeckId) => void
  selectSpread: (spreadId: string) => void
  setCards: (cards: DrawnCardState[]) => void
  selectCard: (index: number | null) => void
  reset: () => void
}

const initialState: ReadingState = {
  deckId: null,
  spreadId: null,
  cards: [],
  step: "deck",
  selectedCardIndex: null,
}

export const useReadingStore = create<ReadingState & ReadingActions>()(
  persist(
    (set) => ({
      ...initialState,

      selectDeck: (deckId) => set({ deckId, step: "spread" }),

      selectSpread: (spreadId) => set({ spreadId, step: "draw" }),

      setCards: (cards) => set({ cards, step: "reveal" }),

      selectCard: (index) => set({ selectedCardIndex: index }),

      reset: () => set({ ...initialState }),
    }),
    {
      name: "arkana-reading-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
