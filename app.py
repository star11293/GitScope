"""
GitScope — X-ray vision for any GitHub codebase.
Flask backend: GitHub API, local analysis pipeline, Gemini AI integration.
"""

import os
import re
import json
import time
import base64
import hashlib
import threading
from collections import defaultdict, Counter
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# ── Config ──────────────────────────────────────────────────────────────────
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

GITHUB_HEADERS = {"Accept": "application/vnd.github.v3+json"}
if GITHUB_TOKEN:
    GITHUB_HEADERS["Authorization"] = f"token {GITHUB_TOKEN}"

# Cache analyzed repos in memory (hackathon-grade persistence)
analysis_cache = {}

# Video cache on disk
VIDEO_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "video_cache")
os.makedirs(VIDEO_CACHE_DIR, exist_ok=True)
video_jobs = {}  # track in-progress video generations

# ── Secret scanning patterns ───────────────────────────────────────────────
SECRET_PATTERNS = [
    (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\']?([A-Za-z0-9_\-]{16,})', "API Key"),
    (r'(?i)(secret|password|passwd|pwd)\s*[=:]\s*["\']?([^\s"\']{8,})', "Password/Secret"),
    (r'(?i)(aws_access_key_id)\s*[=:]\s*["\']?(AKIA[A-Z0-9]{16})', "AWS Access Key"),
    (r'(?i)(aws_secret_access_key)\s*[=:]\s*["\']?([A-Za-z0-9/+=]{40})', "AWS Secret Key"),
    (r'(?i)(token|auth_token|access_token)\s*[=:]\s*["\']?([A-Za-z0-9_\-\.]{20,})', "Auth Token"),
    (r'(?i)(mongodb(\+srv)?://[^\s"\']+)', "MongoDB Connection String"),
    (r'(?i)(postgres(ql)?://[^\s"\']+)', "PostgreSQL Connection String"),
    (r'(?i)(mysql://[^\s"\']+)', "MySQL Connection String"),
    (r'(?i)(redis://[^\s"\']+)', "Redis Connection String"),
    (r'(?i)(sk-[A-Za-z0-9]{32,})', "OpenAI API Key"),
    (r'(?i)(ghp_[A-Za-z0-9]{36})', "GitHub Personal Access Token"),
    (r'(?i)(AIza[A-Za-z0-9_\-]{35})', "Google API Key"),
    (r'-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----', "Private Key"),
    (r'(?i)(DATABASE_URL)\s*[=:]\s*["\']?([^\s"\']+)', "Database URL"),
]

# ── Dependency file mapping ────────────────────────────────────────────────
DEP_FILES = {
    "package.json": "npm (JavaScript/TypeScript)",
    "requirements.txt": "pip (Python)",
    "Pipfile": "pipenv (Python)",
    "pyproject.toml": "Poetry/PEP 517 (Python)",
    "Cargo.toml": "Cargo (Rust)",
    "go.mod": "Go Modules",
    "Gemfile": "Bundler (Ruby)",
    "pom.xml": "Maven (Java)",
    "build.gradle": "Gradle (Java/Kotlin)",
    "composer.json": "Composer (PHP)",
    "pubspec.yaml": "Pub (Dart/Flutter)",
    "mix.exs": "Mix (Elixir)",
    "Package.swift": "Swift Package Manager",
}

# File extensions → language
EXT_LANG = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript", ".jsx": "React JSX",
    ".tsx": "React TSX", ".java": "Java", ".rs": "Rust", ".go": "Go", ".rb": "Ruby",
    ".php": "PHP", ".c": "C", ".cpp": "C++", ".h": "C/C++ Header", ".cs": "C#",
    ".swift": "Swift", ".kt": "Kotlin", ".dart": "Dart", ".lua": "Lua",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".vue": "Vue",
    ".svelte": "Svelte", ".md": "Markdown", ".json": "JSON", ".yaml": "YAML",
    ".yml": "YAML", ".toml": "TOML", ".sql": "SQL", ".sh": "Shell",
    ".dockerfile": "Dockerfile", ".xml": "XML",
}

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".next", "dist", "build",
    "venv", ".venv", "env", ".env", "vendor", ".idea", ".vscode",
    "coverage", ".cache", "target", "bin", "obj",
}

SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2",
    ".ttf", ".eot", ".mp3", ".mp4", ".webm", ".zip", ".tar", ".gz",
    ".lock", ".min.js", ".min.css", ".map", ".pyc",
}


# ═══════════════════════════════════════════════════════════════════════════
# GITHUB API LAYER
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/api/user/<username>/repos", methods=["GET"])
def get_user_repos(username):
    """Fetch public repos for a GitHub user."""
    url = f"https://api.github.com/users/{username}/repos"
    params = {"sort": "updated", "per_page": 30, "type": "public"}
    r = requests.get(url, headers=GITHUB_HEADERS, params=params)
    if r.status_code == 404:
        return jsonify({"error": f"User '{username}' not found"}), 404
    if r.status_code != 200:
        return jsonify({"error": "GitHub API error", "status": r.status_code}), r.status_code

    repos = []
    for repo in r.json():
        repos.append({
            "name": repo["name"],
            "full_name": repo["full_name"],
            "description": repo.get("description", ""),
            "language": repo.get("language", "Unknown"),
            "stars": repo.get("stargazers_count", 0),
            "forks": repo.get("forks_count", 0),
            "updated_at": repo.get("updated_at", ""),
            "url": repo.get("html_url", ""),
            "size": repo.get("size", 0),
            "default_branch": repo.get("default_branch", "main"),
        })
    return jsonify({"username": username, "repos": repos})


def fetch_repo_tree(owner, repo, branch="main"):
    """Fetch the full file tree using GitHub Trees API (single API call)."""
    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    r = requests.get(url, headers=GITHUB_HEADERS)
    if r.status_code != 200:
        # Try 'master' branch as fallback
        url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/master?recursive=1"
        r = requests.get(url, headers=GITHUB_HEADERS)
        if r.status_code != 200:
            return None
    data = r.json()
    return data.get("tree", [])


def fetch_file_content(owner, repo, path):
    """Fetch a single file's content from GitHub."""
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    r = requests.get(url, headers=GITHUB_HEADERS)
    if r.status_code != 200:
        return None
    data = r.json()
    if data.get("encoding") == "base64":
        try:
            return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        except Exception:
            return None
    return data.get("content", "")


# ═══════════════════════════════════════════════════════════════════════════
# LOCAL ANALYSIS PIPELINE
# ═══════════════════════════════════════════════════════════════════════════

def analyze_file_tree(tree):
    """Parse the file tree into structured data with language stats."""
    files = []
    dirs = set()
    lang_counter = Counter()
    total_size = 0

    for item in tree:
        path = item.get("path", "")
        item_type = item.get("type", "")

        # Skip ignored directories
        parts = path.split("/")
        if any(p in SKIP_DIRS for p in parts):
            continue

        if item_type == "tree":
            dirs.add(path)
        elif item_type == "blob":
            ext = os.path.splitext(path)[1].lower()
            if ext in SKIP_EXTENSIONS:
                continue
            size = item.get("size", 0)
            lang = EXT_LANG.get(ext, "Other")
            lang_counter[lang] += 1
            total_size += size
            files.append({
                "path": path,
                "size": size,
                "extension": ext,
                "language": lang,
                "sha": item.get("sha", ""),
            })

    return {
        "files": files,
        "directories": list(dirs),
        "file_count": len(files),
        "dir_count": len(dirs),
        "total_size": total_size,
        "languages": dict(lang_counter.most_common(15)),
    }


def rank_files_by_importance(files):
    """
    Rank files by structural importance.
    Entry points, configs, and core modules score highest.
    """
    ENTRY_POINTS = {
        "app.py", "main.py", "index.js", "index.ts", "index.tsx", "index.jsx",
        "server.js", "server.ts", "app.js", "app.ts", "app.tsx", "app.jsx",
        "manage.py", "main.go", "main.rs", "lib.rs", "mod.rs",
        "index.html", "App.vue", "App.svelte",
    }
    CONFIG_FILES = {
        "package.json", "tsconfig.json", "webpack.config.js", "vite.config.js",
        "vite.config.ts", "next.config.js", "next.config.mjs",
        "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod",
        "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
        ".env.example", "Makefile", "Procfile",
    }
    README_FILES = {"README.md", "readme.md", "README.rst", "README.txt", "README"}

    scored = []
    for f in files:
        score = 0
        name = os.path.basename(f["path"])
        path = f["path"]
        depth = path.count("/")

        # Entry points
        if name in ENTRY_POINTS:
            score += 100
        # Config files
        if name in CONFIG_FILES:
            score += 80
        # README
        if name in README_FILES:
            score += 90
        # Root-level files score higher
        if depth == 0:
            score += 30
        elif depth == 1:
            score += 15
        # Source code scores higher than data
        if f["language"] not in ("JSON", "YAML", "TOML", "Markdown", "Other"):
            score += 20
        # Larger files tend to be more important (diminishing returns)
        score += min(f["size"] / 500, 25)
        # Routes/views/models/controllers
        for keyword in ["route", "view", "model", "controller", "handler",
                        "middleware", "schema", "service", "util", "api"]:
            if keyword in path.lower():
                score += 15

        f["importance_score"] = round(score, 1)
        scored.append(f)

    scored.sort(key=lambda x: x["importance_score"], reverse=True)
    return scored


def scan_for_secrets(files_with_content):
    """Scan file contents for hardcoded secrets and credentials."""
    findings = []
    for path, content in files_with_content.items():
        lines = content.split("\n")
        for line_num, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("*"):
                continue
            for pattern, label in SECRET_PATTERNS:
                if re.search(pattern, line):
                    # Mask the actual value
                    masked_line = line.strip()[:80] + ("..." if len(line.strip()) > 80 else "")
                    findings.append({
                        "type": label,
                        "file": path,
                        "line": line_num,
                        "preview": masked_line,
                        "severity": "high" if "key" in label.lower() or "password" in label.lower() else "medium",
                    })
    return findings


def extract_dependencies(files_with_content):
    """Extract dependency information from package manifests."""
    deps = {}
    for path, content in files_with_content.items():
        filename = os.path.basename(path)
        if filename not in DEP_FILES:
            continue

        manager = DEP_FILES[filename]
        dep_list = []

        if filename == "package.json":
            try:
                pkg = json.loads(content)
                for section in ["dependencies", "devDependencies"]:
                    for name, ver in pkg.get(section, {}).items():
                        dep_list.append({"name": name, "version": ver,
                                         "dev": section == "devDependencies"})
            except json.JSONDecodeError:
                pass

        elif filename == "requirements.txt":
            for line in content.split("\n"):
                line = line.strip()
                if line and not line.startswith("#") and not line.startswith("-"):
                    parts = re.split(r'[=<>!~]', line)
                    name = parts[0].strip()
                    ver = line[len(name):].strip() if len(parts) > 1 else "*"
                    if name:
                        dep_list.append({"name": name, "version": ver, "dev": False})

        elif filename == "pyproject.toml":
            in_deps = False
            for line in content.split("\n"):
                if "[project.dependencies]" in line or "[tool.poetry.dependencies]" in line:
                    in_deps = True
                    continue
                if in_deps:
                    if line.strip().startswith("["):
                        break
                    if "=" in line:
                        parts = line.split("=")
                        dep_list.append({"name": parts[0].strip().strip('"'),
                                         "version": parts[1].strip().strip('"'), "dev": False})

        elif filename == "Cargo.toml":
            in_deps = False
            for line in content.split("\n"):
                if "[dependencies]" in line:
                    in_deps = True
                    continue
                if in_deps:
                    if line.strip().startswith("["):
                        break
                    if "=" in line:
                        parts = line.split("=")
                        dep_list.append({"name": parts[0].strip(),
                                         "version": parts[1].strip().strip('"'), "dev": False})

        if dep_list:
            deps[path] = {"manager": manager, "dependencies": dep_list, "count": len(dep_list)}

    return deps


def compute_quality_metrics(files_with_content):
    """Compute basic code quality metrics."""
    total_lines = 0
    total_code_lines = 0
    total_comment_lines = 0
    total_blank_lines = 0
    long_files = []
    long_functions = []

    for path, content in files_with_content.items():
        lines = content.split("\n")
        loc = len(lines)
        total_lines += loc

        code = 0
        comments = 0
        blanks = 0
        for line in lines:
            stripped = line.strip()
            if not stripped:
                blanks += 1
            elif stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
                comments += 1
            else:
                code += 1

        total_code_lines += code
        total_comment_lines += comments
        total_blank_lines += blanks

        if loc > 300:
            long_files.append({"path": path, "lines": loc})

        # Naive long function detection (Python def / JS function)
        current_func = None
        func_start = 0
        for i, line in enumerate(lines):
            if re.match(r'\s*(def |function |const \w+ = |class )', line):
                if current_func and (i - func_start) > 50:
                    long_functions.append({
                        "path": path, "name": current_func,
                        "lines": i - func_start, "start_line": func_start + 1
                    })
                current_func = line.strip()[:60]
                func_start = i

    comment_ratio = round(total_comment_lines / max(total_code_lines, 1) * 100, 1)

    return {
        "total_lines": total_lines,
        "code_lines": total_code_lines,
        "comment_lines": total_comment_lines,
        "blank_lines": total_blank_lines,
        "comment_ratio": comment_ratio,
        "long_files": sorted(long_files, key=lambda x: x["lines"], reverse=True)[:10],
        "long_functions": sorted(long_functions, key=lambda x: x["lines"], reverse=True)[:10],
    }


# ═══════════════════════════════════════════════════════════════════════════
# GEMINI AI LAYER
# ═══════════════════════════════════════════════════════════════════════════

def build_gemini_prompt(local_analysis, files_content):
    """Build the hybrid prompt: local findings + full source."""
    prompt = """You are GitScope's AI analysis engine. You have been given:
1. Structured findings from a local deterministic analysis pipeline
2. The actual source code of the repository

Your job is to validate the local findings against the real code, provide deep architectural analysis, and generate actionable insights.

═══ LOCAL PIPELINE FINDINGS ═══
""" + json.dumps(local_analysis, indent=2) + """

═══ REPOSITORY SOURCE CODE ═══
"""
    # Add file contents (cap at ~200KB to stay within context limits)
    total_chars = 0
    for path, content in files_content.items():
        if total_chars > 200_000:
            break
        header = f"\n───── FILE: {path} ─────\n"
        prompt += header + content + "\n"
        total_chars += len(header) + len(content)

    prompt += """
═══ ANALYSIS INSTRUCTIONS ═══

Return ONLY a valid JSON object. No markdown, no backticks, no extra text before or after.
The JSON must have exactly these fields:

{
  "summary": "2-3 sentence plain-English description of what this project does and how it's built",
  "architecture": {
    "pattern": "e.g. MVC, microservices, monolith, serverless, static site, etc.",
    "entry_points": ["list of main entry files"],
    "key_modules": [
      {"name": "module name", "path": "file path", "purpose": "what it does"}
    ],
    "data_flow": "describe how data moves through the system"
  },
  "security": {
    "grade": "A/B/C/D/F",
    "confirmed_issues": [
      {"severity": "high/medium/low", "description": "what the issue is", "file": "path", "line": null, "fix": "how to fix it"}
    ],
    "positive_practices": ["list of good security practices found"]
  },
  "quality": {
    "grade": "A/B/C/D/F",
    "strengths": ["list of code quality strengths"],
    "improvements": ["list of suggested improvements"],
    "tech_debt": ["notable technical debt items"]
  },
  "contribute": {
    "setup_steps": ["step by step to get running locally"],
    "good_first_files": ["files a newcomer should read first"],
    "improvement_areas": ["concrete things a contributor could work on"]
  },
  "stack": ["list of technologies/frameworks detected"],
  "health_score": 0-100
}

Be specific. Reference actual file names and line numbers. Do not hallucinate files that don't exist in the source above.
"""
    return prompt


def clean_json_response(text):
    """Robustly extract JSON from Gemini's response."""
    text = text.strip()
    # Strip markdown code fences
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()

    # Try parsing as-is first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object in the text
    start = text.find('{')
    if start == -1:
        return None
    text = text[start:]

    # Try parsing from the start of the JSON object
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # If truncated, try to repair by closing open brackets/braces
    # Count open vs close braces
    repaired = text
    open_braces = repaired.count('{') - repaired.count('}')
    open_brackets = repaired.count('[') - repaired.count(']')

    # Check if we're inside a string (truncated mid-string)
    # Simple heuristic: if odd number of unescaped quotes, close the string
    quote_count = len(re.findall(r'(?<!\\)"', repaired))
    if quote_count % 2 == 1:
        repaired += '"'

    # Close any trailing comma
    repaired = re.sub(r',\s*$', '', repaired)

    # Close open brackets and braces
    repaired += ']' * open_brackets
    repaired += '}' * open_braces

    try:
        return json.loads(repaired)
    except json.JSONDecodeError as e:
        print(f"JSON repair failed: {e}")
        print(f"First 200 chars: {text[:200]}")
        return None


def call_gemini(prompt):
    """Call Gemini with the analysis prompt."""
    if not GEMINI_API_KEY:
        return None

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.2,
                max_output_tokens=8192,
            )
        )
        text = response.text.strip()
        result = clean_json_response(text)
        if result is None:
            print(f"Gemini returned unparseable response. First 300 chars: {text[:300]}")
        return result
    except Exception as e:
        print(f"Gemini error: {e}")
        return None


def call_gemini_chat(question, local_analysis, files_content):
    """Answer a follow-up question about the codebase."""
    if not GEMINI_API_KEY:
        return {"answer": "Gemini API key not configured.", "sources": []}

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = """You are GitScope's codebase assistant. You have the complete source code of a repository loaded.
Answer the user's question by referencing specific files and line numbers. Be concise and precise.

═══ CODEBASE ANALYSIS ═══
""" + json.dumps(local_analysis, indent=2) + """

═══ SOURCE CODE ═══
"""
    total_chars = 0
    for path, content in files_content.items():
        if total_chars > 200_000:
            break
        prompt += f"\n───── {path} ─────\n{content}\n"
        total_chars += len(content)

    prompt += f"""
═══ USER QUESTION ═══
{question}

═══ INSTRUCTIONS ═══
Return ONLY valid JSON (no markdown, no backticks, no extra text):
{{
  "answer": "your detailed answer referencing specific files",
  "sources": [
    {{"file": "path/to/file", "lines": "10-25", "relevance": "why this file matters"}}
  ],
  "follow_ups": ["3 suggested follow-up questions"]
}}
"""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=0.3, max_output_tokens=4096)
        )
        text = response.text.strip()
        result = clean_json_response(text)
        if result and isinstance(result, dict) and "answer" in result:
            return result
        # If clean_json_response failed but text looks like JSON, try one more time
        if text.strip().startswith("{"):
            try:
                # Strip markdown fences aggressively
                cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip())
                cleaned = re.sub(r'\s*```$', '', cleaned).strip()
                fallback = json.loads(cleaned)
                if isinstance(fallback, dict) and "answer" in fallback:
                    return fallback
            except json.JSONDecodeError:
                pass
        # Last resort: return raw text as the answer (strip any JSON wrapper artifacts)
        plain = text
        if plain.startswith("{") and '"answer"' in plain:
            # Try to extract just the answer value
            match = re.search(r'"answer"\s*:\s*"((?:[^"\\]|\\.)*)"', plain)
            if match:
                plain = match.group(1).replace('\\"', '"').replace('\\n', '\n')
        return {"answer": plain, "sources": [], "follow_ups": []}
    except Exception as e:
        return {"answer": f"Error: {str(e)}", "sources": [], "follow_ups": []}


def call_gemini_walkthrough(repo_name, local_analysis, ai_analysis, files_content):
    """Generate a structured walkthrough script for narrated codebase tour."""
    if not GEMINI_API_KEY:
        return _fallback_walkthrough(repo_name, local_analysis, ai_analysis)

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

    # Build a focused prompt for walkthrough generation
    prompt = f"""You are a friendly developer giving a casual, easy-to-follow walkthrough of a codebase.
Your audience is someone who might be NEW to open source — maybe even a first-time contributor. Avoid heavy jargon.
Be specific, reference real files, and sound like a helpful friend explaining things — NOT a textbook.
Use plain language. If you mention a technical concept, briefly explain what it means.

═══ REPOSITORY: {repo_name} ═══

═══ ANALYSIS DATA ═══
{json.dumps({"local": local_analysis, "ai": ai_analysis}, indent=2)}

═══ KEY SOURCE FILES ═══
"""
    total = 0
    for path, content in files_content.items():
        if total > 100_000:
            break
        prompt += f"\n───── {path} ─────\n{content[:3000]}\n"
        total += min(len(content), 3000)

    prompt += """

═══ INSTRUCTIONS ═══
Generate a 6-scene narrated walkthrough. Each scene should feel like a segment of a tech talk.
The narration text MUST sound conversational and natural when read aloud — use contractions,
casual phrasing, rhetorical questions, and varied sentence lengths. Avoid robotic listing.
Keep each narration to 3-5 sentences so it doesn't drag.

Return ONLY valid JSON (no markdown, no backticks):
{
  "title": "walkthrough title",
  "scenes": [
    {
      "id": 1,
      "title": "scene title (short, punchy)",
      "narration": "the text to be spoken aloud — conversational, engaging, specific to THIS repo",
      "visual_type": "one of: overview | architecture | code | security | stats | closing",
      "highlight_files": ["paths to relevant files"],
      "key_points": ["2-3 bullet takeaways"]
    }
  ]
}

Scene structure should be roughly:
1. The Big Picture (what is this project, who would use it)
2. How It's Built (the overall structure and tools used)
3. Where to Start Reading (which files to open first)
4. Code Quality (what's good, what could be better)
5. Security Check (any risks, and what's done well)
6. The Verdict (overall health, and how to get involved)
"""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=0.6, max_output_tokens=4096)
        )
        text = response.text.strip()
        result = clean_json_response(text)
        if result:
            return result
    except Exception as e:
        print(f"Walkthrough generation error: {e}")

    return _fallback_walkthrough(repo_name, local_analysis, ai_analysis)


def _fallback_walkthrough(repo_name, local_analysis, ai_analysis):
    """Generate a basic walkthrough when Gemini is unavailable."""
    langs = local_analysis.get("tree", {}).get("languages", {})
    primary = max(langs, key=langs.get) if langs else "code"
    files = local_analysis.get("tree", {}).get("file_count", 0)
    stack = ai_analysis.get("stack", [])
    summary = ai_analysis.get("summary", f"A {primary} project.")
    arch = ai_analysis.get("architecture", {})
    sec = ai_analysis.get("security", {})
    qual = ai_analysis.get("quality", {})
    score = ai_analysis.get("health_score", 50)
    top_files = [f["path"] for f in local_analysis.get("ranked_files", [])[:3]]

    return {
        "title": f"Walkthrough: {repo_name}",
        "scenes": [
            {
                "id": 1, "title": "The Big Picture",
                "narration": f"Alright, let's check out {repo_name}. {summary} It has {files} files, and the main language is {primary}.",
                "visual_type": "overview",
                "highlight_files": top_files[:1],
                "key_points": [f"Primary language: {primary}", f"{files} files total", ", ".join(stack[:4]) if stack else "Mixed stack"]
            },
            {
                "id": 2, "title": "How It's Built",
                "narration": f"This project uses a {arch.get('pattern', 'standard')} structure — that's basically how the code is organized. {arch.get('data_flow', 'Data moves through the main files in a straightforward way.')}",
                "visual_type": "architecture",
                "highlight_files": [m["path"] for m in arch.get("key_modules", [])[:3]],
                "key_points": [f"Pattern: {arch.get('pattern', 'N/A')}", f"Entry: {', '.join(arch.get('entry_points', [])[:2])}"]
            },
            {
                "id": 3, "title": "Where to Start Reading",
                "narration": f"If you're new to this codebase, open {top_files[0] if top_files else 'the main entry file'} first. That's the starting point — everything else branches out from there.",
                "visual_type": "code",
                "highlight_files": top_files[:2],
                "key_points": ["Start at the entry point", "Follow the imports outward"]
            },
            {
                "id": 4, "title": "Code Quality",
                "narration": f"Quality-wise, this repo {('does some things well: ' + ', '.join(qual.get('strengths', ['decent structure'])[:2]) + '.') if qual.get('strengths') else 'has decent structure overall.'} {'A few things could be better: ' + ', '.join(qual.get('improvements', [])[:2]) + '.' if qual.get('improvements') else 'Pretty clean codebase overall.'}",
                "visual_type": "stats",
                "highlight_files": [],
                "key_points": qual.get("strengths", ["N/A"])[:3]
            },
            {
                "id": 5, "title": "Security Check",
                "narration": "Security gets a " + sec.get('grade', '?') + " grade. " + ("Watch out — there are " + str(len(local_analysis.get("secrets", []))) + " possible secrets exposed in the code. Those should be moved to environment variables." if local_analysis.get('secrets') else "Good news: no exposed secrets were found.") + " The overall health score is " + str(score) + " out of 100.",
                "visual_type": "security",
                "highlight_files": [],
                "key_points": [f"Security: {sec.get('grade', '?')}", f"Quality: {qual.get('grade', '?')}", f"Health: {score}/100"]
            },
            {
                "id": 6, "title": "The Verdict",
                "narration": f"That's the full picture of {repo_name}. Health score: {score} out of 100, built mainly with {', '.join(stack[:3]) if stack else primary}. {'In good shape overall.' if score >= 60 else 'Room for improvement, but the foundation is solid.'} Head over to the Contribute tab if you want to get involved.",
                "visual_type": "closing",
                "highlight_files": [],
                "key_points": [f"Health: {score}/100", "Check contributor guide", "Start with entry points"]
            }
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/api/analyze", methods=["POST"])
def analyze_repo():
    """Full analysis pipeline: GitHub fetch → local analysis → Gemini AI."""
    data = request.json
    owner = data.get("owner", "")
    repo = data.get("repo", "")
    branch = data.get("branch", "main")

    if not owner or not repo:
        return jsonify({"error": "owner and repo are required"}), 400

    cache_key = f"{owner}/{repo}"
    if cache_key in analysis_cache:
        return jsonify(analysis_cache[cache_key])

    # ── Step 1: Fetch file tree ─────────────────────────────────────────
    tree = fetch_repo_tree(owner, repo, branch)
    if tree is None:
        return jsonify({"error": "Could not fetch repository. Check if it exists and is public."}), 404

    # ── Step 2: Parse and rank files ────────────────────────────────────
    tree_analysis = analyze_file_tree(tree)
    ranked_files = rank_files_by_importance(tree_analysis["files"])

    # ── Step 3: Fetch top files' content ────────────────────────────────
    top_files = ranked_files[:30]  # Fetch top 30 by importance
    files_content = {}
    for f in top_files:
        content = fetch_file_content(owner, repo, f["path"])
        if content:
            files_content[f["path"]] = content

    # ── Step 4: Run local pipeline ──────────────────────────────────────
    secrets = scan_for_secrets(files_content)
    dependencies = extract_dependencies(files_content)
    quality = compute_quality_metrics(files_content)

    local_analysis = {
        "repo": f"{owner}/{repo}",
        "tree": {
            "file_count": tree_analysis["file_count"],
            "dir_count": tree_analysis["dir_count"],
            "languages": tree_analysis["languages"],
            "total_size_kb": round(tree_analysis["total_size"] / 1024, 1),
        },
        "ranked_files": [{"path": f["path"], "score": f["importance_score"],
                          "language": f["language"]} for f in ranked_files[:20]],
        "secrets": secrets,
        "dependencies": dependencies,
        "quality": quality,
    }

    # ── Step 5: Gemini AI analysis ──────────────────────────────────────
    gemini_prompt = build_gemini_prompt(local_analysis, files_content)
    ai_analysis = call_gemini(gemini_prompt)

    # ── Step 6: Merge results ───────────────────────────────────────────
    result = {
        "repo": f"{owner}/{repo}",
        "analyzed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "local": local_analysis,
        "ai": ai_analysis or _fallback_ai_analysis(local_analysis),
        "files_analyzed": len(files_content),
        "total_files": tree_analysis["file_count"],
    }

    # Cache it (include files_content for walkthrough/chat)
    result["_files_content"] = files_content
    analysis_cache[cache_key] = result

    # Return without internal fields
    public_result = {k: v for k, v in result.items() if not k.startswith("_")}
    return jsonify(public_result)


@app.route("/api/chat", methods=["POST"])
def chat():
    """Ask a follow-up question about an analyzed repo."""
    data = request.json
    owner = data.get("owner", "")
    repo = data.get("repo", "")
    question = data.get("question", "")

    if not question:
        return jsonify({"error": "question is required"}), 400

    cache_key = f"{owner}/{repo}"
    cached = analysis_cache.get(cache_key)

    if not cached:
        return jsonify({"error": "Repo not analyzed yet. Run /api/analyze first."}), 400

    # Use cached file contents if available, otherwise re-fetch
    files_content = cached.get("_files_content", {})
    if not files_content:
        tree = fetch_repo_tree(owner, repo)
        if tree:
            tree_analysis = analyze_file_tree(tree)
            ranked = rank_files_by_importance(tree_analysis["files"])
            for f in ranked[:25]:
                content = fetch_file_content(owner, repo, f["path"])
                if content:
                    files_content[f["path"]] = content

    response = call_gemini_chat(question, cached["local"], files_content)
    return jsonify(response)


@app.route("/api/file", methods=["GET"])
def get_file():
    """Fetch a specific file's content for the code viewer."""
    owner = request.args.get("owner", "")
    repo = request.args.get("repo", "")
    path = request.args.get("path", "")
    if not all([owner, repo, path]):
        return jsonify({"error": "owner, repo, and path are required"}), 400
    content = fetch_file_content(owner, repo, path)
    if content is None:
        return jsonify({"error": "File not found"}), 404
    return jsonify({"path": path, "content": content})


@app.route("/api/walkthrough", methods=["POST"])
def generate_walkthrough():
    """Generate a narrated walkthrough script for a codebase."""
    data = request.json
    owner = data.get("owner", "")
    repo = data.get("repo", "")

    cache_key = f"{owner}/{repo}"
    cached = analysis_cache.get(cache_key)

    if not cached:
        return jsonify({"error": "Repo not analyzed yet. Run /api/analyze first."}), 400

    # Check for cached walkthrough
    wt_key = f"{cache_key}_walkthrough"
    if wt_key in analysis_cache:
        return jsonify(analysis_cache[wt_key])

    local = cached.get("local", {})
    ai = cached.get("ai", {})
    files_content = cached.get("_files_content", {})

    walkthrough = call_gemini_walkthrough(f"{owner}/{repo}", local, ai, files_content)
    analysis_cache[wt_key] = walkthrough
    return jsonify(walkthrough)


def _fallback_ai_analysis(local):
    """Generate a basic analysis when Gemini is unavailable."""
    langs = local["tree"]["languages"]
    primary_lang = max(langs, key=langs.get) if langs else "Unknown"
    file_count = local["tree"]["file_count"]
    secret_count = len(local["secrets"])

    # Determine grade based on local findings
    grade = "A"
    if secret_count > 0:
        grade = "C" if secret_count < 3 else "D"
    if local["quality"]["comment_ratio"] < 5:
        grade = chr(min(ord(grade) + 1, ord("F")))

    return {
        "summary": f"A {primary_lang}-based project with {file_count} files. "
                   f"Local analysis detected {secret_count} potential secret(s).",
        "architecture": {
            "pattern": "Could not determine (Gemini unavailable)",
            "entry_points": [f["path"] for f in local["ranked_files"][:3]],
            "key_modules": [],
            "data_flow": "Run with Gemini API key for full analysis."
        },
        "security": {
            "grade": grade,
            "confirmed_issues": [
                {"severity": s["severity"], "description": s["type"],
                 "file": s["file"], "line": s["line"], "fix": "Review and remove hardcoded credential"}
                for s in local["secrets"]
            ],
            "positive_practices": []
        },
        "quality": {
            "grade": "B",
            "strengths": [],
            "improvements": ["Enable Gemini for detailed analysis"],
            "tech_debt": []
        },
        "contribute": {
            "setup_steps": ["Clone the repository", "Check README for setup instructions"],
            "good_first_files": [f["path"] for f in local["ranked_files"][:5]],
            "improvement_areas": []
        },
        "stack": list(langs.keys())[:8],
        "health_score": max(40, 85 - secret_count * 15)
    }


# ═══════════════════════════════════════════════════════════════════════════
# VEO VIDEO GENERATION
# ═══════════════════════════════════════════════════════════════════════════

VEO_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Scene-type → cinematic video prompt templates
SCENE_VIDEO_PROMPTS = {
    "overview": "A cinematic close-up of a developer working at a desk with multiple monitors showing colorful code, soft ambient lighting, shallow depth of field, dark moody atmosphere with neon accents, professional tech aesthetic",
    "architecture": "An abstract 3D visualization of glowing interconnected nodes and data pathways in dark space, particles flowing between geometric shapes, futuristic network topology, cyan and blue color palette, smooth camera movement",
    "code": "A close-up cinematic shot of green terminal text scrolling rapidly on a dark screen, reflections visible on the glass, atmospheric lighting, hacker aesthetic, shallow focus",
    "security": "A cinematic shot of a translucent digital shield materializing with scanning light effects, cybersecurity aesthetic, dark background with cyan laser grid, dramatic lighting",
    "stats": "A futuristic holographic dashboard with floating charts, metrics and data visualizations rotating slowly in 3D space, dark background, glowing cyan and white elements, cinematic",
    "closing": "A slow cinematic drone shot pulling back from a glowing laptop screen to reveal a beautiful city skyline at golden hour, hopeful mood, warm tones transitioning to cool blue, professional"
}


def _generate_veo_video(scene_key, prompt, job_id):
    """Background worker: call Veo REST API and save the resulting MP4."""
    if not GEMINI_API_KEY:
        video_jobs[job_id] = {"status": "failed", "error": "No API key"}
        return

    video_jobs[job_id] = {"status": "generating", "started": time.time()}

    try:
        # Step 1: Start generation
        url = f"{VEO_BASE}/models/veo-3.1-fast-generate-preview:predictLongRunning"
        headers = {
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Type": "application/json"
        }
        body = {
            "instances": [{"prompt": prompt}],
            "parameters": {"aspectRatio": "16:9"}
        }
        r = requests.post(url, headers=headers, json=body)
        if r.status_code != 200:
            video_jobs[job_id] = {"status": "failed", "error": f"Veo API error {r.status_code}: {r.text[:200]}"}
            return

        operation_name = r.json().get("name")
        if not operation_name:
            video_jobs[job_id] = {"status": "failed", "error": "No operation name returned"}
            return

        # Step 2: Poll for completion (max 5 minutes)
        for _ in range(60):
            time.sleep(5)
            status_r = requests.get(
                f"{VEO_BASE}/{operation_name}",
                headers={"x-goog-api-key": GEMINI_API_KEY}
            )
            status_data = status_r.json()
            if status_data.get("done"):
                # Extract video URI
                video_uri = None
                try:
                    samples = status_data["response"]["generateVideoResponse"]["generatedSamples"]
                    video_uri = samples[0]["video"]["uri"]
                except (KeyError, IndexError):
                    video_jobs[job_id] = {"status": "failed", "error": "Could not extract video URI"}
                    return

                # Step 3: Download video
                dl = requests.get(video_uri, headers={"x-goog-api-key": GEMINI_API_KEY}, allow_redirects=True)
                if dl.status_code == 200:
                    filepath = os.path.join(VIDEO_CACHE_DIR, f"{job_id}.mp4")
                    with open(filepath, "wb") as f:
                        f.write(dl.content)
                    video_jobs[job_id] = {"status": "done", "path": filepath, "size": len(dl.content)}
                    print(f"  ✓ Video saved: {job_id}.mp4 ({len(dl.content)//1024}KB)")
                else:
                    video_jobs[job_id] = {"status": "failed", "error": f"Download failed: {dl.status_code}"}
                return

        video_jobs[job_id] = {"status": "failed", "error": "Timed out after 5 minutes"}

    except Exception as e:
        video_jobs[job_id] = {"status": "failed", "error": str(e)}
        print(f"  ✗ Video generation error: {e}")


@app.route("/api/video/generate", methods=["POST"])
def start_video_generation():
    """Start generating a video clip for a walkthrough scene."""
    data = request.json
    scene_type = data.get("scene_type", "overview")
    custom_prompt = data.get("prompt", "")
    repo = data.get("repo", "unknown")

    # Build job ID for caching
    job_id = hashlib.md5(f"{repo}_{scene_type}".encode()).hexdigest()[:12]

    # Check disk cache first
    cached_path = os.path.join(VIDEO_CACHE_DIR, f"{job_id}.mp4")
    if os.path.exists(cached_path):
        return jsonify({"job_id": job_id, "status": "done"})

    # Check if already generating
    if job_id in video_jobs and video_jobs[job_id]["status"] == "generating":
        return jsonify({"job_id": job_id, "status": "generating"})

    # Build prompt
    prompt = custom_prompt or SCENE_VIDEO_PROMPTS.get(scene_type, SCENE_VIDEO_PROMPTS["overview"])

    # Start background generation
    t = threading.Thread(target=_generate_veo_video, args=(scene_type, prompt, job_id), daemon=True)
    t.start()

    return jsonify({"job_id": job_id, "status": "generating"})


@app.route("/api/video/status/<job_id>", methods=["GET"])
def video_status(job_id):
    """Check the status of a video generation job."""
    # Check disk cache
    cached_path = os.path.join(VIDEO_CACHE_DIR, f"{job_id}.mp4")
    if os.path.exists(cached_path):
        return jsonify({"job_id": job_id, "status": "done"})

    job = video_jobs.get(job_id)
    if not job:
        return jsonify({"job_id": job_id, "status": "not_found"})
    return jsonify({"job_id": job_id, "status": job["status"], "error": job.get("error")})


@app.route("/api/video/file/<job_id>", methods=["GET"])
def serve_video(job_id):
    """Serve a generated video file."""
    # Sanitize job_id to prevent path traversal
    safe_id = re.sub(r'[^a-f0-9]', '', job_id)[:12]
    filepath = os.path.join(VIDEO_CACHE_DIR, f"{safe_id}.mp4")
    if os.path.exists(filepath):
        return send_file(filepath, mimetype="video/mp4")
    return jsonify({"error": "Video not found"}), 404


@app.route("/api/video/generate-all", methods=["POST"])
def generate_all_scene_videos():
    """Kick off video generation for all 6 walkthrough scenes in parallel."""
    data = request.json
    repo = data.get("repo", "unknown")

    results = {}
    for scene_type in SCENE_VIDEO_PROMPTS:
        job_id = hashlib.md5(f"{repo}_{scene_type}".encode()).hexdigest()[:12]
        cached_path = os.path.join(VIDEO_CACHE_DIR, f"{job_id}.mp4")

        if os.path.exists(cached_path):
            results[scene_type] = {"job_id": job_id, "status": "done"}
        elif job_id in video_jobs and video_jobs[job_id]["status"] == "generating":
            results[scene_type] = {"job_id": job_id, "status": "generating"}
        else:
            prompt = SCENE_VIDEO_PROMPTS[scene_type]
            t = threading.Thread(target=_generate_veo_video, args=(scene_type, prompt, job_id), daemon=True)
            t.start()
            results[scene_type] = {"job_id": job_id, "status": "generating"}

    return jsonify({"repo": repo, "scenes": results})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "gemini": bool(GEMINI_API_KEY), "github_token": bool(GITHUB_TOKEN)})


if __name__ == "__main__":
    print("🔬 GitScope backend starting...")
    print(f"   Gemini API: {'✓ configured' if GEMINI_API_KEY else '✗ not set (export GEMINI_API_KEY)'}")
    print(f"   GitHub token: {'✓ configured' if GITHUB_TOKEN else '✗ not set (using unauthenticated, 60 req/hr limit)'}")
    app.run(debug=True, port=5001)
