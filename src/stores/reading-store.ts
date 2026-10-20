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

export type SessionStep = "deck" | "spread" | "question" | "draw" | "reveal"

interface ReadingState {
  deckId: DeckId | null
  spreadId: string | null
  cards: DrawnCardState[]
  step: SessionStep
  selectedCardIndex: number | null
  flippedCards: number[]
  createdReadingId: string | null
  question: string
}

interface ReadingActions {
  selectDeck: (deckId: DeckId) => void
  selectSpread: (spreadId: string) => void
  setQuestion: (question: string) => void
  startDraw: () => void
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
  question: "",
}

export const useReadingStore = create<ReadingState & ReadingActions>()(
  persist(
    (set) => ({
      ...initialState,

      selectDeck: (deckId) => set({ deckId, step: "spread" }),

      selectSpread: (spreadId) => set({ spreadId, step: "question" }),

      setQuestion: (question) => set({ question }),

      startDraw: () => set({ step: "draw" }),

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
        // "draw" é transiente (auto-run) → persiste como "question" para o
        // reload não re-disparar o sorteio sem o usuário confirmar.
        step: state.step === "draw" ? "question" : state.step,
        selectedCardIndex: state.selectedCardIndex,
        flippedCards: state.flippedCards,
        createdReadingId: state.createdReadingId,
        question: state.question,
      }),
    },
  ),
)
