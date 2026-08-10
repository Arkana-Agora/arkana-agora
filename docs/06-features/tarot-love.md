# Tarot do Amor — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Tarot do Amor | **Versão**: V1

---

## Descrição

O módulo de Tarot do Amor oferece tiragens especializadas para questões afetivas e relacionamentos. A tiragem principal utiliza 5 cartas com posições específicas: Eu, Parceiro(a), Relacionamento, Desafio e Conselho. O sistema de interpretação por IA ajusta automaticamente o tom e a ênfase das mensagens com base no estado emocional reportado pelo usuário (eufórico, ansioso, triste, curioso), proporcionando uma leitura mais contextualizada e empática.

Além da tiragem completa, o módulo inclui um recurso de **compatibilidade rápida** que analisa os Arcanos Pessoais de dois usuários para gerar uma avaliação sintética de afinidade. O usuário pode compartilhar a leitura com seu parceiro(a) por meio de um link temporário, permitindo que ambas as partes acessem a mesma interpretação. Todas as leituras de amor são salvas em uma seção dedicada no perfil.

---

## Funcionalidades

- **Tiragem de Amor (5 cartas)** com posições específicas e significados dedicados
- **Compatibilidade rápida** baseada nos Arcanos Pessoais dos envolvidos
- **Ajuste de humor** para personalização da interpretação (eufórico, ansioso, triste, curioso, neutro)
- **Compartilhamento com parceiro(a)** via link temporário (expiração: 72h)
- **Histórico dedicado** de leituras de amor no perfil
- **Interpretação contextualizada** considerando estado civil e gênero dos envolvidos

## Posições da Tiragem de Amor

| Posição | Carta | Significado |
|---|---|---|
| 1 | Eu | Como eu me sinto / minha energia no relacionamento |
| 2 | Parceiro(a) | Como o outro se sente / energia do outro |
| 3 | Relacionamento | Dinâmica atual do relacionamento |
| 4 | Desafio | Obstáculo ou lição a aprender |
| 5 | Conselho | Orientação para o caminho a seguir |

---

## Fluxo Principal

1. O usuário acessa a seção "Tarot do Amor" no menu principal
2. O sistema solicita como o usuário está se sentindo (seletor de humor)
3. Opcionalmente, o usuário informa dados do parceiro(a) (nome e data de nascimento para compatibilidade)
4. O sistema realiza o sorteio das 5 cartas com animação
5. As cartas são reveladas uma a uma com seus significados posicionais
6. A IA gera a interpretação contextualizada com base no humor selecionado
7. Se informados, o sistema calcula a compatibilidade entre os Arcanos Pessoais
8. O usuário visualiza a leitura completa e pode salvar ou compartilhar com o parceiro(a)
9. O parceiro(a) recebe o link e visualiza a mesma leitura sem necessidade de login

---

## Versão

| Feature | Versão |
|---|---|
| Tiragem de 5 cartas dedicada | V1 |
| Ajuste por humor | V1 |
| Compatibilidade rápida | V1 |
| Compartilhamento com parceiro | V1 |
| Tiragem de Amor diária | V2 |
| Tiragem para situação específica (casamento, separação, reconquista) | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Requerido para salvar leituras |
| Tarot | Módulo interno | Mecânica de sorteio e baralho |
| Perfil | Módulo interno | Arcana Pessoal para compatibilidade |
| AI Service | Serviço interno | Interpretação contextualizada |
| Social | Módulo interno | Compartilhamento de leitura |

---

## Critérios de Aceite

- **CA-01**: A tiragem de 5 cartas deve exibir significados específicos para cada posição (Eu, Parceiro, Relacionamento, Desafio, Conselho)
- **CA-02**: A compatibilidade deve ser calculada em menos de 1 segundo e exibir uma pontuação de 0 a 100% com justificativa textual
- **CA-03**: O link de compartilhamento deve expirar em 72 horas e não requerer login do destinatário
- **CA-04**: A interpretação deve refletir o humor selecionado pelo usuário, com variações textuais comprováveis para cada estado emocional
- **CA-05**: O histórico de leituras de amor deve ser filtrável por data e acessível em menos de 2 segundos
