interface ProfileStatsProps {
  readingsCount?: number
  followersCount?: number
  followingCount?: number
}

function formatCount(n: number): string {
  return n.toLocaleString("pt-BR")
}

export function ProfileStats({
  readingsCount = 0,
  followersCount = 0,
  followingCount = 0,
}: ProfileStatsProps) {
  const stats = [
    { label: "Tiragens", value: readingsCount },
    { label: "Seguidores", value: followersCount },
    { label: "Seguindo", value: followingCount },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="text-2xl font-bold">{formatCount(stat.value)}</p>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}
