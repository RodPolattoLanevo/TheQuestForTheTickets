# Diagnóstico do projeto — 30/09/2026

Registro da leitura do repositório para continuidade do desenvolvimento. Os comportamentos abaixo foram verificados no código local; configurações e dados de produção na Vercel/Supabase não foram inspecionados.

## Produto e fluxo principal

The Hunt for the Tickets transforma a atividade de suporte em progresso de RPG. Cada ticket recompensado concede XP/moedas e executa uma rodada de combate contra o monstro do personagem. Derrotar monstros concede recompensas adicionais. O dano também contribui para a liberação coletiva da região; eventos de equipe recebem contribuição baseada no XP do ticket.

O jogador acompanha personagem, inventário, equipamentos, aparência, missões, conquistas, ranking e mapa. Não existe ataque manual: a ação de trabalho é o ataque. O contra-ataque do monstro é calculado, mas não reduz uma vida persistente do jogador.

## Organização técnica

| Diretório | Responsabilidade |
| --- | --- |
| `apps/web` | React 18, Vite, TypeScript, Tailwind e React Router; interface do jogo e administração. |
| `apps/backend` | Express 4, TypeScript, validação Zod, autenticação e persistência dos fluxos do jogo. |
| `apps/extension` | Extensão Chrome Manifest V3, JavaScript sem bundler; captura manual e notificações. |
| `packages/database` | Prisma/PostgreSQL, cliente compartilhado, três migrations, seed e scripts operacionais. |
| `packages/game-engine` | Funções puras de nível, regras de recompensa, combate e critérios de progresso. |
| `packages/providers` | Normalização das fontes de tickets. |
| `packages/shared` | Tipos compartilhados entre os pacotes. |
| `docs` | Configuração, operação, integrações, arquitetura e testes. |

Monorepo com npm workspaces. O frontend é uma SPA estática e o backend tem entrada serverless em `apps/backend/api/index.ts`. Os dois projetos Vercel têm configurações próprias. O backend está configurado para a região `pdx1`.

Supabase fornece PostgreSQL acessado pelo backend via Prisma. Não há uso de Supabase Auth no fluxo de login: o projeto mantém usuários e hashes bcrypt no próprio banco e emite JWT com validade de sete dias. O site guarda o JWT em localStorage; a extensão usa chrome.storage.local.

## Entrada dos tickets

`RawTicket → ingestRawTickets → identificação do usuário e status → regra de categoria → grantReward → combate → conquistas/missões e evento coletivo`.

Todas as fontes compartilham esse fluxo. Tickets têm chave única `(provider, externalId)`, eventos registram transições, e `RewardTransaction` registra lançamentos de XP/moedas. A política padrão para tickets reabertos é ignorar uma segunda conclusão.

| Fonte | Estado observado |
| --- | --- |
| Mock | Funcional, inclusive por endpoint acessível a funcionários. |
| CSV | Parser, prévia e commit no painel administrativo. |
| Captura no navegador | Implementada: leitura do texto da lista Zendesk, prévia e confirmação de envio. |
| Zendesk API | Implementação HTTP com token OAuth/API token e cursor; requer credenciais e validação operacional. |
| Zendesk webhook | Endpoint com segredo compartilhado e normalização do payload. |
| Google Sheets | Esqueleto: `fetchTickets` lança erro mesmo com credenciais configuradas. |

A extensão está direcionada a `sacoa.zendesk.com`, ao frontend `the-hunt-for-the-tickets.vercel.app` e ao backend `the-hunt-for-the-tickets-backend.vercel.app`. Ela busca a primeira aba Zendesk retornada, lê linhas renderizadas e filtra solicitantes excluídos localmente. O backend atribui novos tickets ao usuário autenticado; não verifica o responsável real no Zendesk.

No seed, os grupos BR Support LVL1/LVL2/LVL3 e BR Emergency concedem, respectivamente, 25/50/100/200 XP e 10/25/50/100 moedas. Existem regras adicionais e um fallback de 10 XP/5 moedas. Esses são valores de inicialização; o administrador pode alterar o banco.

## Funcionalidades existentes

- Cadastro/login, funcionário e administrador; primeiro cadastro em banco vazio recebe ADMIN.
- Personagem com cinco atributos, aparência por camadas e equipamentos com bônus.
- Seis regiões no seed, 13 monstros, chefes, requisitos de XP e liberação coletiva.
- Loja, inventário, equipar/desequipar e registro de compras.
- Conquistas automáticas e missões com resgate manual de recompensa.
- Ranking por período e suporte a temporada no modelo.
- Eventos cooperativos com contribuição persistida; criação pelo administrador.
- Administração de usuários, regras de categoria, curva de níveis, flags, integrações, concessão/remoção de saldo, reset e auditoria.

A API administrativa possui recursos que a interface expõe apenas parcialmente. A existência de modelos de temporada, habilidades especiais e campos cosméticos não implica que todos tenham mecânicas completas.

## Problemas encontrados por leitura do código

1. **Simulação concede progresso real em produção.** `routes/tickets.ts` exige autenticação, mas não exige administrador nem ambiente de desenvolvimento. O Dashboard exibe a simulação para funcionários. Isso permite progresso sem tickets reais se essa versão estiver publicada.
2. **Saldo sujeito a concorrência.** `engine/rewards.ts` lê XP/moedas e escreve totais absolutos em uma transação sem serialização explícita. Duas concessões simultâneas podem sobrescrever uma à outra. `refreshAchievements` concede várias recompensas em paralelo, tornando esse cenário possível no próprio fluxo normal.
3. **Processamento do ticket não é atômico.** A leitura do status, upsert, criação do evento, recompensa e incremento de solvedCount são operações separadas. Requisições concorrentes podem recompensar a mesma conclusão; uma falha parcial pode deixar um ticket marcado como resolvido sem completar recompensa/combate. Os testes existentes verificam reenvio sequencial, não esse cenário.
4. **Combate pode continuar na região errada.** `engine/encounters.ts` procura qualquer sessão IN_PROGRESS do personagem sem filtrar a região. `routes/worlds.ts` muda a região sem suspender essa sessão. O próximo ticket pode atacar o monstro anterior enquanto contribui para a região nova.
5. **Compras e resgates precisam de atomicidade.** `routes/shop.ts` verifica saldo, cria inventário e debita em passos separados. `routes/quests.ts` verifica claimedAt, concede recompensa e só depois marca o resgate. Concorrência/falhas podem causar compra sem débito completo ou recompensa duplicada.
6. **Captura confia nos dados enviados pelo cliente.** A autenticação identifica quem pede a recompensa, mas não comprova que o ticket foi resolvido por essa pessoa. Solicitantes excluídos são filtrados apenas na extensão. O parser depende de status em inglês e ordem das colunas. Capturas antigas também podem gerar progresso atual, pois updatedAt não determina a data do lançamento.
7. **Deduplicação é por fonte.** O mesmo ticket real pode receber recompensa novamente se importado por outro provider. Isso exige atenção ao alternar ou combinar captura, CSV, API e webhook.
8. **Vinculação tardia do usuário pode perder recompensa.** Se um ticket já resolvido e sem usuário passa a encontrar um usuário numa sincronização posterior, o upsert preenche userId antes de testar pendingEmployeeResolution; o fluxo pode retornar sem recompensar. A intenção descrita no comentário não é cumprida nesse caso.
9. **Missões não se renovam automaticamente.** Os períodos são criados no seed; não foi encontrado job que crie novos períodos diários/semanais. Após expirarem, deixam de aparecer como ativas. Os recortes de data usam o fuso do processo, sem definição explícita de America/Sao_Paulo.
10. **Seed reescreve configurações existentes.** Ele reaplica curva, flags, provider e definições de conteúdo. Reexecutá-lo não é uma rotina neutra de atualização de produção.
11. **Login tem lacunas operacionais.** Cadastro público não restringe domínio/convite; não há rate limiting na API. O segredo JWT possui fallback de desenvolvimento sem bloqueio em produção. Confirmar separadamente se as contas de exemplo continuam existentes/ativas. As permissões são lidas do JWT até expirar.
12. **Documentação diverge do código.** README/arquitetura descrevem Sheets como pronto, mas a implementação é um stub. Há referências antigas a SQLite, ausência de remote e a uma especificação por seções que não foi encontrada entre os arquivos versionados inspecionados. Flags de captura lidas da configuração persistida não usam o fallback da variável de ambiente descrito no deploy.

Esses itens são evidências estáticas e cenários de risco; não são afirmações de incidentes ocorridos no banco de produção.

## Validação feita

- Inventário dos arquivos de aplicação, pacotes, documentação, assets e migrations; leitura dos fluxos centrais e histórico recente.
- Git sem alterações locais reportadas no início da análise. Último commit observado: `6663ab3`, personalização do personagem no Dashboard.
- Motor do jogo: **18 testes passaram em quatro arquivos** (combate, conquistas, níveis e regras de recompensa).
- A suíte de backend foi inspecionada, mas não executada: o setup usa `prisma db push --force-reset --accept-data-loss` no schema `hunt_test` da conexão configurada. A análise não exigia modificar um banco remoto.
- Build completo, interface em execução, credenciais das integrações e estado real de Vercel/Supabase não foram validados nesta revisão.

## Ordem sugerida para continuidade

1. Restringir simulação e definir como comprovar autoria/validade dos tickets capturados.
2. Tornar recompensas, processamento de tickets, compra e resgate resistentes a concorrência e falhas parciais; adicionar testes desses cenários.
3. Corrigir associação de combate à região e vinculação tardia de usuário.
4. Definir renovação das missões, fuso dos períodos e política de alternância entre fontes.
5. Atualizar documentação e separar seed inicial de atualização de conteúdo/configuração.
6. Continuar a evolução visual e das mecânicas sobre essa base.
