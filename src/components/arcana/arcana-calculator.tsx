"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ArcanaCalculatorProps {
  onCalculate: (params: { name: string; birthDate: string }) => void
  isLoading?: boolean
  initialName?: string | undefined
  initialBirthDate?: string | undefined
}

export function ArcanaCalculator({
  onCalculate,
  isLoading = false,
  initialName,
  initialBirthDate,
}: ArcanaCalculatorProps) {
  const [name, setName] = useState(initialName ?? "")
  const [birthDate, setBirthDate] = useState(initialBirthDate ?? "")
  const [prevInitialName, setPrevInitialName] = useState(initialName)
  const [prevInitialBirthDate, setPrevInitialBirthDate] =
    useState(initialBirthDate)
  const [nameDirty, setNameDirty] = useState(false)
  const [birthDateDirty, setBirthDateDirty] = useState(false)

  if (initialName !== prevInitialName) {
    setPrevInitialName(initialName)
    if (!nameDirty) setName(initialName ?? "")
  }
  if (initialBirthDate !== prevInitialBirthDate) {
    setPrevInitialBirthDate(initialBirthDate)
    if (!birthDateDirty) setBirthDate(initialBirthDate ?? "")
  }

  const handleSubmit = () => {
    if (name && birthDate) {
      onCalculate({ name, birthDate })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="arcana-name">Nome</Label>
        <Input
          id="arcana-name"
          placeholder="Seu nome completo"
          value={name}
          onChange={(e) => {
            setNameDirty(true)
            setName(e.target.value)
          }}
        />
      </div>
      <div>
        <Label htmlFor="arcana-birthdate">Data de nascimento</Label>
        <Input
          id="arcana-birthdate"
          type="date"
          value={birthDate}
          onChange={(e) => {
            setBirthDateDirty(true)
            setBirthDate(e.target.value)
          }}
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!name || !birthDate || isLoading}
      >
        {isLoading ? "Calculando..." : "Calcular Arcano"}
      </Button>
    </div>
  )
}
