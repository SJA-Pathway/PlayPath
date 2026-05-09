# 🌌 NEXUS: The Sentient Galaxy

> An AI-driven open-world space RPG where every alien is alive, every planet is unique, and the galaxy keeps moving without you.

Built in **Unity** with **C#**. Powered by LLMs, ML-Agents, and a community of open-source creators.
Hosted under **[PlayPath by SJA Pathway](#-about-playpath)** — a free, open game development platform.

[![Kanban Board](https://img.shields.io/badge/Kanban-100%20issues%20across%2010%20epics-0e1116?style=for-the-badge&logo=github)](https://github.com/SJA-Pathway/PlayPath/issues) [![Project Board](https://img.shields.io/badge/Project-Board-1d76db?style=for-the-badge&logo=github)](https://github.com/SJA-Pathway/PlayPath/projects) [![Unity](https://img.shields.io/badge/Unity-2022.3%20LTS-222c37?style=for-the-badge&logo=unity)](https://unity.com/) [![License](https://img.shields.io/badge/License-Open%20Source-0e8a16?style=for-the-badge)](#)

📋 **Track development:** [Kanban Board (Issues view)](https://github.com/SJA-Pathway/PlayPath/issues) · [Project Board (Kanban columns)](https://github.com/SJA-Pathway/PlayPath/projects) · [All Epics](https://github.com/SJA-Pathway/PlayPath/labels)

---

## 🚀 The Vision

NEXUS pushes AI integration further than anything in the genre. A galaxy where:

- 🧠 **LLM-driven NPCs** — every alien you meet is backed by an LLM agent with persistent memory across sessions
- 🪐 **AI-procedural galaxy** — 10,000+ star systems with planets, biomes, lore, and atmospheres generated on demand
- 🎭 **AI Game Master** — an orchestrator that improvises quests, world events, and tension curves around your playstyle
- 🦎 **ML-Agents wildlife** — alien fauna trained with reinforcement learning, evolving across generations
- 🎵 **Adaptive AI music** — per-planet themes generated and remixed on the fly
- 🎙️ **Voice with aliens** — STT (Whisper) + TTS (ElevenLabs) so you literally talk to NPCs
- 🌐 **Persistent shared universe** — Photon-networked, civilizations rise and fall while you're offline

**Project location:** `projects/nexus-sentient-galaxy/`

---

## 🎮 Gameplay Overview

You begin as a lone pilot in a procedurally-generated galaxy. From there the game unfolds along six pillars — each backed by a dedicated development epic on the [Kanban board](https://github.com/SJA-Pathway/PlayPath/issues).

### 🪐 Explore
Pilot a fully customizable spaceship through **10,000+ star systems** with 6DoF Newtonian flight. Charge an **FTL warp drive** to jump through trade lanes — where pirates may patrol. Land on planets with seamless atmospheric entry, walk surfaces shaped by noise-based heightmaps, scan one of six biomes (lava, ice, ocean, jungle, desert, gas giant), and uncover **AI-generated lore** written for that world alone.

### 🛸 Fight
Build your ship from modular hardpoints — **lasers, missiles, railguns**, shields, engines. Enemy ships use **Utility-AI** tactics (aggressive, flee, ambush) and coordinate as squads. Damage is positional: target specific subsystems to disable rather than destroy. Cripple a hostile vessel, **board it**, and fight its crew in interior FPS combat — then add it to your fleet.

### 🧠 Talk
Every alien is a real **LLM agent** with **persistent memory across sessions**. Speak in text or with your voice via **Whisper STT** — they reply with **ElevenLabs TTS**. They remember the deal you struck three sessions ago, the faction leader you betrayed, the rumor you spread. They keep daily schedules, hold grudges, gossip with each other in the background. Build reputation with **factions**; their tone shifts as you do. Learn alien languages word by word as you play.

### 🦎 Hunt & Tame
Alien wildlife is trained with **Unity ML-Agents reinforcement learning**. Herbivores forage and flock; predators stalk and ambush. Populations rise and fall on their own — a real ecosystem. **Tame** creatures, **breed** them, and watch their **DNA drift across generations** every time you return to a planet.

### 🎭 Be Surprised
An **AI Game Master** orchestrates the galaxy. It watches your playstyle, reads narrative tension curves, and spawns dynamic events — wars, plagues, discoveries — and proposes quests fitted to your archetype. Choices ripple: kill a faction leader and the economy and diplomacy actually shift. A **Codex** auto-writes itself with everything you witness, so your playthrough is its own book.

### 🌐 Play Together
**Photon-networked** multiplayer with **proximity voice chat**. The universe is persistent and **shared** — civilizations evolve while you're offline. Trade in a server-authoritative **marketplace**, form **guilds and fleets** with shared treasuries and quests.

> Every line above maps to issues on the [Kanban backlog](https://github.com/SJA-Pathway/PlayPath/issues) — filter by `epic:galaxy-gen`, `epic:ship-combat`, `epic:ai-npc`, `epic:ecosystem-ml`, `epic:ai-gm`, or `epic:multiplayer`.

---

## 🗺️ Backlog

[100 issues across 10 epics](https://github.com/SJA-Pathway/PlayPath/issues) — filter by epic label:

`epic:foundation` · `epic:galaxy-gen` · `epic:ai-npc` · `epic:ai-gm` · `epic:ship-combat` · `epic:ecosystem-ml` · `epic:multiplayer` · `epic:ui-ux` · `epic:audio` · `epic:polish-ship`

---

## 🧩 Tech Stack

| Layer            | Technology                       | Notes                                       |
|------------------|----------------------------------|---------------------------------------------|
| Game Engine      | Unity 2022.3 LTS (URP)           | 2D/3D game engine, supports C#              |
| Scripting        | C#                               | Logic and game mechanics                    |
| Cloud Storage    | Firebase / PlayFab               | Free cloud storage & player data            |
| Multiplayer      | Photon Fusion / PUN 2 / Mirror   | Free networking for multiplayer games       |
| LLM Providers    | Anthropic / OpenAI               | NPC dialogue, AI Game Master, lore gen      |
| ML / RL          | Unity ML-Agents                  | Trained alien wildlife and ecosystems       |
| Voice (STT/TTS)  | Whisper / ElevenLabs             | Voice chat with NPCs                        |
| AI Music         | Suno / Stable Audio              | Per-planet adaptive themes                  |
| Audio Middleware | FMOD / Wwise                     | Adaptive soundtrack and mixer snapshots     |
| Design / Art     | Blender / GIMP                   | Free 3D modeling and graphics tools         |
| Version Control  | GitHub                           | Free public repositories                    |

---

## 🛠️ Getting Started
1. **Fork** this repository.
2. **Clone** your fork:
   ```bash
   git clone https://github.com/yourusername/playpath.git
   cd playpath
   ```
3. Open the project in Unity Hub (Unity 2022.3 LTS).
4. Open the scene in `Assets/Scenes/Main.unity`.
5. Run locally using the Unity editor or build for PC / WebGL / Mac / iOS / Android.

---

## 🧠 Contribution Guidelines
- 🌱 Beginners with some experience in Unity or C# are welcome.
- 🧩 Pick an issue tagged with an `epic:*` label that interests you, comment to claim it, and open a PR.
- 💬 Communicate via our Discord or GitHub discussions.
- 🔍 Follow Unity best practices and keep assets organized in `Assets/_Nexus/{Art,Audio,Code,Prefabs,Scenes,...}`.

---

## ☁️ Deployment
- Push to `main` → GitHub repository serves as version control.
- Unity games can be deployed for free to:
  - Itch.io
  - PlayFab / Firebase for backend support
  - WebGL builds hosted on GitHub Pages

---

## 📈 Development Roadmap

NEXUS development is structured as **10 epics, 100 issues**. Phases are guidance, not gates — work happens in parallel.

| Phase | Epic                  | Focus                                                            |
|------:|-----------------------|------------------------------------------------------------------|
| 1     | `epic:foundation`     | Unity project, save/load, input, services, addressables          |
| 2     | `epic:galaxy-gen`     | Procedural galaxy, planets, biomes, atmospheres, AI lore         |
| 3     | `epic:ship-combat`    | Ship building, 6DoF flight, FTL, weapons, enemy AI, boarding     |
| 4     | `epic:ai-npc`         | LLM NPCs with memory, factions, alien language, moderation       |
| 5     | `epic:ecosystem-ml`   | ML-Agents wildlife, food chains, evolution, taming, bestiary     |
| 6     | `epic:ai-gm`          | AI Game Master, dynamic quests, world events, codex              |
| 7     | `epic:ui-ux`          | Holographic HUD, star map, photo mode, accessibility, i18n       |
| 8     | `epic:audio`          | FMOD/Wwise, adaptive music, AI voices, STT, mixer snapshots      |
| 9     | `epic:multiplayer`    | Photon, persistent universe, guilds, marketplace, voice chat     |
| 10    | `epic:polish-ship`    | CI/CD, optimization, alpha test, trailer, store pages, v1.0      |

---

## 🎨 Notes
- All art and assets used should be free or open-source.
- Builds should support both PC and WebGL where possible.
- Write modular, reusable code so other PlayPath projects can borrow systems.

---

## 🪐 About PlayPath

**PlayPath** is the open-source game development platform by **SJA Pathway** that hosts NEXUS and other community games. It's designed for developers, artists, and enthusiasts to collaborate on creative games — powered by **Unity**, **C#**, and free cloud tools. Anyone can contribute, learn, and build playable games for free.

### Other PlayPath Projects
Each project lives under `projects/<project-name>` within the same Unity repository.

- 🏎️ **RaceArena** – 2D/3D racing game with multiple tracks and vehicles
- 🧩 **PuzzleBox** – Logic and puzzle-solving game with levels
- ⚔️ **BattleZone** – Multiplayer battle arena with Photon or Mirror
- 🏰 **AdventureQuest** – 3D exploration and quest-based game
- 🎯 **MiniGamesHub** – Collection of small casual games in one Unity project

Have an idea for a new project? Open an issue with the `proposal` label.
