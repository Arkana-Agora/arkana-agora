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
