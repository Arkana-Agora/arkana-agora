# Perfil do Usuário — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Perfil | **Versão**: MVP

---

## Descrição

O perfil do usuário no **Arkana Agora** é a identidade digital dentro da plataforma, combinando dados pessoais editáveis com cálculos esotéricos automáticos. A página pública exibe o avatar, biografia, estatísticas de leituras e os arcanos pessoais calculados — Aracana Pessoal (numerologia pitagórica), Signo Zodiacal e Kin Maya. Esses dados são calculados automaticamente a partir da data de nascimento e do nome cadastrado, utilizando a tabela pitagórica padrão (A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9, J=1, K=2, L=3, M=4, N=5, O=6, P=7, Q=8, R=9, S=1, T=2, U=3, V=4, W=5, X=6, Y=7, Z=8), com redução a um dígito (exceto números mestres 11, 22 e 33). A soma dos dígitos da data de nascimento é somada à soma dos dígitos do nome para obter o número do Arcana Pessoal.

O módulo inclui configurações de privacidade granulares — o usuário pode definir se suas leituras são públicas ou privadas, se aparece na página Explorar e quais informações são visíveis no perfil. Há também um caminho de upgrade para perfil profissional, permitindo ao usuário adicionar especialidades, preços e disponibilidade para consultas pagas.

---

## Funcionalidades

- **Página de perfil público** com avatar, biografia, estatísticas de leituras e arcanos calculados
- **Campos editáveis**: `displayName`, `bio`, `birthDate`, `location`, `website`, `socialLinks`
- **Arcana Pessoal** — cálculo automático via numerologia pitagórica (nome + data de nascimento)
- **Signo Zodiacal** — cálculo automático a partir da data de nascimento
- **Kin Maya** — cálculo automático baseado no calendário Tzolkin (data de referência: 26/07/1954 = Kin 1 — Dragão Magnético)
- **Horóscopo Chinês** — cálculo automático baseado no ano lunar (12 animais × 5 elementos)
- **Configurações de privacidade**: leituras públicas/privadas, exibição no Explorar, dados visíveis no perfil
- **Upgrade para perfil profissional**: especialidades, preço, disponibilidade
- **Galeria de leituras salvas** no perfil

---

## Cálculo do Arcana Pessoal

```
Tabela Pitagórica:
A=1  B=2  C=3  D=4  E=5  F=6  G=7  H=8  I=9
J=1  K=2  L=3  M=4  N=5  O=6  P=7  Q=8  R=9
S=1  T=2  U=3  V=4  W=5  X=6  Y=7  Z=8

Algoritmo:
1. Converter cada letra do nome completo em seu valor numérico
2. Somar todos os valores → soma_nome
3. Somar todos os dígitos da data de nascimento (DD/MM/AAAA) → soma_data
4. soma_total = soma_nome + soma_data
5. Reduzir soma_total a um único dígito (exceto 11, 22, 33)
6. O resultado é o número do Arcana Pessoal
```

## Cálculo do Kin Maya

```
Calendário Tzolkin: 20 Selos Solares × 13 Tons Galácticos = 260 dias
Data de referência: 26/07/1954 = Kin 1 (Dragão Magnético)

Algoritmo:
1. Calcular dias corridos desde 26/07/1954 até a data de nascimento
2. kin_number = (dias_corridos % 260) + 1
3. Tom Galáctico = ((kin_number - 1) % 13) + 1
4. Selo Solar = ((kin_number - 1) % 20) + 1
```

---

## Fluxo Principal

1. O usuário acessa a tela de edição de perfil
2. Preenche os campos: nome de exibição, biografia, data de nascimento, localização, site, links sociais
3. O sistema calcula automaticamente: Arcana Pessoal, Signo Zodiacal, Kin Maya e Horóscopo Chinês
4. O usuário configura as opções de privacidade (leituras públicas/privadas, exibição no Explorar)
5. O sistema salva as alterações e atualiza a página de perfil público
6. Outros usuários podem visualizar o perfil público com base nas configurações de privacidade
7. (Opcional) O usuário solicita upgrade para perfil profissional e preenche dados adicionais

---

## Versão

| Feature | Versão |
|---|---|
| Perfil público básico | MVP |
| Cálculos esotéricos automáticos | MVP |
| Configurações de privacidade | MVP |
| Horóscopo Chinês | V1 |
| Upgrade para profissional | V1 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário deve estar autenticado |
| Armazenamento de arquivos | Infraestrutura | Upload de avatar (S3/R2) |
| Banco de dados | Infraestrutura | Tabelas `users`, `profiles`, `privacy_settings` |
| Módulo de cálculos | Módulo interno | Biblioteca de cálculos esotéricos |

---

## Critérios de Aceite

- **CA-01**: O Arcana Pessoal deve ser calculado corretamente para qualquer nome e data de nascimento válidos, seguindo a tabela pitagórica e regras de redução
- **CA-02**: O Kin Maya deve ser calculado corretamente com base na data de referência 26/07/1954 = Kin 1 (Dragão Magnético)
- **CA-03**: As configurações de privacidade devem ser aplicadas em menos de 1 segundo após a alteração
- **CA-04**: O perfil deve ser acessível publicamente por URL única (slug) e respeitar as configurações de privacidade do usuário
- **CA-05**: O upload de avatar deve aceitar imagens até 5 MB nos formatos JPG, PNG e WebP, com redimensionamento automático para 400×400px
