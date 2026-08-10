# SPEC-005: Arcano Pessoal

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do calculo e exibicao do Arcano Pessoal no Arkana Agora. O Arcano Pessoal e um conceito da numerologia tarotistica que associa uma pessoa a um dos 22 Arcanos Maiores do Tarot, baseado em sua data de nascimento e/ou nome completo.

---

## 2. Requisitos Funcionais

### RF-ARC-001: Calculo pela Data de Aniversario
O sistema deve calcular o Arcano Pessoal pela data de nascimento utilizando o metodo de reducao pitagorica:

**Algoritmo:**
1. Somar todos os digitos do dia, mes e ano de nascimento
2. Se o resultado for maior que 9, reduzir somando os digitos novamente
3. Repetir ate obter um unico digito OU um numero mestre (11, 22 ou 33)

**Exemplo:** 15/04/1992
- Dia: 1 + 5 = 6
- Mes: 0 + 4 = 4
- Ano: 1 + 9 + 9 + 2 = 21 -> 2 + 1 = 3
- Soma total: 6 + 4 + 3 = 13 -> 1 + 3 = 4
- Arcano Pessoal: 4 (O Imperador)

**Exemplo com Numero Mestre:** 29/11/1980
- Dia: 2 + 9 = 11 (numero mestre, manter)
- Mes: 1 + 1 = 2
- Ano: 1 + 9 + 8 + 0 = 18 -> 1 + 8 = 9
- Soma total: 11 + 2 + 9 = 22 (numero mestre, manter)
- Arcano Pessoal: 22 (O Louco)

**Regra de resolucao:** A reducao so para em numeros de 1 digito (1-9) ou numeros mestres (11, 22, 33). Se o resultado da soma for 10, 12, 13, ..., etc. (exceto 11, 22, 33), continuar reduzindo.

### RF-ARC-002: Calculo pelo Nome
O sistema deve calcular o Arcano Pessoal pelo nome completo de batismo utilizando a Tabela Pitagorica. Cada letra e convertida em um numero, e a soma total e reduzida conforme o mesmo algoritmo de reducao.

**Tabela Pitagorica completa:**

| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|
| A | B | C | D | E | F | G | H | I |
| J | K | L | M | N | O | P | Q | R |
| S | T | U | V | W | X | Y | Z |  |

**Valores individuais:**
- A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9
- J=1, K=2, L=3, M=4, N=5, O=6, P=7, Q=8, R=9
- S=1, T=2, U=3, V=4, W=5, X=6, Y=7, Z=8

**Regras:**
- Utilizar apenas letras (remover acentos, espacos e caracteres especiais)
- Converter para maiusculas antes da tabela
- Exemplo: "MARIA SILVA" -> "MARIASILVA" -> M(4)+A(1)+R(9)+I(9)+A(1)+S(1)+I(9)+L(3)+V(4)+A(1) = 42 -> 4+2 = 6 -> Arcano 6 (O Enamorado)

### RF-ARC-003: Combinacao Data + Nome -> Arcano Pessoal Final
O sistema deve calcular um Arcano Pessoal Final que combina os resultados da data e do nome:

1. Calcular Arcano pela Data (RF-ARC-001)
2. Calcular Arcano pelo Nome (RF-ARC-002)
3. Somar os dois resultados
4. Reduzir conforme algoritmo padrao (ate 1 digito ou numero mestre)

**Exemplo:**
- Arcano pela Data = 4 (O Imperador)
- Arcano pelo Nome = 6 (O Enamorado)
- Combinacao: 4 + 6 = 10 -> 1 + 0 = 1 -> Arcano 1 (O Mago)

### RF-ARC-004: Correspondencia com Arcano Maior
O sistema deve mapear o resultado numerico para o Arcano Maior correspondente:

| Numero | Arcano | Palavras-chave |
|---|---|---|
| 0 | O Louco | Novo comeco, liberdade, inocencia, risco |
| 1 | O Mago | Criatividade, poder, manifestacao, habilidade |
| 2 | A Sacerdotisa (A Papisa) | Intuicao, sabedoria interior, misterio |
| 3 | A Imperatriz | Fertilidade, abundancia, natureza, maternidade |
| 4 | O Imperador | Autoridade, estrutura, estabilidade, lideranca |
| 5 | O Hierofante (O Papa) | Tradicao, espiritualidade, ensino, conformismo |
| 6 | O Enamorado | Escolha, amor, harmonia, decisoes |
| 7 | O Carro | Determinacao, vitoria, controle, viagem |
| 8 | A Forca | Coragem, paciencia, dominio interior, compaixao |
| 9 | O Eremita | Sabedoria, introspecao, solidao, orientacao |
| 10 | A Roda da Fortuna | Ciclos, mudanca, destino, virada |
| 11 | A Justica | Equilibrio, verdade, lei, causa e efeito |
| 12 | O Enforcado | Sacrificio, nova perspectiva, espera, rendicao |
| 13 | A Morte | Transformacao, fim, transicao, renascimento |
| 14 | A Temperanca | Equilibrio, paciencia, harmonia, moderação |
| 15 | O Diabo | Tentacao, materialismo, sombra, apego |
| 16 | A Torre | Ruptura, revelacao, mudanca drastica, despertar |
| 17 | A Estrela | Esperanca, inspiracao, renovacao, cura |
| 18 | A Lua | Ilusao, inconsciente, medo, intuicao |
| 19 | O Sol | Sucesso, vitalidade, alegria, clareza |
| 20 | O Julgamento | Renascimento, avaliacao, chamado, despertar |
| 21 | O Mundo | Conclusao, integracao, realizacao, totalidade |

**Nota sobre numeros mestres:**
- 11 = A Forca (ou Justiceiro/Energia Mestre na numerologia avancada)
- 22 = O Louco (ou O Construtor Mestre)
- 33 = A Coroa (arcano extra-numerologico, associado a culminacao espiritual)

Para o Arkana Agora, numeros mestres mantem correspondencia direta: 11=Justica, 22=O Louco (com destaque especial como numero mestre), 33=O Mundo (como culminacao).

### RF-ARC-005: Interpretacao IA do Resultado
Apos o calculo, o usuario pode solicitar uma interpretacao personalizada do seu Arcano Pessoal gerada por IA:
- A interpretacao deve considerar: arcano pela data, arcano pelo nome, arcano final combinado
- Deve abordar: caracteristicas de personalidade, potenciais, desafios, conselhos
- Deve considerar o signo solar do usuario (se disponivel) para enriquecer a interpretacao
- Utiliza o mesmo pipeline de streaming da SPEC-004
- Conta como 1 uso da cota diaria de IA
- Exibida em pagina dedicada `/meu-arcano`

---

## 3. Requisitos Nao Funcionais

### RNF-ARC-001: Precisao do Calculo
O algoritmo de reducao pitagorica deve produzir resultados matematicamente corretos para todas as datas validas entre 01/01/1900 e 31/12/2100. Validar com 100 casos de teste conhecidos.

### RNF-ARC-002: Tempo de Calculo
O calculo do Arcano Pessoal (data + nome + combinacao) deve ser executado em menos de 5ms, podendo ser feito no cliente (navegador) sem necessidade de chamada ao servidor.

### RNF-ARC-003: Idempotencia
O mesmo input (mesma data e mesmo nome) deve sempre produzir o mesmo Arcano Pessoal, independente de quando o calculo e realizado.

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
|---|---|---|
| z-ai-web-dev-sdk | latest | Interpretacao IA do arcano (SPEC-004) |
| Zod | >=3.x | Validacao de data e nome |

**Nota:** O calculo numerologico e puramente matematico e nao depende de bibliotecas externas.

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
|---|---|---|
| CA-ARC-001 | A data 15/04/1992 resulta no Arcano 4 (O Imperador) | Teste unitario |
| CA-ARC-002 | A data 29/11/1980 resulta no Arcano 22 (numero mestre) | Teste unitario |
| CA-ARC-003 | O nome "MARIA SILVA" resulta no Arcano 6 (O Enamorado) | Teste unitario |
| CA-ARC-004 | A combinacao dos arcanos 4 + 6 resulta no Arcano 1 (O Mago) | Teste unitario |
| CA-ARC-005 | O usuario solicita interpretacao IA e recebe texto streaming com referencia aos 3 arcanos calculados | Teste E2E |