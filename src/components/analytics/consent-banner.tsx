"use client"

import { Shield, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useSyncExternalStore, useState } from "react"

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  setAnalyticsConsent,
} from "@/lib/analytics"

function subscribeConsent(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener("arkana-consent", callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener("arkana-consent", callback)
  }
}

function getConsentSnapshot(): string | null {
  return localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)
}

function getServerConsentSnapshot(): string | null {
  return null
}

function emitConsentChange() {
  window.dispatchEvent(new Event("arkana-consent"))
}

export function AnalyticsConsentBanner() {
  const stored = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot,
  )
  const consent = stored === null ? null : stored === "true"
  const [view, setView] = useState<"auto" | "open" | "closed">("auto")
  const [manualOverride, setManualOverride] = useState<boolean | null>(null)

  // Prefer explicit switch interactions; otherwise hydrate from stored consent
  // when the dialog is visible (reopening reflects the saved decision).
  const isOpen = view === "open" || (view === "auto" && consent === null)
  const analyticsEnabled = manualOverride ?? consent === true

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView("closed")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen])

  const openDialog = () => {
    setManualOverride(null)
    setView("open")
  }

  const applyConsent = (value: boolean) => {
    setAnalyticsConsent(value)
    emitConsentChange()
    setView("closed")
    setManualOverride(null)
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-20 right-4 z-50 md:bottom-4">
        <button
          className="gap-1 inline-flex items-center px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
          onClick={openDialog}
        >
          <Shield className="h-4 w-4 text-primary" />
          Preferências de Analytics
        </button>
      </div>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setView("closed")}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-4 right-4 left-4 md:right-4 md:left-auto md:w-96 z-50 bg-background rounded-xl border border-border shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-consent-title"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3
                id="analytics-consent-title"
                className="text-lg font-semibold"
              >
                Preferências de Analytics
              </h3>
              <p className="text-sm text-muted-foreground">
                Respeitamos sua privacidade. Escolha como queremos usar seus
                dados.
              </p>
            </div>
          </div>
          <button
            onClick={() => setView("closed")}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium">Analytics de Uso</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Coletamos dados anônimos sobre como você usa o app para
                  melhorar a experiência. Inclui: páginas visitadas, ações
                  realizadas, tempo de sessão.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={analyticsEnabled}
                  onChange={(e) => setManualOverride(e.target.checked)}
                  aria-label="Ativar analytics de uso"
                />
                <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:border-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all peer-focus:ring-offset-2"></div>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium">Cookies Funcionais</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Necessários para o funcionamento do site: autenticação,
                  preferências, segurança. Não podem ser desativados.
                </p>
              </div>
              <span className="w-11 h-6 bg-primary rounded-full relative">
                <span className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow" />
              </span>
            </div>
          </div>

          <div className="pt-4 border-t flex gap-2">
            <button
              onClick={() => applyConsent(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Rejeitar Analytics
            </button>
            <button
              onClick={() => applyConsent(analyticsEnabled)}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              {analyticsEnabled
                ? "Salvar com Analytics"
                : consent === null
                  ? "Salvar preferências"
                  : "Salvar sem Analytics"}
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Você pode alterar suas preferências a qualquer momento clicando no
            ícone de escudo no canto inferior direito.
            <br />
            <Link
              href="/perfil/privacidade"
              className="underline hover:text-primary"
            >
              Leia nossa Política de Privacidade
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
