# 🎮 PlayPath by SJA Pathway

**PlayPath** is an open-source game development platform by **SJA Pathway**.  
It’s designed for developers, artists, and enthusiasts to collaborate on fun, creative games — powered by **Unity**, **C#**, and free cloud tools.  
Anyone can contribute, learn, and build playable games for free.

---

## 🚀 Vision
Empower creators to build, share, and collaborate on games of all genres — from 2D puzzle games to 3D multiplayer experiences — without barriers or cost.

---

## 🌌 Flagship Project: NEXUS — The Sentient Galaxy

Our headline project is **NEXUS: The Sentient Galaxy**, an open-world space RPG built in Unity that pushes AI integration further than anything in the genre.

**What makes it different:**
- 🧠 **LLM-driven NPCs** — every alien you meet is backed by an LLM agent with persistent memory across sessions
- 🪐 **AI-procedural galaxy** — 10,000+ star systems with planets, biomes, lore, and atmospheres generated on demand
- 🎭 **AI Game Master** — an orchestrator that improvises quests, world events, and tension curves around your playstyle
- 🦎 **ML-Agents wildlife** — alien fauna trained with reinforcement learning, evolving across generations
- 🎵 **Adaptive AI music** — per-planet themes generated and remixed on the fly
- 🎙️ **Voice with aliens** — STT (Whisper) + TTS (ElevenLabs) so you literally talk to NPCs
- 🌐 **Persistent shared universe** — Photon-networked, civilizations rise and fall while you're offline

**Project location:** `projects/nexus-sentient-galaxy/`

**Backlog:** [100 issues across 10 epics](https://github.com/SJA-Pathway/PlayPath/issues) — `epic:foundation`, `epic:galaxy-gen`, `epic:ai-npc`, `epic:ai-gm`, `epic:ship-combat`, `epic:ecosystem-ml`, `epic:multiplayer`, `epic:ui-ux`, `epic:audio`, `epic:polish-ship`.

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

## 💡 Example Mini Projects
- 🌌 **NEXUS: The Sentient Galaxy** – AI-powered open-world space RPG (flagship — see above)
- 🏎️ **RaceArena** – 2D/3D racing game with multiple tracks and vehicles
- 🧩 **PuzzleBox** – Logic and puzzle-solving game with levels
- ⚔️ **BattleZone** – Multiplayer battle arena with Photon or Mirror
- 🏰 **AdventureQuest** – 3D exploration and quest-based game
- 🎯 **MiniGamesHub** – Collection of small casual games in one Unity project

Each project lives under `projects/<project-name>` within the same Unity repository.

---

## 🛠️ Getting Started
1. **Fork** this repository.  
2. **Clone** your fork:
   ```bash
   git clone https://github.com/yourusername/playpath.git
   cd playpath
   ```
3.	Open the project in Unity Hub.
4.	Open the scene in Assets/Scenes/Main.unity.
5.	Run locally using the Unity editor or build for PC/Mac/iOS/Android.

---

## 🧠 Contribution Guidelines
	•	🌱 Beginners with some experience in Unity or C# are welcome.
	•	🧩 New projects require a short proposal under issues/.
	•	💬 Communicate via our Discord or GitHub discussions.
	•	🔍 Follow Unity best practices and keep assets organized.

---

## ☁️ Deployment
	•	Push to main → GitHub repository serves as version control.
	•	Unity games can be deployed for free to:
	•	Itch.io
	•	PlayFab / Firebase for backend support
	•	WebGL builds hosted on GitHub Pages

---

## 📈 Roadmap
	•	Add more mini-project templates for 2D and 3D games
	•	Implement multiplayer demo projects with Photon
	•	Add public contributor leaderboard
	•	Create tutorial series for beginners
	•	Allow user submissions for new games

---

## 🎨 Notes
	•	All art and assets used should be free or open-source.
	•	Games should support both PC and WebGL builds if possible.
	•	Encourage contributors to create modular, reusable code for game mechanics.
