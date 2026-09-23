export function reduceToArcana(n: number): number {
  const abs = Math.abs(n)
  let result = abs
  while (result > 22) {
    result = result
      .toString()
      .split("")
      .reduce((sum, d) => sum + Number(d), 0)
  }
  return result === 0 ? 22 : result
}

export function explainReduction(n: number): string {
  const abs = Math.abs(n)
  const steps: string[] = [String(abs)]
  let result = abs
  while (result > 22) {
    const next = result
      .toString()
      .split("")
      .reduce((sum, d) => sum + Number(d), 0)
    steps.push(String(next))
    result = next
  }
  if (result === 0) {
    steps.push("22")
    result = 22
  }
  return steps.join(" → ")
}
