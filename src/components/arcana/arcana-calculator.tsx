"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ArcanaCalculatorProps {
  onCalculate: (params: { name: string; birthDate: string }) => void
  isLoading?: boolean
}

export function ArcanaCalculator({
  onCalculate,
  isLoading = false,
}: ArcanaCalculatorProps) {
  const [name, setName] = useState("")
  const [birthDate, setBirthDate] = useState("")

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
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="arcana-birthdate">Data de nascimento</Label>
        <Input
          id="arcana-birthdate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
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
