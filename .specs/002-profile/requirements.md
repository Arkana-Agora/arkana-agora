# SPEC-002: Perfil do Usuario

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do sistema de perfil do usuario no Arkana Agora. O perfil e o espaco pessoal do usuario, contendo informacoes publicas, dados astrologicos/n numerologicos calculados automaticamente, configuracoes de privacidade e a possibilidade de upgrade para perfil profissional.

---

## 2. Requisitos Funcionais

### RF-PROF-001: Perfil Publico com Avatar, Bio e Estatisticas
O sistema deve exibir uma pagina de perfil publico acessivel via URL `/perfil/[username]`, contendo:
- **Avatar**: imagem circular de 120x120px (placeholder com iniciais do nome caso nao definido)
- **Nome de exibicao**: obrigatorio, ate 50 caracteres
- **Username**: identificador unico, 3-20 caracteres alfanumericos + underline, gerado automaticamente a partir do nome no cadastro
- **Bio**: texto livre de ate 300 caracteres
- **Estatisticas publicas**: total de tiragens realizadas, total de seguidores, total de seguindo, membro desde (data de cadastro)
- **Signo solar**: exibido se a data de nascimento estiver preenchida
- **Arcano pessoal**: exibido se calculado
- **Plano atual**: icone indicativo (Free / Plus)

### RF-PROF-002: Edicao de Campos Editaveis
O usuario deve poder editar os seguintes campos do proprio perfil:
- Nome de exibicao
- Username (com verificacao de disponibilidade em tempo real, debounce de 500ms)
- Bio
- Data de nascimento (formato DD/MM/AAAA)
- Genero (opcional): Masculino, Feminino, Nao-binario, Prefiro nao informar
- Localizacao (texto livre, ate 100 caracteres)
- Site pessoal (URL, validacao de formato)
- As alteracoes devem ser salvas automaticamente com debounce de 1 segundo (auto-save) ou manualmente via botao "Salvar alteracoes"

### RF-PROF-003: Upload de Avatar com Resize
O sistema deve permitir o upload de uma foto de perfil com processamento automatico:
- Formatos aceitos: JPEG, PNG, WebP
- Tamanho maximo do arquivo: 5MB
- Resize automatico para 3 tamanhos: 48x48 (thumbnail), 120x120 (padrao), 400x400 (original cortado ao centro)
- Recorte circular na exibicao (CSS border-radius)
- Remocao de metadados EXIF por questoes de privacidade
- Armazenamento no Cloudflare R2 via presigned URL
- Opcao de remover avatar (voltar ao placeholder com iniciais)

### RF-PROF-004: Calculo Automatico de Signo, Arcano Pessoal e Kin Maya
Com base na data de nascimento fornecida pelo usuario, o sistema deve calcular automaticamente:
- **Signo Solar**: baseado na data de nascimento segundo a astrologia ocidental
- **Arcano Pessoal**: calculado pela reducao pitagorica da data de nascimento (detalhado em SPEC-005)
- **Kin Maya**: calculado pela Contagem Longa do Calendario Maia (detalhado em SPEC-006)
- Os calculos devem ser refeitos automaticamente quando a data de nascimento for alterada
- Exibidos na pagina de perfil com icones tematicos

### RF-PROF-005: Configuracoes de Privacidade
O usuario deve poder configurar a visibilidade dos dados do seu perfil:
- **Perfil publico**: toggle on/off (desativado = perfil visivel apenas para o usuario e seguidores)
- **Mostrar email**: nunca exibido publicamente (sempre desativado por seguranca)
- **Mostrar data de nascimento**: on/off
- **Mostrar estatisticas**: on/off
- **Mostrar signo e arcano pessoal**: on/off
- **Quem pode me seguir**: todos / apenas pessoas que eu sigo / ninguem
- **Quem pode comentar meus posts**: todos / apenas seguidores / ninguem
- As configuracoes de privacidade devem ser aplicadas imediatamente

### RF-PROF-006: Perfil Profissional (Upgrade)
Usuarios com plano Plus devem ter acesso a funcionalidades adicionais de perfil profissional:
- **Titulo profissional**: ex. "Tarologa Certificada", "Leitora de Lenormand" (ate 80 caracteres)
- **Certificacoes**: lista de certificacoes com nome e orgao emissor
- **Horario de atendimento**: faixas de horario disponiveis para consultas
- **Faixa de preco**: valor minimo e maximo por consulta
- **Galeria de trabalho**: ate 20 imagens de leituras realizadas (com permissao do cliente)
- **Avaliacoes**: sistema de avaliacao 1-5 estrelas com comentarios (visivel no perfil)
- **Badge de verificado**: icone de check ao lado do nome (apos validacao manual pela equipe)

---

## 3. Requisitos Nao Funcionais

### RNF-PROF-001: Tempo de Carregamento
A pagina de perfil publico deve carregar em menos de 1 segundo (P95) em conexoes 4G. Dados de perfil devem ser cacheados no TanStack Query por 5 minutos com stale-while-revalidate.

### RNF-PROF-002: Processamento de Imagem
O upload e processamento de avatar deve ser concluido em menos de 3 segundos (P95). O resize deve ser executado no servidor utilizando a biblioteca `sharp`.

### RNF-PROF-003: Disponibilidade de Username
A verificacao de disponibilidade de username deve responder em menos de 200ms. O sistema deve impedir usernames que sejam:
- Palavras ofensivas (lista bloqueada)
- Nome de rotas reservadas do sistema (api, admin, auth, etc.)
- Muito similares a nomes de usuarios existentes (diferenca de 1 caractere)

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
|---|---|---|
| sharp | >=0.33.x | Resize e processamento de imagens no servidor |
| @aws-sdk/client-s3 | >=3.x | Upload para Cloudflare R2 (compativel S3) |
| TanStack Query | >=5.x | Cache e gerenciamento de estado servidor |
| Zustand | >=4.x | Estado local do formulario de perfil |
| zod | >=3.x | Validacao de schemas |

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
|---|---|---|
| CA-PROF-001 | Um usuario consegue acessar `/perfil/[username]` e visualizar avatar, nome, bio e estatisticas | Teste E2E (Playwright) |
| CA-PROF-002 | Um usuario consegue fazer upload de uma imagem JPEG de 4MB e ve-la exibida como avatar circular redimensionada para 120x120px | Teste E2E com verificacao de dimensoes |
| CA-PROF-003 | Ao preencher a data de nascimento "15/04/1992", o sistema calcula e exibe automaticamente "Aries" como signo e o arcano pessoal correto | Teste de integracao com dados conhecidos |
| CA-PROF-004 | Ao desativar "Perfil publico", o perfil so e acessivel pelo proprio usuario e seus seguidores | Teste E2E com multiplas contas |