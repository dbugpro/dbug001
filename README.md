# DBUG // AGENT_001 Workbench

An advanced, AI-powered file orchestration and formatting workbench built with React, Tailwind CSS, and the Google Gemini API. This application acts as a high-level agent interface for analyzing binary or text structures and reformatting them into various data schemas.

## 🚀 Features

- **Agentic Orchestration**: Uses `gemini-3-pro-preview` for deep reasoning and function calling.
- **Structural Analysis**: Automatically detects file signatures, magic numbers, and summarizes content.
- **Template Formatting**: Transforms raw data into clean JSON, CSV, Markdown, or custom text formats.
- **Responsive Terminal**: Industrial-cyberpunk UI that works on both desktop and mobile devices.
- **Privacy First**: Files are processed in-memory and sent directly to the Gemini API.

## 🛠️ Tech Stack

- **Framework**: React 19 (via ESM imports)
- **Styling**: Tailwind CSS
- **AI Engine**: `@google/genai` (Google Gemini SDK)
- **Deployment**: Optimized for Vercel

---

## 🏁 Getting Started

### 1. Clone the Template
Use this project as a template for your own AI agent tools.
```bash
git clone https://github.com/your-username/dbug-agent-workbench.git
cd dbug-agent-workbench
```

### 2. Configure Your API Key
This app requires a **Google Gemini API Key**.
- Obtain a key from the [Google AI Studio](https://aistudio.google.com/).
- For local development, you will need to ensure `process.env.API_KEY` is accessible or use a local `.env` file if your build tool supports it.

### 3. Local Development
Since this project uses ESM modules and import maps directly in the browser, you can serve it with any static file server:
```bash
# Example using npx
npx serve .
```

---

## ☁️ Deployment on Vercel

The fastest way to deploy your own version of **dbug001** is using Vercel.

1. **Push to GitHub**: Create a new repository on GitHub and push your code.
2. **Import to Vercel**: 
   - Go to [vercel.com](https://vercel.com) and click **"Add New"** > **"Project"**.
   - Import your GitHub repository.
3. **Environment Variables**:
   - During the "Configure Project" step, expand the **Environment Variables** section.
   - Add `API_KEY` as the key and paste your Google Gemini API key as the value.
4. **Deploy**: Click **"Deploy"**. Vercel will automatically detect the static structure and provide you with a live URL.

---

## 📖 Usage Guide

1. **Mount a File**: Click the "Mount New File" button in the Workbench pane to load data into the agent's context.
2. **Structural Analysis**: Type `Analyze this file` or `What is this?` in the terminal. The agent will use the `perform_structural_analysis` tool.
3. **Formatting**: Type `Format this as JSON` or `Convert to CSV`. The agent will invoke the `apply_formatting_template` tool and provide a download link.
4. **Mobile Navigation**: On small screens, use the bottom navigation bar to switch between the Terminal (Chat) and the Workbench view.

---

## 🔧 Extending the Workbench

You can modify the agent's behavior by editing:
- `constants.ts`: Change the `SYSTEM_PROMPT` to give the agent a different personality or specialization.
- `App.tsx`: Add more `FunctionDeclaration` objects to the `tools` array to give the agent new capabilities (e.g., image generation, web search).

---

## 📄 License

MIT © Your Name / dbug001 Team