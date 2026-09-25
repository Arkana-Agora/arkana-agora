import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface BackLinkProps {
  href: string
  label?: string
}

export function BackLink({ href, label = "Voltar" }: BackLinkProps) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href}>
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    </Button>
  )
}
