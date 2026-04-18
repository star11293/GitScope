# 🔬 GitScope

**Talk to any codebase. Understand it in seconds.**

GitScope is an 8-stage analysis engine that combines deterministic code intelligence with Gemini's 2M-token context to give you full visibility into any GitHub repository. Paste a repo, get a complete diagnostic profile, then chat with the codebase.

Built solo at hackUMBC Mini Hackathon 2026 (12 hours).

## What it does

- **8-stage analysis pipeline** — file ranking, secret scanning, dependency extraction, code metrics, all validated by Gemini AI
- **Chat with any codebase** — ask questions, get answers grounded in real files with line numbers
- **Narrated walkthrough** — 6-scene guided tour with TTS and data-driven visualizations
- **Contributor onboarding** — beginner-friendly file suggestions, setup steps, improvement ideas
- **Head-to-head comparison** — compare two repos side-by-side across health, security, and quality
- **Interactive architecture graph** — SVG node diagram with click-to-view source

## The pipeline

GitHub API Fetch       → Clone repo, parse file tree, extract source files
File Importance Ranker → Score by import frequency, depth, size
Secret Scanner         → 12 regex patterns for API keys, passwords, credentials
Dependency Extractor   → Parse package.json, requirements.txt, etc.
Code Metrics Engine    → LOC, comment ratio, long files, tech debt
↓ Local findings + full codebase ↓
Gemini 1.5 Pro         → Validate findings against real source code (2M context)
↓
Post-Processor         → Merge local + AI findings, compute health score
Interactive Dashboard  → Chat, walkthrough, architecture graph, code viewer


Stages 1-5 are deterministic local analysis. Stage 6 is the only AI call. AI validates — it doesn't originate.

## Tech stack

| Layer | Tech |
|-------|------|
| Backend | Python / Flask |
| Frontend | React 18 (Vite) |
| AI Engine | Gemini 2.5 Flash |
| Context Window | 2M Tokens |
| Data Source | GitHub REST API |
| Static Analysis | 12 Regex Patterns |
| Visualization | Hand-written SVG |
| TTS | Web Speech API |

## Quick start

```bash
pip3 install flask flask-cors requests google-generativeai
export GEMINI_API_KEY='your-key-here'
export GITHUB_TOKEN='your-token-here'
python3 app.py
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## License

MIT
