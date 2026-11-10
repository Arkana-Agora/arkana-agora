"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search as SearchIcon, X } from "lucide-react"
import { PostCard } from "@/components/social/post-card"
import { UserCard } from "@/components/social/user-card"
import { HashtagCard } from "@/components/social/hashtag-card"
import { useSearch } from "@/hooks/use-feed"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get("q") ?? ""

  const [activeTab, setActiveTab] = useState<string>("posts")
  const { data, isLoading, error } = useSearch(query)

  const handleSearch = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = formData.get("q")?.toString().trim() ?? ""
    if (q.length >= 2) {
      router.push(`/busca?q=${encodeURIComponent(q)}`)
    }
  }

  const clearSearch = () => {
    router.push("/busca")
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          <span className="sr-only">Carregando...</span>
        </div>
      </div>
    )
  }

  const posts = data?.posts ?? []
  const users = data?.users ?? []
  const hashtags = data?.hashtags ?? []
  const hasResults = posts.length > 0 || users.length > 0 || hashtags.length > 0
  const errorMessage = error instanceof Error ? error.message : "Erro ao buscar"

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Busca</h1>
        <p className="text-muted-foreground mt-1">
          Encontre posts, pessoas e hashtags
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8 relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <div className="flex gap-2">
          <Input
            placeholder="Buscar posts, pessoas, hashtags..."
            defaultValue={query}
            name="q"
            className="pl-10 flex-1"
            minLength={2}
            maxLength={50}
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpar busca"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="posts">
            Posts
            <span className="ml-2 px-2 py-0.5 text-xs bg-muted rounded-full">
              {posts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="users">
            Pessoas
            <span className="ml-2 px-2 py-0.5 text-xs bg-muted rounded-full">
              {users.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="hashtags">
            Hashtags
            <span className="ml-2 px-2 py-0.5 text-xs bg-muted rounded-full">
              {hashtags.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          {posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum post encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="users">
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum usu&aacute;rio encontrado
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((user) => (
                <UserCard key={user.id} user={user} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="hashtags">
          {hashtags.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma hashtag encontrada
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {hashtags.map((hashtag) => (
                <HashtagCard key={hashtag.tag} hashtag={hashtag} />
              ))}
            </div>
          )}
        </TabsContent>

        {!hasResults && !isLoading && query.length >= 2 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum resultado encontrado para {query}
          </div>
        )}

        {!hasResults && !isLoading && query.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Digite pelo menos 2 caracteres para buscar
          </div>
        )}
      </Tabs>
    </div>
  )
}
