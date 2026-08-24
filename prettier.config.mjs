/**
 * Prettier — estilo do repo (align com o código existente do esqueleto).
 * Sem ponto-e-vírgula (estilo dominante: shadcn/ui + Next.js moderno);
 * aspas duplas; vírgula final em arrays/objetos/args.
 *
 * Export pattern: const+export (melhor suporte TypeScript que anonymous object export).
 */

const config = {
  semi: false,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
}
export default config
