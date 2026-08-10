# User Stories -- Arkana Agora

User stories do projeto `arkana-agora` no formato padrao: "Como [persona], quero [acao], para [beneficio]".

---

## Autenticacao (US-001 a US-005)

### US-001: Cadastro via Google

**Como** usuario novato, **quero** me cadastrar usando minha conta Google, **para** comecar a usar a plataforma rapidamente sem preencher formulario.

**Criterios de Aceitacao:**
- Dado que o usuario clica em "Entrar com Google", quando o OAuth e concluido, entao o usuario e redirecionado para a tela de complemento de cadastro (nome, data de nascimento)
- Dado que o usuario ja possui conta com aquele email, quando tenta se cadastrar novamente, entao e redirecionado para o login

**Prioridade:** Critico | **Versao:** MVP

---

### US-002: Cadastro via Email

**Como** usuario sem conta social, **quero** me cadastrar com email e senha, **para** ter acesso a plataforma com minha conta pessoal.

**Criterios de Aceitacao:**
- Dado que o usuario preenche email valido e senha (minimo 8 caracteres), quando submete o formulario, entao recebe email de confirmacao em ate 2 minutos
- Dado que o usuario clica no link de confirmacao, quando o token e validado, entao a conta e ativada e o usuario e redirecionado para login

**Prioridade:** Critico | **Versao:** MVP

---

### US-003: Login

**Como** usuario cadastrado, **quero** fazer login com email/senha ou conta social, **para** acessar minha conta e minhas leituras.

**Criterios de Aceitacao:**
- Dado que o usuario informa credenciais validas, quando submete, entao e autenticado e redirecionado para o feed
- Dado que o usuario informa credenciais invalidas, quando submete, entao recebe mensagem de erro sem revelar se o email ou a senha esta incorreto

**Prioridade:** Critico | **Versao:** MVP

---

### US-004: Recuperacao de Senha

**Como** usuario que esqueceu a senha, **quero** solicitar redefinicao por email, **para** recuperar acesso a minha conta.

**Criterios de Aceitacao:**
- Dado que o usuario informa email cadastrado, quando solicita recuperacao, entao recebe email com link de redefinicao valido por 1 hora
- Dado que o usuario usa o link, quando define nova senha, entao pode fazer login com a nova senha

**Prioridade:** Alto | **Versao:** MVP

---

### US-005: Exclusao de Conta

**Como** usuario que nao deseja mais usar a plataforma, **quero** excluir minha conta, **para** ter meus dados removidos conforme a LGPD.

**Criterios de Aceitacao:**
- Dado que o usuario solicita exclusao, quando confirma, entao a conta e marcada para exclusao em 30 dias
- Dado que o periodo de grace period termina, quando o job de limpeza executa, entao dados pessoais sao anonimizados e dados de tiragem sao removidos

**Prioridade:** Critico | **Versao:** MVP

---

## Perfil (US-006 a US-010)

### US-006: Completar Perfil

**Como** usuario recem-cadastrado, **quero** completar meu perfil com foto e biografia, **para** personalizar minha experiencia na plataforma.

**Criterios de Aceitacao:**
- Dado que o usuario faz upload de foto (JPG/PNG, max 5MB), quando salva, entao a foto e exibida no perfil e no feed
- Dado que o usuario preenche biografia (ate 300 caracteres), quando salva, entao a biografia e exibida no perfil

**Prioridade:** Alto | **Versao:** MVP

---

### US-007: Visualizar Arcano Pessoal no Perfil

**Como** usuario, **quero** ver meu Arcano Pessoal calculado automaticamente no perfil, **para** entender minha carta guia e compartilhar com outros.

**Criterios de Aceitacao:**
- Dado que o usuario cadastrou data de nascimento, quando acessa o perfil, entao ve o Arcano Pessoal calculado (nome + imagem da carta + resumo)
- Dado que a data de nascimento e atualizada, quando salva, entao o Arcano Pessoal e recalculado

**Prioridade:** Critico | **Versao:** MVP

---

### US-008: Editar Perfil

**Como** usuario, **quero** editar meus dados pessoais, **para** manter meu perfil atualizado.

**Criterios de Aceitacao:**
- Dado que o usuario altera nome ou bio, quando salva, entao as alteracoes sao refletidas imediatamente
- Dado que o usuario altera a data de nascimento, quando salva, entao o Arcano Pessoal e recalculado

**Prioridade:** Medio | **Versao:** MVP

---

### US-009: Ver Perfil de Outro Usuario

**Como** usuario, **quero** acessar o perfil publico de outro usuario, **para** conhece-lo e decidir se quero segui-lo.

**Criterios de Aceitacao:**
- Dado que o usuario clica no nome de outro usuario, quando a pagina carrega, entao ve nome, foto, bio, Arcano Pessoal e contagem de seguidores/seguindo

**Prioridade:** Alto | **Versao:** V1

---

### US-010: Configuracoes de Privacidade

**Como** usuario, **quero** configurar a visibilidade do meu perfil e tiragens, **para** controlar quem ve meu conteudo.

**Criterios de Aceitacao:**
- Dado que o usuario define perfil como "privado", quando outro usuario tenta acessar, entao ve apenas nome e Arcano Pessoal
- Dado que o usuario define tiragens como "so eu", quando compartilha no feed, entao apenas o texto reflexivo e visivel (sem as cartas)

**Prioridade:** Medio | **Versao:** V1

---

## Tarot (US-011 a US-018)

### US-011: Selecionar Espalhamento

**Como** usuario, **quero** escolher entre diferentes espalhamentos de tarot, **para** adequar a leitura a minha pergunta.

**Criterios de Aceitacao:**
- Dado que o usuario esta na tela de tiragem, quando seleciona um espalhamento, entao ve a descricao e posicoes do espalhamento
- Dado que o usuario e Plus, quando visualiza espalhamentos, entao ve opcoes exclusivas marcadas com distintivo

**Prioridade:** Critico | **Versao:** MVP

---

### US-012: Fazer Tiragem com Animacao

**Como** usuario, **quero** revelar cartas com animacao suave, **para** ter uma experiencia imersiva semelhante a tiragem fisica.

**Criterios de Aceitacao:**
- Dado que o usuario inicia a tiragem, quando o espalhamento e selecionado, entao as cartas sao distribuidas viradas para baixo
- Dado que o usuario toca em uma carta, quando a animacao inicia, entao ela gira em 1,5 segundo revelando a face

**Prioridade:** Critico | **Versao:** MVP

---

### US-013: Inserir Pergunta na Tiragem

**Como** usuario, **quero** digitar minha pergunta antes da tiragem, **para** receber uma interpretacao mais contextualizada.

**Criterios de Aceitacao:**
- Dado que o usuario digita uma pergunta (ate 200 caracteres), quando as cartas sao reveladas, entao a pergunta e enviada ao prompt da IA
- Dado que o usuario pula a pergunta, quando a leitura IA e gerada, entao o prompt usa contexto generico

**Prioridade:** Alto | **Versao:** MVP

---

### US-014: Ver Tarot do Dia

**Como** usuario, **quero** ver meu Tarot do Dia, **para** ter uma reflexao matinal com uma unica carta.

**Criterios de Aceitacao:**
- Dado que o usuario abre o app, quando acessa a tela inicial, entao ve a carta do dia com interpretacao curta
- Dado que o usuario ja viu o Tarot do Dia, quando acessa novamente, entao ve a mesma carta (nao muda no mesmo dia)

**Prioridade:** Critico | **Versao:** MVP

---

### US-015: Ver Historico de Tiragens

**Como** usuario, **quero** acessar meu historico de tiragens, **para** revisar leituras passadas.

**Criterios de Aceitacao:**
- Dado que o usuario acessa o historico, quando a tela carrega, entao ve lista de tiragens ordenadas por data (mais recentes primeiro)
- Dado que o usuario clica em uma tiragem, quando abre, entao ve todas as cartas e a leitura IA completa

**Prioridade:** Alto | **Versao:** MVP

---

### US-016: Usar Baralho Cigano

**Como** usuario, **quero** fazer tiragens com o Baralho Cigano (Lenormand), **para** ter leituras com este sistema oracular.

**Criterios de Aceitacao:**
- Dado que o usuario seleciona "Baralho Cigano", quando escolhe espalhamento, entao ve opcoes especificas para Lenormand (3 cartas, 5 cartas, 9 cartas)
- Dado que as cartas sao reveladas, quando a leitura IA e gerada, entao usa interpretacoes especificas do Lenormand

**Prioridade:** Alto | **Versao:** V1

---

### US-017: Ver Detalhes da Carta

**Como** usuario, **quero** tocar em uma carta para ver seus significados, **para** aprender e aprofundar meu conhecimento.

**Criterios de Aceitacao:**
- Dado que o usuario toca em uma carta revelada, quando o modal abre, entao ve: nome, numero, significado erecto, significado invertido (se aplicavel) e palavras-chave

**Prioridade:** Medio | **Versao:** MVP

---

### US-018: Controlar Cartas Invertidas

**Como** usuario, **quero** ativar ou desativar cartas invertidas, **para** personalizar minha experiencia de leitura.

**Criterios de Aceitacao:**
- Dado que o usuario desativa cartas invertidas nas configuracoes, quando faz uma tiragem, entao nenhuma carta sai invertida
- Dado que o usuario e Plus, quando ajusta probabilidade de inversao, entao a configuracao e aplicada na proxima tiragem

**Prioridade:** Medio | **Versao:** MVP

---

## IA (US-019 a US-022)

### US-019: Receber Leitura IA com Streaming

**Como** usuario, **quero** ver a interpretacao da IA sendo gerada em tempo real, **para** acompanhar o raciocinio e nao ficar esperando.

**Criterios de Aceitacao:**
- Dado que todas as cartas foram reveladas, quando o usuario clica "Solicitar Leitura", entao o texto comeca a aparecer palavra por palavra em ate 3 segundos
- Dado que o streaming esta em andamento, quando o usuario rola a pagina, entao o texto continua sendo gerado sem interrupcao

**Prioridade:** Critico | **Versao:** MVP

---

### US-020: Regenerar Leitura IA

**Como** usuario, **quero** solicitar uma nova leitura para a mesma tiragem, **para** obter uma perspectiva diferente (consumindo cota adicional).

**Criterios de Aceitacao:**
- Dado que o usuario clica "Gerar nova leitura", quando a cota permite, entao uma nova interpretacao e gerada (diferente da anterior)
- Dado que o usuario nao possui cota, quando clica "Gerar nova leitura", entao ve modal sugerindo upgrade para Plus

**Prioridade:** Medio | **Versao:** MVP

---

### US-021: Ver Aviso de Carater Reflexivo

**Como** usuario, **quero** ver aviso claro de que leituras sao reflexivas, **para** nao tomar decisoes importantes baseado apenas na leitura.

**Criterios de Aceitacao:**
- Dado que o usuario visualiza qualquer leitura, quando a tela carrega, entao ve banner: "As leituras da Arkana Agora sao de carater reflexivo e nao substituem aconselhamento profissional."

**Prioridade:** Critico | **Versao:** MVP

---

### US-022: Salvar Tiragem Favorita

**Como** usuario, **quero** marcar uma tiragem como favorita, **para** encontra-la facilmente no historico.

**Criterios de Aceitacao:**
- Dado que o usuario clica no icone de favorito, quando a acao e concluida, entao a tiragem aparece na secao "Favoritos" do historico

**Prioridade:** Baixo | **Versao:** V1

---

## Arcana Pessoal (US-023 a US-026)

### US-023: Calcular Arcano Pessoal

**Como** usuario, **quero** descobrir meu Arcano Pessoal automaticamente, **para** saber qual Arcano Maior me representa.

**Criterios de Aceitacao:**
- Dado que o usuario informa data de nascimento, quando o calculo e feito, entao ve o resultado com o nome do Arcano e a imagem da carta
- Dado que o resultado e 11, 22 ou 33, quando exibido, entao indica "Numero Mestre" com descricao especial

**Prioridade:** Critico | **Versao:** MVP

---

### US-024: Interpretacao IA do Arcano Pessoal

**Como** usuario, **quero** receber uma interpretacao detalhada do meu Arcano Pessoal via IA, **para** compreender como essa energia se manifesta na minha vida.

**Criterios de Aceitacao:**
- Dado que o usuario solicita leitura do Arcano Pessoal, quando a IA gera o texto, entao a interpretacao considera a data de nascimento e o nome completo
- Dado que o usuario e Plus, quando a leitura e gerada, entao inclui orientacoes praticas e afinidades com outros arcanos

**Prioridade:** Alto | **Versao:** MVP

---

### US-025: Ver Numero de Expressao

**Como** usuario, **quero** ver meu Numero de Expressao calculado a partir do meu nome, **para** conhecer meus talentos naturais.

**Criterios de Aceitacao:**
- Dado que o usuario acessa a pagina de Arcano Pessoal, quando a tela carrega, entao ve o Numero de Expressao com descricao

**Prioridade:** Medio | **Versao:** V1

---

### US-026: Comparar Arcanos com Amigos

**Como** usuario, **quero** comparar meu Arcano Pessoal com o de outros usuarios, **para** descobrir compatibilidades e afinidades.

**Criterios de Aceitacao:**
- Dado que o usuario acessa o perfil de outro usuario, quando clica em "Comparar Arcanos", entao ve um quadro comparativo com os dois arcanos e uma descricao de compatibilidade

**Prioridade:** Baixo | **Versao:** V2

---

## Horoscopos (US-027 a US-032)

### US-027: Ver Horoscopo do Dia

**Como** usuario, **quero** ver o horoscopo do dia para meu signo, **para** ter uma reflexao diaria.

**Criterios de Aceitacao:**
- Dado que o usuario abre o app e seu signo esta definido, quando a tela de horoscopo carrega, entao ve o texto do horoscopo do dia
- Dado que o usuario ainda nao definiu o signo, quando acessa horoscopos, entao e solicitado a informar a data de nascimento

**Prioridade:** Critico | **Versao:** MVP

---

### US-028: Ver Horoscopo Semanal

**Como** usuario, **quero** ver o horoscopo da semana, **para** planejar minha semana com uma visao mais ampla.

**Criterios de Aceitacao:**
- Dado que o usuario acessa a secao de horoscopo, quando seleciona "Semanal", entao ve o texto do horoscopo da semana atual

**Prioridade:** Medio | **Versao:** V1

---

### US-029: Consultar Kin Maya

**Como** usuario, **quero** descobrir meu Kin Maya, **para** conhecer minha energia no Calendario Tzolkin.

**Criterios de Aceitacao:**
- Dado que o usuario informa data de nascimento, quando o calculo e feito, entao ve: numero do Kin, Selo Solar, Tom Galactico e nome completo (ex.: "Vento Eletrico")
- Dado que o usuario solicita, quando a IA gera a interpretacao, entao ve descricao do Selo e do Tom com orientacao pessoal

**Prioridade:** Alto | **Versao:** V1

---

### US-030: Ver Kin do Dia

**Como** usuario, **quero** ver o Kin Maya do dia, **para** conectar-me com a energia do Tzolkin diariamente.

**Criterios de Aceitacao:**
- Dado que o usuario acessa a secao de horoscopos, quando seleciona "Kin do Dia", entao ve o Kin atual com interpretacao curta

**Prioridade:** Medio | **Versao:** V1

---

### US-031: Consultar Horoscopo Chines

**Como** usuario, **quero** descobrir meu signo e elemento no horoscopo chines, **para** conhecer mais essa tradicao.

**Criterios de Aceitacao:**
- Dado que o usuario informa data de nascimento, quando o calculo e feito, entao ve: animal, elemento e ciclo sexagenario
- Dado que o usuario solicita leitura IA, quando gerada, entao a interpretacao descreve caracteristicas do signo + elemento

**Prioridade:** Alto | **Versao:** V1

---

### US-032: Horoscopo Personalizado

**Como** usuario, **quero** receber horoscopo do dia que considera meu Arcano Pessoal, **para** ter uma leitura mais personalizada.

**Criterios de Aceitacao:**
- Dado que o usuario possui Arcano Pessoal calculado, quando acessa o horoscopo do dia, entao o texto menciona a energia do arcano pessoal em conjunto com o signo
- Dado que o usuario e Plus, quando a leitura e gerada, entao inclui conselho pratico do dia

**Prioridade:** Alto | **Versao:** V1

---

## Social (US-033 a US-038)

### US-033: Criar Verso no Feed

**Como** usuario, **quero** compartilhar minha tiragem como verso no feed, **para** que meus seguidores vejam minha leitura.

**Criterios de Aceitacao:**
- Dado que o usuario finaliza uma tiragem, quando clica "Compartilhar no Feed", entao pode adicionar texto reflexivo e publicar como verso
- Dado que o usuario publica, quando o verso aparece no feed, entao mostra as cartas e o texto (a pergunta original nunca e exibida)

**Prioridade:** Alto | **Versao:** V1

---

### US-034: Ver Feed

**Como** usuario, **quero** ver um feed com versos de usuarios que sigo, **para** consumir conteudo relevante.

**Criterios de Aceitacao:**
- Dado que o usuario acessa o feed, quando a tela carrega, entao ve versos em ordem cronologica (mais recentes primeiro)
- Dado que o usuario nao segue ninguem, quando o feed carrega, entao ve versos populares e sugeridos

**Prioridade:** Alto | **Versao:** V1

---

### US-035: Seguir Usuario

**Como** usuario, **quero** seguir outros usuarios, **para** ver seus versos no meu feed.

**Criterios de Aceitacao:**
- Dado que o usuario clica "Seguir" no perfil de outro, quando a acao e concluida, entao o botao muda para "Seguindo" e os versos aparecem no feed

**Prioridade:** Alto | **Versao:** V1

---

### US-036: Curtir e Comentar Verso

**Como** usuario, **quero** curtir e comentar versos, **para** interagir com a comunidade.

**Criterios de Aceitacao:**
- Dado que o usuario clica no icone de curtir, quando a acao e concluida, entao o contador incrementa e o icone muda de estado
- Dado que o usuario escreve comentario (ate 300 caracteres), quando publica, entao o comentario aparece abaixo do verso

**Prioridade:** Medio | **Versao:** V1

---

### US-037: Enviar Gift

**Como** usuario, **quero** enviar um gift virtual a outro usuario, **para** demonstrar apreciacao.

**Criterios de Aceitacao:**
- Dado que o usuario seleciona um gift, quando confirma, entao o gift aparece no perfil do destinatario e notificacao e enviada
- Dado que o usuario nao possui saldo suficiente, quando tenta enviar, entao e orientado a comprar mais estrelas

**Prioridade:** Medio | **Versao:** V1

---

### US-038: Compartilhar Verso Externamente

**Como** usuario, **quero** compartilhar um verso em redes sociais externas, **para** atrair amigos para a plataforma.

**Criterios de Aceitacao:**
- Dado que o usuario clica "Compartilhar", quando seleciona a rede social, entao um link com preview e gerado
- Dado que um usuario nao cadastrado clica no link, quando a pagina abre, entao ve a tiragem e e convidado a se cadastrar

**Prioridade:** Alto | **Versao:** V1

---

## Marketplace (US-039 a US-043)

### US-039: Cadastrar como Profissional

**Como** tarologo profissional, **quero** me cadastrar como profissional, **para** oferecer meus servicos na plataforma.

**Criterios de Aceitacao:**
- Dado que o usuario preenche o formulario de profissional, quando submete, entao o status muda para "Pendente" e o admin e notificado
- Dado que o admin aprova, quando a verificacao e concluida, entao o usuario recebe o badge de profissional

**Prioridade:** Alto | **Versao:** V1

---

### US-040: Criar Servico no Marketplace

**Como** profissional, **quero** cadastrar meus servicos de leitura com preco e descricao, **para** que clientes possam encontra-los e compra-los.

**Criterios de Aceitacao:**
- Dado que o profissional preenche nome, descricao, preco e tipo de leitura, quando publica, entao o servico aparece no catalogo do marketplace
- Dado que o profissional define preco, quando publica, entao o sistema calcula e exibe a taxa da plataforma (15%)

**Prioridade:** Alto | **Versao:** V1

---

### US-041: Buscar Profissional

**Como** usuario, **quero** buscar profissionais por tipo de leitura e faixa de preco, **para** encontrar o servico adequado.

**Criterios de Aceitacao:**
- Dado que o usuario acessa o marketplace, quando aplica filtros, entao a lista e atualizada com profissionais que atendem aos criterios
- Dado que o usuario pesquisa por nome, quando digita no campo de busca, entao ve resultados em tempo real

**Prioridade:** Alto | **Versao:** V1

---

### US-042: Comprar Servico

**Como** usuario, **quero** comprar um servico de leitura de um profissional, **para** receber atendimento personalizado.

**Criterios de Aceitacao:**
- Dado que o usuario seleciona um servico, quando clica "Contratar", entao e redirecionado ao checkout via Mercado Pago
- Dado que o pagamento e aprovado, quando a transacao e confirmada, entao o profissional e notificado e o pedido aparece no dashboard

**Prioridade:** Critico | **Versao:** V1

---

### US-043: Avaliar Servico

**Como** usuario que comprou um servico, **quero** avaliar o atendimento, **para** ajudar outros usuarios na escolha.

**Criterios de Aceitacao:**
- Dado que o servico e concluido, quando o usuario acessa a tela de avaliacao, entao pode dar nota de 1-5 estrelas e comentario opcional
- Dado que a avaliacao e enviada, quando publicada, entao a nota media do profissional e atualizada

**Prioridade:** Alto | **Versao:** V1

---

## Pagamentos (US-044 a US-048)

### US-044: Assinar Arkana Plus

**Como** usuario, **quero** assinar o plano Arkana Plus, **para** ter acesso a funcionalidades premium.

**Criterios de Aceitacao:**
- Dado que o usuario seleciona o plano mensal ou anual, quando inicia o checkout, entao e redirecionado ao Mercado Pago
- Dado que o pagamento e aprovado, quando o webhook e recebido, entao o usuario ganha o role PLUS e os beneficios sao liberados imediatamente

**Prioridade:** Critico | **Versao:** V1

---

### US-045: Iniciar Trial de 7 Dias

**Como** usuario gratuito, **quero** iniciar um trial de 7 dias do Arkana Plus, **para** testar os beneficios antes de pagar.

**Criterios de Aceitacao:**
- Dado que o usuario acessa uma feature Plus pela primeira vez, quando o trial e oferecido, entao pode aceitar ou recusar
- Dado que o usuario aceita, quando os 7 dias comecam, entao todos os beneficios Plus sao liberados

**Prioridade:** Alto | **Versao:** V1

---

### US-046: Cancelar Assinatura

**Como** usuario Plus, **quero** cancelar minha assinatura a qualquer momento, **para** nao ser cobrado no proximo ciclo.

**Criterios de Aceitacao:**
- Dado que o usuario cancela, quando a acao e concluida, entao ve mensagem "Voce ainda tem acesso Plus ate [data do fim do periodo]"
- Dado que o periodo pago termina, quando o job de renovacao executa, entao o role PLUS e removido

**Prioridade:** Critico | **Versao:** V1

---

### US-047: Ver Detalhes da Assinatura

**Como** usuario Plus, **quero** ver detalhes da minha assinatura, **para** saber quando renova e qual plano tenho.

**Criterios de Aceitacao:**
- Dado que o usuario acessa "Minha Assinatura", quando a tela carrega, entao ve: plano atual, data da proxima cobranca, valor, e botao de cancelamento

**Prioridade:** Medio | **Versao:** V1

---

### US-048: Ver Beneficios Plus

**Como** usuario gratuito, **quero** ver o que esta incluso no Arkana Plus, **para** decidir se vale a pena assinar.

**Criterios de Aceitacao:**
- Dado que o usuario acessa a pagina de beneficios, quando a tela carrega, entao ve lista completa com: tiragens ilimitadas, espalhamentos exclusivos, leituras avancadas, horoscopo personalizado completo, sem anuncios

**Prioridade:** Alto | **Versao:** V1

---

## Resumo por Prioridade

| Prioridade | Quantidade |
|------------|-----------|
| Critico | 14 |
| Alto | 22 |
| Medio | 10 |
| Baixo | 2 |
| **Total** | **48** |

---

*Documento: user-stories.md | Versao: 1.0.0 | Identificador: arkana-agora*