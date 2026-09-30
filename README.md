# 🌌 NEXUS: The Sentient Galaxy

> An AI-driven open-world space RPG where every alien is alive, every planet is unique, and the galaxy keeps moving without you.

Built for the **web**: a **Three.js + TypeScript** game client and a **Cloudflare Workers** backend. It runs in any modern browser with no install or plugin. Powered by Claude, procedural simulation, and a community of open-source creators.

### ▶️ Play now: **[playpath.sjapathway.com](https://playpath.sjapathway.com)**
Hosted under **[PlayPath by SJA Pathway](#-about-playpath)** — a free, open game development platform.

[![Kanban Board](https://img.shields.io/badge/Kanban-100%20issues%20across%2010%20epics-0e1116?style=for-the-badge&logo=github)](https://github.com/SJA-Pathway/PlayPath/issues) [![Project Board](https://img.shields.io/badge/Project-Board-1d76db?style=for-the-badge&logo=github)](https://github.com/orgs/SJA-Pathway/projects/2) [![Three.js](https://img.shields.io/badge/Three.js-WebGL-049ef4?style=for-the-badge&logo=threedotjs)](https://threejs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-Vite-3178c6?style=for-the-badge&logo=typescript)](https://vitejs.dev/) [![License](https://img.shields.io/badge/License-Open%20Source-0e8a16?style=for-the-badge)](#)

📋 **Track development:** [Kanban Board (Issues view)](https://github.com/SJA-Pathway/PlayPath/issues) · [Project Board (Kanban columns)](https://github.com/orgs/SJA-Pathway/projects/2) · [All Epics](https://github.com/SJA-Pathway/PlayPath/labels)

---

## 🚀 The Vision

NEXUS pushes AI integration further than anything in the genre. A galaxy where:

- 🧠 **LLM-driven NPCs** — every alien you meet is backed by an LLM agent with persistent memory across sessions
- 🪐 **AI-procedural galaxy** — 10,000+ star systems with planets, biomes, lore, and atmospheres generated on demand
- 🎭 **AI Game Master** — an orchestrator that improvises quests, world events, and tension curves around your playstyle
- 🦎 **ML wildlife** — alien fauna trained with reinforcement learning, run in-browser, evolving across generations
- 🎵 **Adaptive AI music** — per-planet themes generated and remixed on the fly
- 🎙️ **Voice with aliens** — STT (Whisper) + TTS (ElevenLabs) so you literally talk to NPCs
- 🌐 **Persistent shared universe** — WebSocket-networked, civilizations rise and fall while you're offline

**Project location:** `projects/nexus-sentient-galaxy/`

---

## 🕹️ Playable Build (v0.2)

**Live:** https://playpath.sjapathway.com · **Source:** [`projects/nexus-sentient-galaxy/`](projects/nexus-sentient-galaxy/)

This is a real game project, not a mock-up. It has a typed TypeScript codebase, a Vite build, custom GLSL shaders, and a server on Cloudflare's edge. Here is what you can do today:

| Pillar | In the build now |
|---|---|
| 🪐 **Explore** | 48 seeded star systems on jump lanes across three faction territories. GPU-shaded planets in seven biomes with animated clouds, atmospheric scattering rims, city lights on the night side, lava cracks and flowing gas-giant storms. Instanced asteroid belts, planetary rings, a procedural nebula sky, and FTL jumps with mass-lock. |
| 🛸 **Fight** | Flight assist on or off (true Newtonian drift), strafing, roll and boost. Pulse lasers with a heat and overheat model. Target cycling with missile lock-on, homing missiles and swept-sphere hit detection. Five hull types (interceptor, drone, gunship, patrol, freighter) and HDR bloom explosions. |
| 🤖 **Enemy AI** | Utility AI that scores attack, flee, regroup, escort and patrol every few hundred milliseconds. Pilots fly attack runs (approach, fire with lead, overshoot, extend, re-engage), jink under fire, retreat when damaged, and fly in squads with leaders. Concord patrols fight pirates alongside you, and fire back if you shoot them. |
| 🧠 **Talk** | Every planet has a named alien with a species, faction and one of six temperaments. **No API key needed:** conversations run on a built-in dialogue dataset ([`src/npc/lines.ts`](projects/nexus-sentient-galaxy/src/npc/lines.ts)). It understands about 20 topics (your name, trade, pirates, jobs, rumours, history, jokes, insults and more), gives each temperament its own voice, avoids repeating itself, and shifts tone with reputation. Aliens remember your name and what you did, trade for your scan data, tip bounties, send gifts to friends, and **gossip about you** to others in their faction. Optional: set an Anthropic key and the same aliens switch to Claude. |
| 🦎 **Land, Hunt & Tame** | Land on any rocky world. Each has a 4 km heightfield with biome colouring, water or lava, fog, flora and a live ecosystem. Grazers herd using boids and flee; predators hunt and eat them. **Species evolve between visits:** predation pressure changes speed, size, colour and boldness, and the landing report explains why. Catalogue species for the bestiary, or tame a grazer so it follows you on every return. |
| 🎭 **Game Master** | A tension-curve director, the same idea as Left 4 Dead's AI Director. It compares what you are going through with a pacing wave and escalates (raids, gunship wings, convoy ambushes) or relieves (derelict salvage, patrol arrivals, rumours). The **Codex** writes a chronicle of everything that happens. |
| 💼 **Economy** | Stations sell repair, rearming and four upgrade lines of three levels each. A contract board offers bounty, survey, courier and fauna jobs. Faction reputation changes prices and who shoots at you. |
| 🌐 **Play Together** | Live multiplayer: one **Durable Object** room per star system over WebSockets. You see other pilots fly and fire, with 10 Hz snapshots and interpolation. Press Enter to send system chat. |
| 🎵 **Audio** | Fully procedural Web Audio: a pad, arpeggio and pulse score whose key follows the star system and whose intensity follows combat, plus synthesized SFX with distance attenuation. |
| 📱 **Everywhere** | Keyboard and mouse (pointer-lock virtual stick), or touch with a virtual joystick and buttons. Rendering quality adapts automatically. Progress saves in the browser. |

**Controls:** Mouse steer (click to capture) or `↑↓←→` · `W`/`S` throttle · `A`/`D` strafe · `Q`/`E` roll · `Shift` boost · `Z` flight assist · `Space`/LMB lasers · `F`/RMB missile · `Tab` target · `C` scan · `T` hail · `E` dock / tame · `L` land / take off · `M` galaxy map · `K` codex · `Enter` chat · `N` mute

**Still to build (from the backlog):** trained ML wildlife policies (the current ecosystem is rule-based), voice chat with aliens, ship boarding, a persistent server-side economy and guilds, and cloud saves through Supabase.

---

## 🎮 Gameplay Overview

You begin as a lone pilot in a procedurally-generated galaxy. From there the game unfolds along six pillars — each backed by a dedicated development epic on the [Kanban board](https://github.com/SJA-Pathway/PlayPath/issues).

### 🪐 Explore
Pilot a fully customizable spaceship through **10,000+ star systems** with 6DoF flight. Charge an **FTL warp drive** to jump through trade lanes — where pirates may patrol. Land on planets with seamless atmospheric entry, walk surfaces shaped by noise-based heightmaps (GPU terrain in WebGL), scan one of six biomes (lava, ice, ocean, jungle, desert, gas giant), and uncover **AI-generated lore** written for that world alone.

### 🛸 Fight
Build your ship from modular hardpoints — **lasers, missiles, railguns**, shields, engines. Enemy ships use **Utility-AI** tactics (aggressive, flee, ambush) and coordinate as squads. Damage is positional: target specific subsystems to disable rather than destroy. Cripple a hostile vessel, **board it**, and fight its crew in interior FPS combat — then add it to your fleet.

### 🧠 Talk
Every alien is a real **LLM agent** with **persistent memory across sessions**. Speak in text or with your voice via **Whisper STT** — they reply with **ElevenLabs TTS**. They remember the deal you struck three sessions ago, the faction leader you betrayed, the rumor you spread. They keep daily schedules, hold grudges, gossip with each other in the background. Build reputation with **factions**; their tone shifts as you do. Learn alien languages word by word as you play.

### 🦎 Hunt & Tame
Alien wildlife is driven by **reinforcement-learning policies trained offline and run in the browser** with ONNX Runtime Web / TensorFlow.js. Herbivores forage and flock; predators stalk and ambush. Populations rise and fall on their own — a real ecosystem. **Tame** creatures, **breed** them, and watch their **DNA drift across generations** every time you return to a planet.

### 🎭 Be Surprised
An **AI Game Master** orchestrates the galaxy. It watches your playstyle, reads narrative tension curves, and spawns dynamic events — wars, plagues, discoveries — and proposes quests fitted to your archetype. Choices ripple: kill a faction leader and the economy and diplomacy actually shift. A **Codex** auto-writes itself with everything you witness, so your playthrough is its own book.

### 🌐 Play Together
**WebSocket multiplayer** (Cloudflare Durable Objects, one room per star system) with **proximity voice chat**. The universe is persistent and **shared** — civilizations evolve while you're offline. Trade in a server-authoritative **marketplace**, form **guilds and fleets** with shared treasuries and quests.

> Every line above maps to issues on the [Kanban backlog](https://github.com/SJA-Pathway/PlayPath/issues) — filter by `epic:galaxy-gen`, `epic:ship-combat`, `epic:ai-npc`, `epic:ecosystem-ml`, `epic:ai-gm`, or `epic:multiplayer`.

---

## 🗺️ Backlog

[100 issues across 10 epics](https://github.com/SJA-Pathway/PlayPath/issues) — filter by epic label:

`epic:foundation` · `epic:galaxy-gen` · `epic:ai-npc` · `epic:ai-gm` · `epic:ship-combat` · `epic:ecosystem-ml` · `epic:multiplayer` · `epic:ui-ux` · `epic:audio` · `epic:polish-ship`

---

## 🧩 Tech Stack

NEXUS moved from Unity to a **browser-native stack**. The client is static files, and the server is a single Cloudflare Worker. There is no engine license, no plugin and no install.

| Layer | Technology | Status | Replaces (Unity plan) |
|---|---|---|---|
| Rendering | **Three.js 0.170** (WebGL 2), custom GLSL shaders, `EffectComposer` + `UnrealBloomPass`, ACES tone mapping | ✅ In build | Unity URP |
| Language / build | **TypeScript 5 (strict) + Vite 6** | ✅ In build | C# |
| Game server | **Cloudflare Workers** (static assets + API routes) | ✅ In build | Dedicated servers |
| Multiplayer | **Durable Objects** + WebSocket Hibernation API, one room per system | ✅ In build | Photon / Mirror |
| Alien dialogue | Built-in data-driven dialogue engine (intents, per-temperament lines, memory, gossip) | ✅ In build, no key needed | — |
| LLM NPCs (optional) | **Claude API** (`@anthropic-ai/sdk`, `claude-opus-5`, structured outputs) called from the Worker so the key never reaches the browser | 💤 Off until a key is set | — |
| AI Game Master | Tension-curve director (TypeScript) | ✅ In build; Claude-planned quests next | — |
| Enemy AI | Utility AI + steering behaviours | ✅ In build | Unity AI |
| Wildlife | Boids, predator/prey state machines, genome evolution per visit | ✅ In build; ONNX Runtime Web RL policies next | Unity ML-Agents |
| Audio | **Web Audio API** (procedural score + SFX) | ✅ In build | FMOD / Wwise |
| Saves | `localStorage` | ✅ In build; **Supabase** cloud saves next | Firebase / PlayFab |
| Physics | Custom arcade/Newtonian flight model; **Rapier** (WASM) planned for boarding | 🟡 Partial | Unity physics |
| Voice | Web Speech API → Whisper / ElevenLabs | ⏳ Planned | — |
| Assets | Procedural today; Blender → **glTF/GLB** + KTX2 next | 🟡 Partial | FBX / Unity assets |

### Project layout
```
projects/nexus-sentient-galaxy/
├── index.html              # HUD + panel markup
├── src/
│   ├── main.ts             # entry (WebGL 2 check → Game)
│   ├── game.ts             # orchestrator: modes, spawning, docking, landing, FTL, death
│   ├── core/               # seeded RNG + noise, input (keyboard/mouse/touch), saves, event bus
│   ├── render/             # renderer + bloom pipeline, GLSL planet/cloud/atmosphere/star/sky shaders
│   ├── world/              # galaxy + faction data, star-system scene (planets, belt, station)
│   ├── ships/              # ship models + flight model, combat (lasers/missiles/FX), utility AI
│   ├── surface/            # planet landing: terrain, flora, ecosystem, evolution
│   ├── npc/                # Claude dialogue client + offline fallback model
│   ├── gm/                 # Game Master director + contracts
│   ├── net/                # multiplayer client
│   ├── audio/              # procedural music + SFX
│   └── ui/                 # HUD, panels, styles
├── worker/
│   ├── index.ts            # /api/health, /api/npc (Claude), /api/rt/<system> (WebSocket)
│   └── room.ts             # SystemRoom Durable Object
└── wrangler.toml           # Worker, assets, Durable Object, custom domain
```

---

## 🛠️ Getting Started
Requirements: **Node.js 22+** and a browser with WebGL 2 (any current Chrome, Edge, Firefox or Safari).

```bash
git clone https://github.com/SJA-Pathway/PlayPath.git
cd PlayPath/projects/nexus-sentient-galaxy
npm install
npm run build && npx wrangler dev   # full game + multiplayer + API on http://localhost:8787
# or, for fast UI/graphics iteration with hot reload (solo, offline NPCs):
npm run dev                         # http://localhost:5173
```

No API keys are required. The aliens use the built-in dialogue data. (Optional: to try Claude-powered aliens locally, put `ANTHROPIC_API_KEY=...` in a git-ignored `.dev.vars`.)

Handy while developing: the running game is exposed as `window.nexus` in the browser console (for example `nexus.spawnRaid(3, true)` or `nexus.jump(5)`).

---

## 🧠 Contribution Guidelines
- 🌱 Beginners with some experience in JavaScript/TypeScript or Three.js are welcome.
- 🧩 Pick an issue tagged with an `epic:*` label that interests you, comment to claim it, and open a PR.
- 💬 Communicate via our Discord or GitHub discussions.
- 🔍 Put code in the matching `src/` module (see *Project layout*) and assets in `public/assets/{models,textures,audio}` (glTF, KTX2, OGG). Run `npm run typecheck` before opening a PR.

---

## ☁️ Deployment
- **Production:** https://playpath.sjapathway.com is the Cloudflare Worker `sja-playpath`. It serves the Vite build from `dist/`, and `/api/*` is handled by `worker/index.ts`.
- **Deploy:** run `npm run deploy` from `projects/nexus-sentient-galaxy/` (Node 22+, `wrangler login`). `npm run deploy:dev` deploys `sja-playpath-dev` on workers.dev without touching the custom domain.
- **No secrets needed.** The game runs fully without an API key. Optional: `npx wrangler secret put ANTHROPIC_API_KEY` switches aliens to Claude (`GET /api/health` then reports `"npc": true`).
- **Multiplayer** needs no extra setup: the `SystemRoom` Durable Object is declared in `wrangler.toml` (SQLite-backed, works on the free plan).

---

## 📈 Development Roadmap

NEXUS development is structured as **10 epics, 100 issues**. Phases are guidance, not gates — work happens in parallel.

| Phase | Epic                  | Focus                                                            |
|------:|-----------------------|------------------------------------------------------------------|
| 1     | `epic:foundation`     | Vite + TS + Three.js project, save/load, input, services, asset loading ✅ |
| 2     | `epic:galaxy-gen`     | Procedural galaxy, planets, biomes, atmospheres, AI lore         |
| 3     | `epic:ship-combat`    | Ship building, 6DoF flight, FTL, weapons, enemy AI, boarding     |
| 4     | `epic:ai-npc`         | LLM NPCs with memory, factions, alien language, moderation       |
| 5     | `epic:ecosystem-ml`   | In-browser RL wildlife (ONNX/TF.js), food chains, evolution, taming |
| 6     | `epic:ai-gm`          | AI Game Master, dynamic quests, world events, codex              |
| 7     | `epic:ui-ux`          | Holographic HUD, star map, photo mode, accessibility, i18n       |
| 8     | `epic:audio`          | Web Audio/Tone.js, adaptive music, AI voices, STT, mix states    |
| 9     | `epic:multiplayer`    | Durable Object rooms ✅, persistent universe, guilds, marketplace, WebRTC voice |
| 10    | `epic:polish-ship`    | CI/CD, optimization, alpha test, trailer, store pages, v1.0      |

---

## 🎨 Notes
- All art and assets used should be free or open-source.
- The game must run in desktop and mobile browsers. Target 60 fps on a mid-range laptop and 30 fps on phones.
- Write modular, reusable code so other PlayPath projects can borrow systems.

---

## 🪐 About PlayPath

**PlayPath** is the open-source game development platform by **SJA Pathway** that hosts NEXUS and other community games. It's designed for developers, artists, and enthusiasts to collaborate on creative games — powered by **web technologies** (Three.js, TypeScript, WebGL) and free cloud tools. Anyone can contribute, learn, and build playable games for free.

### Other PlayPath Projects
Each project lives under `projects/<project-name>` within the same repository and ships as a browser game.

- 🏎️ **RaceArena** – 2D/3D racing game with multiple tracks and vehicles
- 🧩 **PuzzleBox** – Logic and puzzle-solving game with levels
- ⚔️ **BattleZone** – Multiplayer battle arena over WebSockets (Durable Objects)
- 🏰 **AdventureQuest** – 3D exploration and quest-based game
- 🎯 **MiniGamesHub** – Collection of small casual browser games in one hub

Have an idea for a new project? Open an issue with the `proposal` label.
