# Regras de Negocio -- Arkana Agora

Regras de negocio unificadas do projeto `arkana-agora`. Cada regra e unica e nao se repete entre secoes.

---

## Regras de Tiragem

### BR-TIR-001: Limite Diario de Tiragens

- Usuarios **gratuitos** possuem limite de **3 tiragens por dia** (contando qualquer espalhamento, exceto Tarot do Dia).
- Usuarios **Akasha Plus** possuem limite de **10 tiragens por dia**.
- O contador e reiniciado a meia-noite (horario de Brasilia, UTC-3).
- O Tarot do Dia **nao** consome cota de tiragem.

### BR-TIR-002: Baralho Padrao

- O baralho padrao da plataforma e o **Rider-Waite-Smith (RWS)** com 78 cartas.
- Cada carta possui: nome, numero, imagem (frente e verso), significado erecto, significado invertido, palavras-chave.
- A imagem das cartas deve ter formato quadrado (1:1) com resolucao minima de 512x512px.

### BR-TIR-003: Ordem de Revelacao

- As cartas devem ser reveladas **uma a uma**, na ordem definida pelo espalhamento.
- A animacao de revelacao tem duracao de **1,5 segundo** por carta.
- O usuario **nao pode pular** a animacao de revelacao.
- Apos revelar todas as cartas, o botao de "Solicitar Leitura IA" e habilitado.

### BR-TIR-004: Sem Reposicao

- Uma tiragem **nunca** repete a mesma carta (sem reposicao do baralho).
- Excecao: Tiragens diferentes no mesmo dia **podem** conter as mesmas cartas.

### BR-TIR-005: Cartas Invertidas

- A probabilidade de uma carta sair invertida e de **30%** por padrao.
- O usuario pode desativar cartas invertidas nas configuracoes.
- Usuarios Plus podem ajustar a probabilidade (0%, 15%, 30%, 50%).

### BR-TIR-006: Timeout de Sessao

- Uma sessao de tiragem expira apos **30 minutos** de inatividade.
- Apos o timeout, o usuario e notificado e pode iniciar uma nova tiragem.
- Cartas ja reveladas sao descartadas; nenhuma cobranca de cota e feita.

### BR-TIR-007: Tarot do Dia

- Disponivel uma vez por dia, a partir das 00:00 (horario de Brasilia).
- Gera automaticamente **1 carta** sem que o usuario precise interagir.
- A leitura IA do Tarot do Dia usa prompt simplificado.
- Se o usuario nao acessar o app no dia, o Tarot do Dia **nao** e acumulado.

---

## Regras de Arcano Pessoal

### BR-ARC-001: Calculo Pitagorico

- O Arcano Pessoal e calculado pela **reducao pitagorica** da soma de todos os digitos da data de nascimento completa (DD/MM/AAAA).
- Exemplo: 15/03/1992 = 1+5+0+3+1+9+9+2 = 30 = 3+0 = **3**.

### BR-ARC-002: Reducao de Numeros

- Numeros devem ser reduzidos ate obter um **digito unico** (1-9).
- Excecoes: **11, 22 e 33** (Numeros Mestres) **nao** sao reduzidos.
- Se a reducao resultar em 10, reduzir a 1. Se resultar em 11, 22 ou 33 em qualquer etapa intermediaria, preservar.

### BR-ARC-003: Mapeamento para Arcano Maior

- O resultado numerico (0-21) e mapeado diretamente para o Arcano Maior correspondente:
  - 0 = O Louco (XXI)
  - 1 = O Mago (I)
  - 2 = A Sacerdotisa (II)
  - ... ate 21 = O Mundo (XXI)
- Valores maiores que 21 devem ser reduzidos antes do mapeamento.

### BR-ARC-004: Consideracao do Nome

- O **Numero de Expressao** (nome completo) e calculado separadamente e apresentado como informacao complementar.
- O Arcano Pessoal exibido no perfil e o calculado pela **data de nascimento** (BR-ARC-001).
- A leitura IA pode considerar tanto a data quanto o nome para interpretacao aprofundada.

### BR-ARC-005: Imutabilidade

- O Arcano Pessoal e calculado **uma unica vez** no cadastro e armazenado no perfil.
- Se o usuario corrigir a data de nascimento, o calculo e refeito automaticamente.

---

## Regras de Kin Maya

### BR-KIN-001: Algoritmo Tzolkin

- O calculo do Kin utiliza o **Calendario Tzolkin** de 260 dias (20 Selos Solares x 13 Tons Galacticos).
- Data de referencia: **26/07/1954** = Kin 1 (Dragao Magnetico / Tom 1, Selo 1).
- O Kin de qualquer data e calculado pela diferenca em dias em relacao a data de referencia, aplicando modulo 260.

### BR-KIN-002: Componentes do Kin

- **Selo Solar** = ((Kin - 1) mod 20) + 1  --> 1 a 20
- **Tom Galactico** = ((Kin - 1) mod 13) + 1  --> 1 a 13
- O nome completo do Kin segue o formato: "[Selo] [Tom]" (ex.: "Vento Eletrico").

### BR-KIN-003: Ciclo de 260 Dias

- O Kin pessoal e calculado pela data de nascimento.
- O Kin do dia muda diariamente.
- A onda encantada (ciclo de 13 dias) e calculada a partir do Kin pessoal.

### BR-KIN-004: Selos Solares e Tons Galacticos

- Os 20 Selos Solares: Dragao, Vento, Noite, Semente, Serpente, Enlaçador de Mundos, Mao, Estrela, Lua, Cachorro, Macaco, Humano, Caminhante do Ceu, Mago, Aguia, Guerreiro, Terra, Espelho, Tormenta, Sol.
- Os 13 Tons Galacticos: Magnetico (1), Lunar (2), Eletrico (3), Auto-existente (4), Harmônico (5), Ritmico (6), Resonante (7), Galáctico (8), Solar (9), Planetario (10), Espectral (11), Cristal (12), Cosmico (13).

---

## Regras de Horoscopo

### BR-HOR-001: Horoscopo Chines

- O signo chines e determinado pelo **ano lunar** de nascimento.
- O ano lunar inicia entre 21 de janeiro e 20 de fevereiro; datas antes do inicio do ano lunar pertencem ao signo do ano anterior.
- Cada signo possui um **elemento** determinado pelo ciclo de 5 anos (Madeira, Fogo, Terra, Metal, Agua).
- O ciclo sexagenario combina 12 animais com 5 elementos, gerando 60 combinacoes unicas.

### BR-HOR-002: Horoscopo Maia

- O horoscopo maia e derivado do **Kin Maya** (BR-KIN-001).
- Combina o **Selo Solar** (energia/essencia) com o **Tom Galactico** (como essa energia se expressa).
- A leitura diaria maia utiliza o Kin do dia.

### BR-HOR-003: Horoscopo Ocidental

- O signo zodiacal ocidental e determinado pela **data de nascimento** (dia e mes).
- Nao requer hora de nascimento para calculo basico.
- O horoscopo do dia e gerado por IA com base no signo + posicoes planetarias atuais.

### BR-HOR-004: Correspondencias

- A plataforma pode exibir correspondencias entre sistemas (ex.: "Seu Arcano Pessoal (O Mago) ressoa com o signo de Gemeos").
- Correspondencias sao informativas e nao possuem base cientifica; devem ser apresentadas como curiosidade.

---

## Regras de Mercado (Marketplace)

### BR-MKT-001: Taxa de Plataforma

- A Arkana Agora cobra **15%** sobre cada venda realizada no marketplace.
- A taxa e descontada automaticamente antes da liberacao do saldo ao profissional.
- O valor liquido e: `preco_servico * 0.85`.

### BR-MKT-002: Saque Minimo

- O saque minimo para profissionais e de **R$50,00**.
- Saques sao processados via Mercado Pago em ate 2 dias uteis.
- O profissional so pode sacar saldo disponivel (ja confirmado).

### BR-MKT-003: Avaliacao Obrigatoria

- Apos a conclusao de um servico, o sistema deve solicitar avaliacao ao comprador.
- A avaliacao consiste em: nota de 1 a 5 estrelas + comentario opcional (ate 500 caracteres).
- O comprador tem ate **7 dias** para avaliar. Apos esse prazo, o servico recebe nota media automatica.

### BR-MKT-004: Dispute Automatica

- O comprador pode abrir disputa em ate **7 dias** apos a compra.
- A disputa e mediada pelo admin da plataforma.
- Durante a disputa, o valor fica retido ate a resolucao.
- Se o admin nao intervir em 14 dias, o valor e liberado ao profissional.

### BR-MKT-005: Verificacao de Profissional

- Para se tornar profissional, o usuario deve:
  1. Preencher formulario com experiencia e especialidades
  2. Enviar documento de identificacao
  3. Aguardar aprovacao manual do admin (ate 48h)
- Profissionais podem ser suspensos por violacao dos Termos de Uso.

---

## Regras de Pagamentos

### BR-PAG-001: Planos Akasha Plus

| Plano | Preco | Economia |
|-------|-------|----------|
| Mensal | R$19,90/mes | -- |
| Anual | R$179,90/ano | R$59,30 (25%) |

### BR-PAG-002: Trial

- Novos usuarios recebem **7 dias gratuitos** de Akasha Plus ao se cadastrar.
- O trial inicia automaticamente no primeiro acesso a uma feature Plus.
- O usuario pode cancelar o trial a qualquer momento sem cobranca.
- Se nao cancelar, a assinatura mensal e cobrada ao fim dos 7 dias.

### BR-PAG-003: Cancelamento

- O cancelamento pode ser feito a qualquer momento nas configuracoes da conta.
- Apos o cancelamento, o usuario mantem o acesso Plus ate o **fim do periodo pago**.
- Nao ha reembolso proporcional de periodos ja pagos.
- O usuario pode reativar a assinatura a qualquer momento.

### BR-PAG-004: Processamento

- Todos os pagamentos sao processados via **Mercado Pago**.
- Metodos aceitos: cartao de credito, PIX, boleto (para plano anual).
- Assinaturas mensais so aceitam cartao de credito e PIX.
- Falhas de pagamento geram 3 tentativas em 7 dias antes da suspensao do Plus.

---

## Regras de Conteudo Social

### BR-SOC-001: Versos

- Versos sao tiragens ou conteudos compartilhados no feed.
- Todo verso deve estar associado a um usuario.
- Versos podem conter: tiragem completa, apenas o resultado textual, ou texto reflexivo do usuario.
- A pergunta do consulente **nunca** e exibida publicamente (privacidade). 

### BR-SOC-002: Gifts

- Gifts sao itens virtuais comprados com creditos ou bonus do plano.
- Cada gift tem um valor em "estrelas" (1 estrela = R$0,10).
- O recebedor visualiza o gift no perfil e recebe notificacao.
- Estrelas compradas **nao sao reembolsaveis**.

---
*Documento: business-rules.md | Versao: 1.0.0 | Identificador: arkana-agora*