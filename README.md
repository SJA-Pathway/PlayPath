# 🌌 NEXUS: The Sentient Galaxy

> An AI-driven open-world space RPG where every alien is alive, every planet is unique, and the galaxy keeps moving without you.

Built for the **web**: runs in any modern browser with **Three.js (WebGL)** and **TypeScript**, with no install or plugin needed. Powered by LLMs, in-browser ML, and a community of open-source creators.
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

## 🕹️ Play the Web Demo

A basic, playable prototype lives at [`projects/nexus-sentient-galaxy/demo/index.html`](projects/nexus-sentient-galaxy/demo/index.html). It is one self-contained HTML file that loads Three.js from a CDN, so there is no build step.

**What works in the demo (v0.1):**
- Third-person ship flight with throttle, pitch, yaw, boost and a chase camera
- 34 seeded star systems on a clickable star map, with FTL jumps between them
- Procedural planets in six biomes (lava, ice, ocean, jungle, desert, gas giant) with generated textures, atmospheres, rings and lore
- Planet scanning that writes discoveries to a live Codex log
- Alien comms: every planet has a named alien with a faction and a temperament. They remember your name, your visits, what you talked about and how you treated them. This is stored in the browser with `localStorage`.
- Pirate drones that steer, orbit and fire leading shots, with lasers, shields, hull, bounties and salvage
- A simple Game Master that spawns raids, derelicts, flares and rumours on a tension curve and backs off when you are hurt
- Adaptive Web Audio music that retunes per system and intensifies in combat, plus synthesized SFX
- A radar, a HUD and touch controls for phones

**Stand-ins in the demo:** the alien dialogue uses an offline keyword model instead of a real LLM. The Game Master is a heuristic, not an AI agent. Enemies use scripted steering, not trained ML models. There is no multiplayer and no backend yet. Each of these maps to an epic below.

**Run it locally:**
```bash
cd projects/nexus-sentient-galaxy/demo
npx serve .        # or: python3 -m http.server 8080
```
Then open the printed URL. You can also double-click `index.html`.

**Controls:** `↑` `↓` throttle · `W` `S` pitch · `A` `D` turn · `Shift` boost · `Space` fire · `C` scan · `T` hail · `M` star map · `N` mute · `Esc` close panels

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
**WebSocket multiplayer** (Colyseus) with **proximity voice chat**. The universe is persistent and **shared** — civilizations evolve while you're offline. Trade in a server-authoritative **marketplace**, form **guilds and fleets** with shared treasuries and quests.

> Every line above maps to issues on the [Kanban backlog](https://github.com/SJA-Pathway/PlayPath/issues) — filter by `epic:galaxy-gen`, `epic:ship-combat`, `epic:ai-npc`, `epic:ecosystem-ml`, `epic:ai-gm`, or `epic:multiplayer`.

---

## 🗺️ Backlog

[100 issues across 10 epics](https://github.com/SJA-Pathway/PlayPath/issues) — filter by epic label:

`epic:foundation` · `epic:galaxy-gen` · `epic:ai-npc` · `epic:ai-gm` · `epic:ship-combat` · `epic:ecosystem-ml` · `epic:multiplayer` · `epic:ui-ux` · `epic:audio` · `epic:polish-ship`

---

## 🧩 Tech Stack

NEXUS moved from Unity to a **browser-native stack**. Everything runs on the open web, deploys as static files and a few serverless functions, and needs no engine license or plugin.

| Layer              | Technology                                   | Replaces (Unity plan)          | Notes                                               |
|--------------------|----------------------------------------------|--------------------------------|-----------------------------------------------------|
| Rendering          | **Three.js** (WebGL 2, WebGPU when ready)    | Unity URP                      | Scenes, materials, post-processing, instancing      |
| Language / build   | **TypeScript + Vite**                        | C#                             | Fast dev server, code-splitting, asset hashing      |
| Physics            | **Rapier** (WASM)                            | Unity physics                  | Deterministic rigid bodies for ships and boarding   |
| UI / HUD           | HTML/CSS overlay (Preact or plain DOM)       | uGUI                           | Accessible, themable, works on mobile               |
| Multiplayer        | **Colyseus** (WebSocket, server-authoritative) | Photon / Mirror             | Rooms per star system, state sync, marketplace      |
| Backend / data     | **Supabase** (Postgres, Auth, Realtime, Storage) | Firebase / PlayFab         | Saves, factions, codex, NPC memory (pgvector)       |
| LLM NPCs & AI GM   | **Claude API** via serverless proxy          | same                           | Keys never reach the browser; tool use for the GM   |
| ML wildlife        | **ONNX Runtime Web / TensorFlow.js**         | Unity ML-Agents                | Train offline in Python, run policies in-browser    |
| Audio              | **Web Audio API + Tone.js**                  | FMOD / Wwise                   | Adaptive layers, per-planet themes, spatial audio   |
| Voice (STT/TTS)    | Web Speech API → Whisper / ElevenLabs        | same                           | Browser speech first, cloud models for quality      |
| Voice chat         | WebRTC (LiveKit)                             | Photon Voice                   | Proximity chat between players                      |
| Assets             | Blender → **glTF/GLB**, KTX2 textures        | FBX / Unity assets             | Draco/Meshopt compression for fast loads            |
| Hosting            | GitHub Pages / Vercel / Cloudflare Pages     | itch.io WebGL build            | Static game + edge functions for APIs               |
| Version control    | GitHub                                       | same                           | Free public repositories                            |

---

## 🛠️ Getting Started
1. **Fork** this repository.
2. **Clone** your fork:
   ```bash
   git clone https://github.com/yourusername/playpath.git
   cd playpath
   ```
3. Play the prototype: `cd projects/nexus-sentient-galaxy/demo && npx serve .`
4. For the full game (once `epic:foundation` lands): `cd projects/nexus-sentient-galaxy && npm install && npm run dev`, then open `http://localhost:5173`.
5. Requirements: Node.js 20+ and a browser with WebGL 2 (any current Chrome, Edge, Firefox or Safari).

---

## 🧠 Contribution Guidelines
- 🌱 Beginners with some experience in JavaScript/TypeScript or Three.js are welcome.
- 🧩 Pick an issue tagged with an `epic:*` label that interests you, comment to claim it, and open a PR.
- 💬 Communicate via our Discord or GitHub discussions.
- 🔍 Keep code in `projects/nexus-sentient-galaxy/src/{core,world,ships,npc,gm,net,ui,audio}` and assets in `public/assets/{models,textures,audio}` (glTF, KTX2, OGG).

---

## ☁️ Deployment
- **Live demo:** https://playpath.sjapathway.com, a Cloudflare Worker (`sja-playpath`) serving `demo/` as static assets. Redeploy with `npx wrangler deploy` from `projects/nexus-sentient-galaxy/` (Node 22+).
- Full game: push to `main` → build with Vite and deploy the same way.
- Serverless API routes (LLM proxy, GM orchestrator) deploy to **Vercel** or **Cloudflare Workers**.
- The multiplayer server (Colyseus) runs on any Node host (Fly.io, Railway, a small VPS).
- Player data lives in **Supabase**.
- The static demo in `demo/` can be hosted anywhere as-is, including GitHub Pages and itch.io's HTML5 upload.

---

## 📈 Development Roadmap

NEXUS development is structured as **10 epics, 100 issues**. Phases are guidance, not gates — work happens in parallel.

| Phase | Epic                  | Focus                                                            |
|------:|-----------------------|------------------------------------------------------------------|
| 1     | `epic:foundation`     | Vite + TS + Three.js project, save/load, input, services, asset loading |
| 2     | `epic:galaxy-gen`     | Procedural galaxy, planets, biomes, atmospheres, AI lore         |
| 3     | `epic:ship-combat`    | Ship building, 6DoF flight, FTL, weapons, enemy AI, boarding     |
| 4     | `epic:ai-npc`         | LLM NPCs with memory, factions, alien language, moderation       |
| 5     | `epic:ecosystem-ml`   | In-browser RL wildlife (ONNX/TF.js), food chains, evolution, taming |
| 6     | `epic:ai-gm`          | AI Game Master, dynamic quests, world events, codex              |
| 7     | `epic:ui-ux`          | Holographic HUD, star map, photo mode, accessibility, i18n       |
| 8     | `epic:audio`          | Web Audio/Tone.js, adaptive music, AI voices, STT, mix states    |
| 9     | `epic:multiplayer`    | Colyseus, persistent universe, guilds, marketplace, WebRTC voice |
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
- ⚔️ **BattleZone** – Multiplayer battle arena over WebSockets (Colyseus)
- 🏰 **AdventureQuest** – 3D exploration and quest-based game
- 🎯 **MiniGamesHub** – Collection of small casual browser games in one hub

Have an idea for a new project? Open an issue with the `proposal` label.
