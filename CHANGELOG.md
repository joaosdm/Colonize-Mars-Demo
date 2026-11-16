# CHANGELOG — Colonize Mars

Todas as atualizações estruturais, melhorias de física, progressão evolutiva e sistema multiplayer cooperativo do projeto estão registradas abaixo em formato de histórico de commits.

---

## [v2.0.0] - 2026-11-16 15:25

### `perf(engine): elimina travamentos de 60Hz no loop principal`
- Substituído o gerenciamento de estado reativo por ciclo de frame (`colonyState` como dependência do `requestAnimationFrame`) por referências mutáveis (`colonyStateRef`, `plantedPlotsRef`, `gameStateRef`).
- Adicionada sincronização throttled do HUD (~8Hz) e atualização imediata apenas em eventos discretos (coleta, construção, pesquisa tecnológica e avanço de era).
- Removido `transmission` em materiais de vidro sob WebGL por software e corrigida a projeção de billboards 3D com descarte de frustum.

### `feat(physics): física realista marciana (0.38g), terreno determinístico e Jetpack EVA`
- Criado `src/sim/marsPhysics.ts` com mapa de elevação determinístico (`groundHeightAt`): zona de pouso plana, duas bacias de lagos de cratera (Leste e Oeste), dunas marcianas e borda externa da Cratera Gale.
- Implementado movimento com inércia, aceleração, atrito em baixa gravidade, assistente de inclinação (`groundNormalAt`), colisão circular suave contra rochas e módulos (`resolveObstacleCollisions`), *coyote time*, *jump buffering* e propulsor **Jetpack EVA** (`Shift` ou `Espaço` no ar).
- Aprimorado modelo 3D do astronauta (`src/graphics/astronautModel.ts`) com passadas sincronizadas à distância percorrida, *squash-and-stretch*, sombra de contato no solo e chamas duplas do Jetpack.

### `feat(progression): loop evolutivo completo em 7 etapas e terraformação visual`
- Criado `src/sim/marsColonyLogic.ts` com progressão clara em 5 Eras / 7 Objetivos:
  1. **Habilitar Base:** Ativar gerador de oxigênio **MOXIE** + **Matriz Solar** (+30 kW).
  2. **Criar Água:** Extrair gelo e construir o **Extrator & Purificador de Água** (gera água líquida contínua e começa a preencher os lagos).
  3. **Desenvolver Tecnologias:** Construir o **Laboratório de Pesquisa** e pesquisar na **Árvore Tecnológica `[T]`** (*Propulsor EVA Mk.II*, *Imã Orbital*, *Sementes Bioengenheiradas* e *Núcleo Atmosférico*).
  4. **Plantar Vida:** Construir o **Biodomo Hidropônico** e plantar nos **3 Canteiros Externos** para gerar **Biomassa**.
  5. **Criar um Mundo:** Ativar o **Processador Atmosférico Global** — transforma gradualmente o céu de Marte para azul, enche os lagos de cratera e faz brotar vegetação pelo mapa ao atingir **100% de Habitabilidade**.

### `feat(multiplayer): modo cooperativo em tempo real para até 3 jogadores`
- Implementado servidor Express + WebSocket (`/ws`) em `server.ts` com gerenciamento de salas (`GET /api/rooms`, criar sala, entrar por código, limite de 3 jogadores e cores distintas de traje: *Comandante* laranja, *Engenheira* ciano e *Biólogo* esmeralda).
- Criado `src/net/coopRoomState.ts` com mutações idempotentes de coleta de recursos, construções compartilhadas, plantio de canteiros, pesquisa tecnológica e geração passiva autoritativa no servidor.
- Adicionada renderização e interpolação suave dos avatares remotos com placas de identificação 3D em `src/graphics/MarsSurfaceScene.ts`.

### `feat(ui): lobby cooperativo, HUD evolutivo, modal de tecnologias e câmera orbital`
- Adicionado `TitleLobbyOverlay.tsx` com entrada rápida **Jogar Solo** e lobby cooperativo em tempo real.
- Adicionado `TechTreeModal.tsx` (`[T]`) e atualizados `MarsColonyHUD.tsx`, `FloatingBillboards.tsx` e `StatusModals.tsx` para exibir Água, Biomassa, combustível de Jetpack, fase planetária e eventos cooperativos.
- Adicionada rotação de câmera por arraste de mouse ou teclas `Q`/`R`, mantendo movimento sempre relativo à câmera.

### `test(sim): suíte de testes unitários para física, colônia e salas co-op`
- Adicionados `src/sim/marsPhysics.test.ts`, `src/sim/marsColonyLogic.test.ts` e `src/net/coopRoomState.test.ts` (11/11 testes aprovados via `tsx --test`).

---

## [v2.0.1] - 2026-11-16 15:35

### `fix(graphics): alinhamento exato da seta guia 3D e legenda do lobby`
- Corrigida a rotação da geometria da seta guia (`+Math.PI / 2` em `src/graphics/astronautModel.ts`) para apontar diretamente para os objetivos e cristais mais próximos.
- Ajustada largura da barra de atalhos em `TitleLobbyOverlay.tsx` para exibição em linha única.
- Verificado em navegador real (solo, Jetpack, árvore de tecnologias `[T]`, ativação do MOXIE e sessão WebSocket cooperativa entre 2 clientes).

---

## [v2.1.0] - 2026-11-16 17:10

### `feat(progression): expansão para 6 Eras, 12 Missões e Contratos Orbitais infinitos`
- Expandida a campanha evolutiva em `src/sim/marsColonyLogic.ts` de 7 para **12 Missões Estruturadas** com novas estruturas 3D (`src/graphics/colonyStructures.ts`):
  - **Sonda Mineradora Automática** (mineração contínua de Regolito e Gelo)
  - **Torre de Defesa Laser** (mira automática e disparos contra ameaças)
  - **Habitat Pressurizado & Enfermaria** (+25% O2 máximo e nova zona segura)
  - **Antena de Comunicação Orbital** (desbloqueia **Contratos Orbitais Dinâmicos** contínuos)
  - **Usina Geotérmica Profunda** (+80 kW de energia limpa)

### `feat(gameplay): construções cronometradas por nível de complexidade`
- Construções não são mais instantâneas: cada projeto agora entra na fila `activeConstructions` com duração proporcional à complexidade (`Simples`: 4–6s, `Intermediária`: 10–12s, `Avançada`: 14–18s, `Megaestrutura`: 22–26s).
- Adicionados andaimes holográficos 3D em tempo real sobre a obra, placa de progresso em `FloatingBillboards.tsx` e cartão de obra ativa no `MarsColonyHUD.tsx`.
- Permanecer próximo à obra acelera a construção em **2.2x** (acumulando no modo cooperativo), apertar `[E]`/`AÇÃO` injeta impulso instantâneo (+1.5s) e pesquisar **Drones Construtores** adiciona +45% de velocidade global.

### `feat(combat): ameaças marcianas, pulso de plasma, reparos e modo pacífico`
- Criado `src/sim/marsEnemies.ts` com 3 arquétipos de inimigos: **Rastejador de Sílica**, **Drone Pirata Corrompido** e **Colosso de Basalto**, além de sistema de integridade dos módulos (`buildingHealth`), reparos em campo (`[E]`) e espólio de recursos.
- Adicionado disparo de **Pulso de Plasma** (`[F]`, clique rápido no cenário, botão **PULSO** no toque ou `[B]` no gamepad) e **Corrida Tática** (`Shift` no solo).
- Adicionada alternância entre **Ameaças Ativas** e **Modo Pacífico** tanto no Lobby quanto no HUD, sincronizada em tempo real nas salas cooperativas.

### `feat(tech): Árvore Tecnológica expandida para 8 pesquisas`
- Expandido `TECH_CATALOG` e `TechTreeModal.tsx` para **8 Tecnologias**: *Propulsor EVA Mk.II*, *Imã Orbital*, *Drones Construtores*, *Rifle de Pulso Mk.II*, *Sementes Bioengenheiradas*, *Mira Laser Tática*, *Perfuração Geotérmica* e *Núcleo Atmosférico*.

### `test(sim): testes unitários de construções cronometradas e combate`
- Atualizado `src/sim/marsColonyLogic.test.ts` e adicionado `src/sim/marsEnemies.test.ts` cobrindo fila de construção, aceleração por proximidade, combate de plasma, defesa por torre e reparo de módulos.

---

## [v2.2.0] - 2026-11-16 08:15

### `feat(roles): sistema de 3 classes cooperativas de astronautas`
- Criado `src/sim/astronautRoles.ts` definindo as 3 classes especializadas para até 3 jogadores e modo solo:
  1. **Engenheiro (`ENG`)**: +75% velocidade de construção, +65% eficiência em reparo de módulos e +10% capacidade do Jetpack.
  2. **Cientista (`CIE`)**: +80% velocidade em pesquisas tecnológicas (pesquisas cronometradas em tempo real na Árvore `[T]`), +35% geração de energia das usinas solares/geotérmicas (+8 kW portátil) e +15% raio do sensor de coleta.
  3. **Explorador / Segurança (`EXP`)**: +24% velocidade de movimento, +25% Jetpack, +50% raio de coleta magnética, +60% dano de plasma contra invasores de sílica e recarga 22% mais rápida.
- Integrado cálculo de sinergia cooperativa (`computeSquadRoleBonuses`) e estatísticas efetivas em tempo real (`computeActivePlayerStats`) combinando classe + tecnologias desbloqueadas.

### `feat(lobby,hud): seleção de classe no Lobby e painel de estatísticas ativas no HUD`
- Atualizado `src/components/TitleLobbyOverlay.tsx` com seletor interativo das 3 classes antes de iniciar partidas Solo ou criar/entrar em salas cooperativas (exibindo também as classes ocupadas em salas abertas).
- Atualizado `src/components/MarsColonyHUD.tsx` e `src/components/TechTreeModal.tsx` para exibir o crachá da classe ativa, estatísticas live do jogador (Velocidade, Obra, Reparo, Pesquisa, Coleta, Plasma e bônus de Energia), barra de progresso de pesquisa ativa e siglas de classe no esquadrão 3D.
- Sincronizadas classes, cores de traje e bônus autoritativos no servidor multiplayer (`src/net/coopRoomState.ts` e `server.ts`).

### `test(roles): cobertura unitária para classes cooperativas e sinergia`
- Adicionado `src/sim/astronautRoles.test.ts` e expandido `src/net/coopRoomState.test.ts` validando modificadores de Engenheiro, Cientista e Explorador/Segurança em solo e multiplayer.

---

## [v2.3.0] - 2026-11-16 08:20

### `feat(weather): sistema climático dinâmico de Tempestade de Poeira`
- Criado `src/sim/marsWeather.ts` e integrado ao ciclo evolutivo (`src/sim/marsColonyLogic.ts`) e multiplayer (`src/net/coopRoomState.ts` e `server.ts`):
  - Dispara tempestades de poeira aleatoriamente a cada **2–3 Sols** (`18–28s` de duração) enquanto a colônia ainda não foi totalmente terraformada.
  - Reduz temporariamente a eficiência energética das **Matrizes Solares em 50%** durante a tempestade (`-50% Solar` recalculado em tempo real).
  - Acelera a degradação estrutural dos módulos já construídos (com maior impacto em estruturas expostas como Matrizes Solares e Antena Orbital).
- Adicionada atmosfera 3D de tempestade em `src/graphics/MarsSurfaceScene.ts` com névoa densa alaranjada e rajadas de poeira marciana.
- Adicionado cartão de alerta climático no HUD (`src/components/MarsColonyHUD.tsx`) com contagem regressiva da tempestade, aviso de perda solar e lista priorizada das estruturas que exigem **manutenção urgente** (`%` de integridade e atalho `[E] Reparar`).
- Adicionada suíte unitária `src/sim/marsWeather.test.ts` e caso de integração co-op em `src/net/coopRoomState.test.ts`.

---

## [v2.4.0] - 2026-11-16 08:25

### `feat(coop): aceleração cooperativa proporcional em construções e reparos (1x / 1.8x / 2.5x)`
- Criado módulo dedicado `src/sim/coopActionBoost.ts` para cálculo de trabalho em equipe na mesma estrutura em construção ou módulo danificado:
  - **1 jogador** pressionando `[E]` na área de interação: **1.0x**
  - **2 jogadores** pressionando `[E]` na mesma área: **1.8x**
  - **3 jogadores** pressionando `[E]` na mesma área: **2.5x**
- Integrado ao protocolo multiplayer (`src/net/coopProtocol.ts`), estado autoritativo das salas (`src/net/coopRoomState.ts`) e servidor WebSocket (`server.ts`), acumulando com os bônus de classe dos astronautas presentes (ex.: Engenheiro) e permitindo reparo contínuo cooperativo ao segurar `[E]`.
- Atualizado `src/components/FloatingBillboards.tsx` e `src/App.tsx` para transmitir estado ativo de `[E]` e exibir o selo de multiplicador cooperativo (`Co-op 2 jogadores (1.8x)` / `Co-op 3 jogadores (2.5x)`) sobre a estrutura.
- Adicionados testes unitários em `src/sim/coopActionBoost.test.ts` e integração em `src/net/coopRoomState.test.ts`.




