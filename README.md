# Handy

A real-time hand-tracking and gesture imitation web application built with TypeScript, React, and Framer Motion. Powered by Google AI Studio and MediaPipe, **Handy** captures hand landmarks via webcam to mirror and animate hand models interactively in the browser.

---

## Features

* **Real-time Tracking:** Low-latency hand pose and landmark detection directly in the browser.
* **Hand Imitation & Rendering:** Custom color schemes and visual canvas refactored for clear gesture visualization.
* **Fluid Animations:** Smooth motion transitions and UI animations powered by Framer Motion.
* **Zero Backend Required:** Runs entirely client-side using Vite and modern web APIs.

---

## Tech Stack

* **Language:** TypeScript
* **Frontend:** React, Vite, Framer Motion
* **AI/ML:** Google Gemini API / MediaPipe
* **Styling:** CSS3 / HTML5

---

## Quick Start

### Prerequisites

* [Node.js](https://nodejs.org/?utm_source=gemini) (v18 or higher recommended)
* A valid Gemini API key from [Google AI Studio](https://aistudio.google.com/?utm_source=gemini)

### Installation & Setup

1. **Clone the repository**
```bash
git clone https://github.com/SumanthChary/handy.git
cd handy

```


2. **Install dependencies**
```bash
npm install

```


3. **Configure environment variables**
Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here

```


4. **Start the development server**
```bash
npm run dev

```


5. Open your browser and navigate to `http://localhost:5173` (or the port indicated in your terminal).

---

## Project Structure

```text
handy/
├── src/            # Core source code (components, rendering logic, hooks)
├── .env.example    # Environment variable reference
├── index.html      # Application entry point
├── package.json    # Dependencies and scripts
├── tsconfig.json   # TypeScript config
└── vite.config.ts  # Vite build configuration

```

---

## Deployment & Cloud Link

View or remix this app directly on AI Studio:

👉 [Open in Google AI Studio](https://ai.studio/apps/111abad7-f59b-4c6c-81ad-3a8b3948d90f?utm_source=gemini)

---

## License

Distributed under the MIT License. See `LICENSE` for more details.
