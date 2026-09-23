"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw, WifiOff } from "lucide-react"

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <WifiOff className="mx-auto h-16 w-16 text-muted-foreground" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Você está offline</h1>
          <p className="text-muted-foreground">
            Parece que você perdeu a conexão com a internet. Algumas
            funcionalidades podem não estar disponíveis.
          </p>
        </div>
        <div className="space-y-3">
          <Button onClick={() => window.location.reload()} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
          <p className="text-sm text-muted-foreground">
            Verifique sua conexão e tente recarregar a página.
          </p>
        </div>
      </div>
    </main>
  )
}
