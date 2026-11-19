# Colonize Mars — Simulador 3D de Colonização, Combate e Cooperativo

**Colonize Mars** é um jogo 3D em WebGL (Three.js + React + TypeScript) onde astronautas pousam na Cratera Gale, exploram biomas marcianos em gravidade realista (`0.38g`), escavam crateras para extrair minérios, cultivam alimentos em redomas de vidro, sintetizam elementos químicos (ISRU), fabricam armamentos, defendem a colônia contra invasores de sílica, exploram o planeta em órbita com a Starship e cooperam online para até **3 jogadores** via **Playgama Bridge Multiplayer**.

---

## Principais Recursos

### Exploração Planetária e Física Marciana (`0.38g`)
- **Terreno 3D explorável (`300×300m`)** com 4 biomas distintos: *Planície de Gale*, *Cânion de Basalto*, *Calota Polar Norte* e *Fissura Vulcânica Tharsis*, além do céu marciano com o Sol, **Fobos** e **Deimos**.
- **Movimento e Jetpack EVA:** gravidade marciana realista (`0.38g`), inércia, corrida tática, *coyote time*, *jump buffering* e propulsor Jetpack recarregável.
- **Escavação 3D de Crateras (`[G]`):** deforma a malha do terreno e a colisão física em tempo real, extraindo minérios específicos de cada bioma (*Regolito*, *Gelo*, *Ferro*, *Titânio*, *Silício* e *Enxofre*).
- **Exploração Orbital com a Starship (`[V]`):** decole para órbita de Marte em um globo 3D procedural (Calotas Polares, Valles Marineris, Olympus Mons) e escaneie 6 anomalias planetárias consumindo combustível `H₂`.

### Construção Evolutiva, Redomas Agrícolas e Refinaria Química (ISRU)
- **Campanha em 6 Eras / 12 Missões:** do gerador de oxigênio **MOXIE** e **Matrizes Solares** até o **Biodomo**, **Habitat Pressurizado**, **Usina Geotérmica** e o **Processador Atmosférico Global** (terraformação gradual até 100% de Habitabilidade com céu azul, lagos cheios e vegetação).
- **Redomas de Vidro para Alimentos:** plante, acompanhe o crescimento 3D e colha *Batata Marciana*, *Alface & Espirulina* e *Trigo Bioengenheirado* para produzir rações e manter a nutrição e o `O₂` do traje (`[H]`).
- **Refinaria Química ISRU (`[B]`):** 6 processos reais de extração de elementos essenciais (redução de regolito em Ferro + Silício, destilação de gelo, eletrólise de água em `H₂ + O₂`, síntese Sabatier, liga de Titânio e nutriente hidropônico NPK).
- **Árvore Tecnológica (`[T]`) & Mission Control Terminal (`[C]`):** 8 tecnologias pesquisáveis em tempo real e 3 objetivos diários aleatórios por Sol dentro do Habitat com recompensas bônus.
- **Clima Dinâmico — Tempestade de Poeira:** ocorre periodicamente entre Sols, reduzindo em 50% a geração solar e acelerando o desgaste estrutural dos módulos.

### Combate em 1ª / 3ª Pessoa, Resistência Estrutural e Inimigos
- **Arma nas Costas, Saque Animado e Visão 1ª Pessoa:** a arma equipada fica acoplada diagonalmente à mochila PLSS do astronauta. Ao atirar (`[F]` ou clique no cenário), o personagem saca a arma com animação e som próprios e transiciona para **Visão em 1ª Pessoa** com modelo 3D em câmera e mira tática central.
- **Alternância Livre de Câmera (`[X]` ou botão `1ªP / 3ªP`):** alterne instantaneamente entre Visão Normal (3ª Pessoa) e 1ª Pessoa a qualquer momento.
- **4 Armamentos Fabricáveis (`[1]`–`[4]`):** *Pistola de Pulso EVA*, *Rifle de Assalto a Plasma*, *Escopeta Iônica* e *Canhão Railgun de Titânio*.
- **4 Níveis de Resistência por Edifício:** cada um dos 11 módulos tem integridade máxima (`180–760`) e blindagem (`2–14`) próprias (**Leve**, **Média**, **Reforçada** e **Blindada**).
- **4 Arquétipos de Inimigos:** *Rastejador de Sílica* (`75 HP`), *Drone Pirata* (`115 HP`), *Perseguidor Ácido* (`135 HP`) e *Colosso de Basalto* (`280 HP`), cada um com poder de ataque, dano estrutural e penetração de blindagem distintos.
- **Incêndio Crítico (`<= 35%`) e Explosão (`0%`):** estruturas muito danificadas pegam fogo com chamas e fumaça 3D; se não forem reparadas a tempo (`[E]`), explodem com onda de choque e precisam ser reconstruídas do zero.

### Classes de Astronauta e Cooperação (Até 3 Jogadores)
| Classe | Especialidade | Bônus Principais |
| :--- | :--- | :--- |
| **Engenheiro (`ENG`)** | Construção & Reparos | +75% velocidade de obra, +65% eficiência de reparo, +10% Jetpack |
| **Cientista (`CIE`)** | Pesquisa & Energia | +80% velocidade de pesquisa, +35% energia solar/geotérmica, +8 kW portátil |
| **Explorador (`EXP`)** | Combate & Coleta | +24% velocidade, +50% raio magnético, +60% dano e recarga mais rápida |

- **Construção e Reparo Cooperativos:** quando 1 a 3 astronautas pressionam `[E]` juntos na mesma obra ou módulo danificado, o progresso acelera proporcionalmente (**1 jogador = 1.0x**, **2 jogadores = 1.8x**, **3 jogadores = 2.5x**).

### Adaptação Mobile e Desempenho para Portais Web
- Detecção automática de celulares/tablets com controles multi-toque (`Joystick`, `TIRO`, `JETPACK`, `AÇÃO`, `ESCAVAR`, rotação por arraste e pinça de zoom).
- **Adaptive Performance Monitor** com escalonamento dinâmico de resolução (`pixelRatio`) e perfis gráficos (**Auto / Desempenho / Equilibrado / Alto**) acessíveis no menu de pausa.

---

## Controles

| Ação | Teclado / Mouse | Mobile (Toque) | Gamepad |
| :--- | :--- | :--- | :--- |
| Mover | `W A S D` / Setas | Joystick esquerdo | Analógico esquerdo / D-Pad |
| Pular / Jetpack | `Espaço` / `Shift` | Botão `JETPACK` | `A` (botão 0) |
| Atirar (saca arma + 1ª Pessoa) | `F` ou Clique esquerdo | Botão `TIRO` | `B` / `RT` |
| Alternar Visão (`1ªP` / `3ªP`) | `X` | Botão `1ªP / 3ªP` no topo | — |
| Construir / Acelerar / Reparar | `E` ou `Enter` | Botão `AÇÃO` | `X` (botão 2) |
| Escavar Cratera 3D | `G` | Botão `ESCAVAR` | — |
| Girar Câmera | Arraste do mouse ou `Q` / `R` | Arraste na tela 3D | — |
| Trocar Arma | `1`, `2`, `3`, `4` | Botão de arma | — |
| Consumir Ração | `H` | Toque no ícone de Nutrição | — |
| Oficina / Nave / Tech / Missões | `B` / `V` / `T` / `C` | Botão `Menu` no topo | — |
| Pausar / Áudio | `P` ou `Esc` / `M` | Botão `Pause` / `Menu` | — |

---

## Multiplayer com Playgama Bridge

O modo cooperativo online para até **3 jogadores** está configurado utilizando o SDK oficial **`@playgama/bridge`** (Multiplayer Relay + Sync State + Host Migration).

### Configuração do Token Público (via Variável de Ambiente)
Por segurança em repositórios públicos, **nenhum token é versionado no código-fonte**. O arquivo `playgama-bridge-config.json` é gerado automaticamente pelo Vite em tempo de desenvolvimento e build a partir da variável de ambiente `VITE_PLAYGAMA_PUBLIC_TOKEN`:

1. Copie `.env.example` para `.env.local` (ignorado pelo `.gitignore`):
   ```bash
   cp .env.example .env.local
   ```
2. Defina o token público do seu app Playgama em `.env.local` (ou nas variáveis secretas do seu CI/CD):
   ```dotenv
   VITE_PLAYGAMA_PUBLIC_TOKEN="<SEU_PUBLIC_TOKEN_PLAYGAMA>"
   ```

> Durante o `npm run build`, o Vite gera automaticamente `dist/playgama-bridge-config.json` (ao lado de `dist/index.html`) com o formato `{ "saas": { "publicToken": "..." } }` quando a variável está definida, ou `{}` caso contrário (permitindo jogar normalmente no modo **Solo**). Consulte [`public/playgama-bridge-config.example.json`](public/playgama-bridge-config.example.json) como referência.

### Arquitetura Multiplayer Implementada
- **Verificação de Suporte (`isSupported`):** o lobby consulta `bridge.multiplayer.isSupported` antes de exibir os controles online.
- **Entrada em Salas:**
  - **Partida Rápida (`joinOrCreateRoom`):** busca uma sala aberta visível com o mesmo filtro `{ mode: 'coop-mars', version: 3 }` e `maxPlayers: 3`, ou cria uma nova automaticamente.
  - **Sala Privada (`createRoom`):** gera um código Playgama de 8 caracteres (ex.: `K7M4X9TR`) para compartilhar com amigos.
  - **Entrar por Código (`joinRoom`):** conecta diretamente a uma sala de qualquer região.
  - **Lista de Salas (`getRooms`)** e **Seletor de Região (`getRegions` / `setRegion`)** com persistência local (`eu`, `us`, `ap`).
  - **Convites & Deep-Link (`inviteToRoom` / `launchRoomId`):** permite convidar amigos pelo menu da partida e entrar automaticamente quando o jogo é aberto via link de convite.
- **Estado Autoritativo no Host + `syncState`:**
  - O jogador atual com `bridge.multiplayer.isHost === true` executa a simulação autoritativa da colônia (`src/net/coopRoomState.ts`: construções cronometradas, recursos idempotentes, pesquisas, tempestades de poeira e combate) e publica snapshots compactos (`updatesPerSecond: 4`, bem abaixo do limite de 64 KB/s) via `bridge.multiplayer.setSyncState()`.
  - Os demais jogadores enviam suas ações ao host (`{ to: 'host' }`) e recebem atualizações em tempo real.
  - **Migração Automática de Host (`MULTIPLAYER_HOST_CHANGED`):** se o host sair ou perder conexão, o novo host hidrata instantaneamente a colônia a partir do último `syncState` e assume a simulação sem perda de progresso.
  - **Reconexão (`MULTIPLAYER_STATE_CHANGED` / `MULTIPLAYER_ROOM_LEFT`):** exibe aviso de reconexão e trata `left`, `connection_lost` e `room_closed` retornando com segurança ao lobby.

---

## Estrutura do Projeto

```text
├── public/
│   └── playgama-bridge-config.example.json   # Modelo sem segredos (gerado via env no build)
├── src/
│   ├── App.tsx                       # Loop 60FPS baseado em refs e orquestração geral
│   ├── audio/
│   │   └── soundManager.ts           # Síntese procedural de áudio WebAudio
│   ├── components/                   # HUD minimalista, Lobby Playgama, Modais e Controles Touch
│   ├── graphics/                     # Cena 3D Three.js, astronauta, armas, estruturas, fogo/explosões
│   ├── net/
│   │   ├── playgamaMultiplayerClient.ts  # Integração completa com @playgama/bridge
│   │   ├── playgamaSync.ts           # Serialização syncState, migração de host e erros
│   │   ├── coopRoomState.ts          # Estado autoritativo compartilhado da colônia
│   │   └── coopProtocol.ts           # Tipos compartilhados do protocolo cooperativo
│   └── sim/                          # Física 0.38g, biomas, química ISRU, durabilidade, clima, IA
├── server.ts                         # Servidor Express + Vite middleware
├── vite.config.ts                    # Build otimizado com code splitting
├── CHANGELOG.md                      # Histórico completo de versões
└── README.md
```

---

## Como Executar Localmente

### Pré-requisitos
- **Node.js 20+** e **npm**

### Instalação e Desenvolvimento
```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (porta 3000)
npm run dev
```

Acesse `http://localhost:3000` (dica: use `?autostart=1` para pular o lobby ou `?mobile=1` para testar o layout mobile no desktop).

### Testes Unitários, Verificação de Tipos e Build de Produção
```bash
# Executar toda a suíte de testes unitários (física, colônia, durabilidade, Playgama sync)
npx tsx --test src/sim/*.test.ts src/net/*.test.ts

# Checar tipagem TypeScript
npm run lint

# Gerar build de produção em dist/ (pronto para envio à Playgama)
npm run build
```

---

## Publicação na Playgama
1. Configure a variável de ambiente `VITE_PLAYGAMA_PUBLIC_TOKEN` no ambiente de build (ou `.env.local`, nunca commitado) e execute `npm run build` — a pasta `dist/` conterá `index.html`, `playgama-bridge.js`, os bundles otimizados e `playgama-bridge-config.json` preenchido automaticamente.
2. Compacte o conteúdo de `dist/` em um arquivo `.zip` (com `index.html` e `playgama-bridge-config.json` na raiz do `.zip`).
3. Envie o pacote pelo **Playgama Developer Dashboard** com **Bridge SaaS → Multiplayer** habilitado para o projeto correspondente ao token configurado.
