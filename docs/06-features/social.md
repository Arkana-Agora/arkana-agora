# Rede Social — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Rede Social | **Versão**: V1

---

## Descrição

O módulo de Rede Social do **Arkana Agora** transforma a plataforma em uma comunidade viva de entusiastas de esoterismo, Tarot e autoconhecimento. O feed de notícias utiliza um algoritmo de distribuição em três camadas: primeiro, publicações de usuários seguidos; em seguida, leituras e conteúdos em alta (trending); por fim, sugestões de novos criadores e profissionais. Esse modelo garante relevância e descoberta simultaneamente.

O sistema de publicações suporta texto livre, compartilhamento de leituras salvas (com visualização inline do baralho) e upload de imagens. A interação é composta por likes, comentários encadeados e envio de presentes virtuais. A página Explorar oferece curadoria de conteúdos populares, profissionais em destaque e temas esotéricos em tendência. Mecanismos de moderação incluem denúncias de conteúdo e bloqueio de usuários, com revisão pela equipe administrativa.

---

## Funcionalidades

- **Seguir/deixar de seguir** usuários
- **Feed timeline** com algoritmo de três camadas (seguindo → trending → sugeridos)
- **Criação de publicações** com texto, compartilhamento de leitura e imagens (até 4 por post)
- **Sistema de likes** com contagem e lista de curtidores
- **Comentários encadeados** (até 3 níveis de profundidade)
- **Página Explorar** com seções: Leituras em Alta, Top Profissionais, Temas em Tendência
- **Denunciar conteúdo** (categorização: spam, assédio, conteúdo inadequado, outro)
- **Bloquear usuário** (oculta mútuo, sem notificação)
- **Compartilhamento de leitura** inline nas publicações

---

## Algoritmo do Feed

```
1. Posts de usuários seguidos (ordenado por data, peso: 1.0)
2. Leituras em alta (engajamento nas últimas 24h, peso: 0.7)
3. Conteúdos sugeridos (baseado em interesses do perfil, peso: 0.4)

Score final = peso × recency_score × engagement_score
recency_score = 1 / (horas_desde_publicacao + 1)
engagement_score = (likes × 1) + (comments × 3) + (shares × 5)
```

---

## Fluxo Principal

1. O usuário acessa o feed na tela inicial da aba "Comunidade"
2. O sistema carrega as publicações seguindo o algoritmo de três camadas
3. O usuário rola a tela para carregar mais conteúdo (scroll infinito)
4. O usuário pode curtir, comentar ou compartilhar qualquer publicação
5. O usuário pode criar uma nova publicação tocando no botão "Publicar"
6. Na criação, o usuário digita o texto, opcionalmente anexa imagens ou compartilha uma leitura salva
7. A publicação é exibida no feed dos seguidores e, se com alto engajamento, no Explorar
8. O usuário pode denunciar ou bloquear outros usuários a qualquer momento
9. O usuário pode acessar a aba "Explorar" para descobrir novos conteúdos e perfis

---

## Versão

| Feature | Versão |
|---|---|
| Feed timeline básico | V1 |
| Seguir/deixar de seguir | V1 |
| Publicações (texto + leitura + imagens) | V1 |
| Likes e comentários | V1 |
| Página Explorar | V1 |
| Denúncia e bloqueio | V1 |
| Stories/destaques temporários | V2 |
| Grupos e comunidades | V2 |
| Mensagens diretas | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário deve estar autenticado |
| Perfil | Módulo interno | Dados do perfil para feed |
| Tarot / Lenormand | Módulo interno | Compartilhamento de leituras |
| Presentes | Módulo interno | Envio de presentes em posts |
| Armazenamento de arquivos | Infraestrutura | Upload de imagens |
| Moderação (Admin) | Módulo interno | Revisão de denúncias |

---

## Critérios de Aceite

- **CA-01**: O feed deve carregar a primeira tela de conteúdo em menos de 2 segundos, com imagens lazy-loaded
- **CA-02**: O algoritmo deve priorizar publicações de seguidos em pelo menos 60% da primeira tela de novos usuários
- **CA-03**: Uma publicação com imagem deve ser criada e exibida no feed em menos de 5 segundos
- **CA-04**: O sistema de denúncias deve encaminhar o conteúdo para a fila de moderação em menos de 1 segundo e enviar confirmação ao denunciante
- **CA-05**: O bloqueio de um usuário deve ocultar suas publicações imediatamente em todas as visualizações do bloqueador, sem notificação ao bloqueado