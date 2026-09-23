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
  flippedCards: number[]
  createdReadingId: string | null
}

interface ReadingActions {
  selectDeck: (deckId: DeckId) => void
  selectSpread: (spreadId: string) => void
  setCards: (cards: DrawnCardState[]) => void
  setCreatedReadingId: (id: string | null) => void
  selectCard: (index: number | null) => void
  setFlippedCard: (positionIndex: number) => void
  reset: () => void
}

const initialState: ReadingState = {
  deckId: null,
  spreadId: null,
  cards: [],
  step: "deck",
  selectedCardIndex: null,
  flippedCards: [],
  createdReadingId: null,
}

export const useReadingStore = create<ReadingState & ReadingActions>()(
  persist(
    (set) => ({
      ...initialState,

      selectDeck: (deckId) => set({ deckId, step: "spread" }),

      selectSpread: (spreadId) => set({ spreadId, step: "draw" }),

      setCards: (cards) => set({ cards, step: "reveal" }),

      setCreatedReadingId: (id) => set({ createdReadingId: id }),

      selectCard: (index) => set({ selectedCardIndex: index }),

      setFlippedCard: (positionIndex) =>
        set((state) => ({
          flippedCards: state.flippedCards.includes(positionIndex)
            ? state.flippedCards.filter((i) => i !== positionIndex)
            : [...state.flippedCards, positionIndex],
        })),

      reset: () => set({ ...initialState }),
    }),
    {
      name: "arkana-reading-session",
      storage:
        typeof window === "undefined"
          ? undefined
          : createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        deckId: state.deckId,
        spreadId: state.spreadId,
        cards: state.cards,
        step: state.step === "draw" ? "spread" : state.step,
        selectedCardIndex: state.selectedCardIndex,
        flippedCards: state.flippedCards,
        createdReadingId: state.createdReadingId,
      }),
    },
  ),
)
