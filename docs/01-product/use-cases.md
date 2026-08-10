# Casos de Uso -- Arkana Agora

Casos de uso detalhados do projeto `arkana-agora` com atores, pre-condicoes, fluxo principal, fluxos alternativos e pos-condicoes.

---

## UC-001: Tiragem de Tarot Completa

### Metadados

| Campo | Valor |
|-------|-------|
| **ID** | UC-001 |
| **Nome** | Tiragem de Tarot Completa |
| **Ator Primario** | Usuario |
| **Ator Secundario** | Sistema de IA (GPT-4o) |
| **Versao** | MVP |

### Pre-condicoes

- O usuario esta autenticado
- O usuario possui cota de tiragem disponivel (RF-013)
- A data do usuario esta cadastrada

### Fluxo Principal

1. O usuario acessa a tela de tiragem
2. O sistema exibe a lista de espalhamentos disponiveis
3. O usuario seleciona o espalhamento "Passado/Presente/Futuro" (3 cartas)
4. O sistema exibe a descricao do espalhamento com as 3 posicoes
5. O usuario (opcionalmente) digita uma pergunta no campo de texto
6. O usuario toca em "Iniciar Tiragem"
7. O sistema distribui 3 cartas viradas (face para baixo) nas posicoes
8. O usuario toca na primeira carta
9. O sistema revela a carta com animacao de 1,5 segundo (ex.: "O Louco, erecto")
10. O usuario toca na segunda carta
11. O sistema revela a segunda carta com animacao (ex.: "A Estrela, invertida")
12. O usuario toca na terceira carta
13. O sistema revela a terceira carta com animacao (ex.: "O Sol, erecto")
14. O sistema habilita o botao "Solicitar Leitura IA"
15. O usuario toca em "Solicitar Leitura IA"
16. O sistema envia as cartas + posicoes + pergunta para a IA via SSE
17. O sistema exibe o texto da interpretacao em streaming
18. O usuario le a interpretacao
19. O sistema salva a tiragem no historico
20. O usuario pode salvar como favorita ou compartilhar

### Fluxos Alternativos

**FA-001: Cota esgotada**
- No passo 6, se o usuario nao possui cota, o sistema exibe modal informando o limite e sugerindo upgrade para Plus
- O usuario pode: assinar Plus, ou aguardar o reset diario

**FA-002: Sessao expirada**
- Se o usuario ficar inativo por 30 minutos apos o passo 7, o sistema notifica que a sessao expirou
- A tiragem e descartada sem consumir cota

**FA-003: Erro na IA**
- No passo 16, se a IA nao responde em 30 segundos, o sistema exibe mensagem de erro e oferece "Tentar novamente"
- Se o erro persistir, o sistema oferece gerar leitura basica (sem IA, baseada em textos pre-definidos)

### Pos-condicoes

- A tiragem esta salva no historico do usuario
- A cota diaria do usuario e decrementada em 1
- Se o usuario compartilhou, o verso aparece no feed (V1)

---

## UC-002: Leitura via IA (Streaming)

### Metadados

| Campo | Valor |
|-------|-------|
| **ID** | UC-002 |
| **Nome** | Leitura via IA com Streaming |
| **Ator Primario** | Sistema |
| **Ator Secundario** | GPT-4o (z-ai-web-dev-sdk) |
| **Versao** | MVP |

### Pre-condicoes

- Uma tiragem foi realizada (UC-001, passo 13)
- O usuario possui cota de leitura IA disponivel
- O servico z-ai-web-dev-sdk esta disponivel

### Fluxo Principal

1. O usuario toca em "Solicitar Leitura IA"
2. O sistema coleta os dados da tiragem: cartas, posicoes, espalhamento, pergunta
3. O sistema recupera o perfil do usuario: Arcano Pessoal, signo, data de nascimento
4. O sistema constroi o prompt com todos os contextos
5. O sistema abre conexao SSE com o endpoint de IA
6. A IA comeca a gerar tokens
7. O sistema envia cada token ao cliente via SSE
8. O cliente renderiza o texto progressivamente na tela
9. Quando a IA finaliza, o sistema envia evento de conclusao
10. O cliente exibe botoes de acao (salvar, compartilhar, regenerar)

### Fluxos Alternativos

**FA-001: Timeout do servidor IA**
- Se nao houver resposta em 15 segundos apos a conexao, o sistema cancela e tenta novamente
- Se falhar 2 vezes, exibe leitura basica pre-definida como fallback

**FA-002: Conexao interrompida pelo cliente**
- Se o usuario navegar para outra pagina durante o streaming, o cliente fecha a conexao SSE
- Quando o usuario retornar a tiragem, o sistema verifica se a leitura foi completa
- Se incompleta, permite retomar ou regenerar

**FA-003: Rate limit da API de IA**
- Se a API retornar 429 (rate limit), o sistema enfileira a requisicao e tenta em ate 60 segundos
- O usuario ve indicador de "Gerando leitura, aguarde..."

### Pos-condicoes

- O texto completo da interpretacao esta salvo no banco de dados vinculado a tiragem
- O usuario visualizou a leitura completa

---

## UC-003: Calculo de Arcano Pessoal

### Metadados

| Campo | Valor |
|-------|-------|
| **ID** | UC-003 |
| **Nome** | Calculo de Arcano Pessoal |
| **Ator Primario** | Sistema |
| **Versao** | MVP |

### Pre-condicoes

- O usuario informou a data de nascimento completa (DD/MM/AAAA)

### Fluxo Principal

1. O usuario acessa a pagina de Arcano Pessoal
2. O sistema verifica se o arcano pessoal ja esta calculado e salvo
3. **Se nao:** o sistema soma todos os digitos da data de nascimento
   - Exemplo: 15/03/1992 = 1+5+0+3+1+9+9+2 = 30
4. O sistema reduz o resultado a um digito unico
   - 30 = 3+0 = **3**
5. O sistema verifica se o resultado e um Numero Mestre (11, 22, 33)
   - Se sim, preserva o valor
6. O sistema mapeia o resultado para o Arcano Maior correspondente
   - 3 = "A Imperatriz (III)"
7. O sistema salva o resultado no perfil do usuario
8. O sistema exibe: numero, nome do Arcano, imagem da carta, resumo do significado

### Fluxos Alternativos

**FA-001: Resultado maior que 21**
- Se a soma reduzida for maior que 21, o sistema continua reduzindo
- Exemplo: 29 = 2+9 = 11 (Numero Mestre, preservado)

**FA-002: Data de nascimento ausente**
- Se o usuario nao informou a data, o sistema solicita o preenchimento
- Apos o preenchimento, o calculo e executado automaticamente

### Pos-condicoes

- O Arcano Pessoal esta armazenado no perfil do usuario
- O valor e exibido no perfil publico

---

## UC-004: Consulta Kin Maya

### Metadados

| Campo | Valor |
|-------|-------|
| **ID** | UC-004 |
| **Nome** | Consulta Kin Maya |
| **Ator Primario** | Usuario |
| **Ator Secundario** | Sistema de IA |
| **Versao** | V1 |

### Pre-condicoes

- O usuario informou a data de nascimento
- O modulo de Kin Maya esta ativo (V1+)

### Fluxo Principal

1. O usuario acessa a secao "Kin Maya" no menu
2. O sistema calcula a diferenca em dias entre a data de nascimento e 26/07/1954
3. O sistema aplica modulo 260: `Kin = (diferenca_dias % 260) + 1`
4. O sistema calcula Selo Solar: `((Kin - 1) % 20) + 1`
5. O sistema calcula Tom Galactico: `((Kin - 1) % 13) + 1`
6. O sistema busca os nomes correspondentes na base de dados
7. O sistema exibe: numero do Kin, nome completo (ex.: "Kin 147 - Vento Eletrico"), Selo Solar, Tom Galactico
8. O usuario pode solicitar interpretacao IA
9. O sistema gera interpretacao contextualizada via streaming

### Fluxos Alternativos

**FA-001: Data antes da referencia**
- Se a data de nascimento for anterior a 26/07/1954, a diferenca em dias sera negativa
- O sistema normaliza: aplica modulo 260 ao valor absoluto e subtrai de 260

### Pos-condicoes

- O Kin Maya esta calculado e exibido
- Se solicitada, a interpretacao IA esta salva no perfil

---

## UC-005: Horoscopo do Dia

### Metadados

| Campo | Valor |
|-------|-------|
| **ID** | UC-005 |
| **Nome** | Horoscopo do Dia |
| **Ator Primario** | Usuario |
| **Ator Secundario** | Sistema de IA |
| **Versao** | MVP |

### Pre-condicoes

- O usuario esta autenticado
- O signo zodiacal do usuario esta definido (data de nascimento informada)

### Fluxo Principal

1. O usuario acessa a tela inicial ou a secao de horoscopos
2. O sistema determina o signo do usuario pela data de nascimento
3. O sistema verifica se ja existe horoscopo do dia em cache para o signo
4. **Se nao existe cache:** o sistema solicita geracao de horoscopo a IA
5. A IA gera o texto com base no signo, posicoes planetarias atuais e data atual
6. O sistema armazena o horoscopo em cache (validade: ate meia-noite de Brasilia)
7. O sistema exibe o horoscopo na tela

### Fluxos Alternativos

**FA-001: Signo nao definido**
- Se o usuario nao informou data de nascimento, o sistema solicita o preenchimento
- Apos o preenchimento, redireciona para o horoscopo

**FA-002: IA indisponivel**
- Se a IA nao consegue gerar o horoscopo, o sistema exibe horoscopo pre-definido do dia (texto generico por signo)

### Pos-condicoes

- O usuario visualizou o horoscopo do dia
- O horoscopo esta em cache para outros usuarios do mesmo signo

---

## UC-006: Compra no Marketplace

### Metadados

| Campo | Valor |
|-------|-------|
| **ID** | UC-006 |
| **Nome** | Compra no Marketplace |
| **Ator Primario** | Usuario (comprador) |
| **Ator Secundario** | Mercado Pago, Profissional, Sistema |
| **Versao** | V1 |

### Pre-condicoes

- O usuario esta autenticado
- O profissional esta verificado e ativo
- O servico esta publicado e disponivel

### Fluxo Principal

1. O usuario acessa o marketplace
2. O usuario navega e encontra um servico de interesse
3. O usuario clica em "Ver Detalhes"
4. O sistema exibe: descricao, preco, avaliacoes, tempo estimado
5. O usuario clica em "Contratar"
6. O sistema cria um pedido com status "PENDENTE_PAGAMENTO"
7. O sistema redireciona ao checkout do Mercado Pago
8. O usuario realiza o pagamento (cartao, PIX ou boleto)
9. O Mercado Pago envia webhook de confirmacao
10. O sistema atualiza o pedido para "PAGO"
11. O profissional recebe notificacao de novo pedido
12. O profissional realiza o atendimento
13. O profissional marca o pedido como "CONCLUIDO"
14. O sistema solicita avaliacao ao comprador
15. O comprador avalia (nota + comentario)
16. O sistema libera o valor ao profissional (taxa de 15% ja descontada)

### Fluxos Alternativos

**FA-001: Pagamento recusado**
- No passo 8, se o pagamento falhar, o pedido permanece "PENDENTE_PAGAMENTO"
- O usuario pode tentar novamente em ate 24 horas
- Apos 24 horas sem pagamento, o pedido e cancelado automaticamente

**FA-002: Dispute aberta**
- Apos o passo 13, se o comprador abrir dispute em ate 7 dias, o valor e retido
- O admin analisa a dispute e decide: liberar para o profissional ou reembolsar o comprador

**FA-003: Profissional nao atende**
- Se o profissional nao iniciar o atendimento em 48 horas apos o pagamento, o comprador pode cancelar
- O sistema reembolsa automaticamente

### Pos-condicoes

- O pedido esta concluido com avaliacao
- O profissional recebeu o pagamento liquido
- As avaliacoes estao publicas no perfil do profissional

---

## UC-007: Seguir Profissional

### Metadados

| Campo | Valor |
|-------|-------|
| **ID** | UC-007 |
| **Nome** | Seguir Profissional |
| **Ator Primario** | Usuario |
| **Versao** | V1 |

### Pre-condicoes

- O usuario esta autenticado
- O usuario nao e o proprio profissional

### Fluxo Principal

1. O usuario acessa o perfil de um profissional
2. O usuario toca no botao "Seguir"
3. O sistema cria o registro de follow na tabela `follows`
4. O sistema atualiza o contador de seguidores do profissional
5. O botao muda para "Seguindo"
6. Os versos do profissional passam a aparecer no feed do usuario

### Fluxos Alternativos

**FA-001: Deixar de seguir**
- Se o usuario toca em "Seguindo", o sistema remove o registro de follow
- O contador e decrementado e os versos deixam de aparecer no feed

### Pos-condicoes

- O relacionamento de follow esta criado (ou removido)
- O feed do usuario e atualizado conforme o novo relacionamento

---

## UC-008: Compartilhar Tiragem

### Metadados

| Campo | Valor |
|-------|-------|
| **ID** | UC-008 |
| **Nome** | Compartilhar Tiragem |
| **Ator Primario** | Usuario |
| **Versao** | V1 |

### Pre-condicoes

- O usuario realizou uma tiragem completa
- A tiragem esta salva no historico

### Fluxo Principal

1. O usuario finaliza a leitura de uma tiragem
2. O sistema exibe opcoes de compartilhamento
3. O usuario seleciona "Compartilhar no Feed"
4. O sistema exibe formulario com campo de texto reflexivo (opcional, ate 500 caracteres)
5. O usuario (opcionalmente) escreve um texto
6. O usuario toca em "Publicar"
7. O sistema cria um verso no feed associado a tiragem
8. O verso aparece no feed do usuario e dos seus seguidores

**OU**

3. O usuario seleciona "Compartilhar Externamente"
4. O sistema gera um link publico unico para a tiragem
5. O sistema exibe opcoes: copiar link, WhatsApp, Instagram, Twitter
6. O usuario seleciona o canal
7. O sistema abre o compartilhamento nativo do dispositivo com preview da tiragem

### Fluxos Alternativos

**FA-001: Tiragem com pergunta sensiveis**
- O sistema **nunca** inclui a pergunta do usuario no compartilhamento
- Apenas as cartas reveladas e o texto reflexivo sao visiveis

**FA-002: Compartilhamento em modo privado**
- Se o perfil do usuario esta em modo privado, o verso so e visivel para seguidores aprovados

### Pos-condicoes

- O verso esta publicado (feed) ou o link esta gerado (externo)
- A pergunta do usuario nao e exposta em nenhum canal

---

*Documento: use-cases.md | Versao: 1.0.0 | Identificador: arkana-agora*