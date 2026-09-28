// Fonte única dos métodos protegidos por CSRF — módulo sem dependências para
// ser importável pelo interceptor do cliente (api.ts) sem puxar logger/node:crypto
// para o bundle do browser. O middleware de servidor re-exporta daqui.
export const CSRF_PROTECTED_METHODS = [
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
] as const

export function needsCsrf(method: string): boolean {
  return (CSRF_PROTECTED_METHODS as readonly string[]).includes(
    method.toUpperCase(),
  )
}
