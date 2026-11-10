"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { PostCard } from "@/components/social/post-card"
import { UserCard } from "@/components/social/user-card"
import { HashtagCard } from "@/components/social/hashtag-card"
import {
  useTrending,
  useTrendingHashtags,
  useExploreSuggestions,
} from "@/hooks/use-feed"

export default function ExplorePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>("trending")
  const [searchQuery, setSearchQuery] = useState("")

  const {
    data: trending,
    isLoading: trendingLoading,
    error: trendingError,
  } = useTrending()
  const {
    data: hashtags,
    isLoading: hashtagsLoading,
    error: hashtagsError,
  } = useTrendingHashtags()
  const {
    data: suggestions,
    isLoading: suggestionsLoading,
    error: suggestionsError,
  } = useExploreSuggestions()

  // Show global loading only on initial mount (no data at all)
  const isInitialLoading =
    trendingLoading &&
    !trending &&
    hashtagsLoading &&
    !hashtags &&
    suggestionsLoading &&
    !suggestions
  // Per-tab loading for when switching tabs after initial load
  const trendingTabLoading = trendingLoading && !trending
  const hashtagsTabLoading = hashtagsLoading && !hashtags
  const suggestionsTabLoading = suggestionsLoading && !suggestions

  const error = trendingError || hashtagsError || suggestionsError
  const errorMessage =
    error instanceof Error
      ? error.message
      : "Erro ao carregar dados do explorar"

  const handleSearch = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/busca?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  if (isInitialLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          <span className="sr-only">Carregando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Explorar</h1>
        <p className="text-muted-foreground mt-1">
          Descubra conteúdos, pessoas e hashtags em alta
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar posts, pessoas, hashtags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full"
          />
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
          <TabsTrigger value="trending">Em Alta</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          <TabsTrigger value="suggestions">Pessoas</TabsTrigger>
        </TabsList>

        <TabsContent value="trending">
          {trendingTabLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <span className="sr-only">Carregando posts em alta...</span>
            </div>
          ) : trending?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum post em alta no momento
            </div>
          ) : (
            <div className="space-y-4">
              {trending?.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="hashtags">
          {hashtagsTabLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <span className="sr-only">Carregando hashtags...</span>
            </div>
          ) : hashtags?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma hashtag em alta no momento
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {hashtags?.map((hashtag) => (
                <HashtagCard key={hashtag.tag} hashtag={hashtag} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggestions">
          {suggestionsTabLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <span className="sr-only">Carregando sugestões...</span>
            </div>
          ) : suggestions?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma sugestão de pessoas no momento
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions?.map((user) => (
                <UserCard key={user.id} user={user} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
