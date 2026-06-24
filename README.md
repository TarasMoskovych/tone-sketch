# 🎹 Tone Sketch

A browser-based piano roll for drawing melodies, crafting sounds, and sharing music. Built with Next.js and Tone.js.

![Tone Sketch](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tone.js](https://img.shields.io/badge/Tone.js-15-purple)

## ✨ Features

- **Piano Roll Editor** — Draw notes directly on a grid with snap-to-grid support
- **Real-time Playback** — Hear your melody instantly with synchronized playhead
- **35 Presets** — Choose from Piano, Lead, Pluck, Guitar, Bass, Strings, and Pads
- **Synthesizer Controls** — Adjust waveform, ADSR envelope, and filter
- **Audio Effects** — Reverb, Delay, Chorus, and Flanger with adjustable parameters
- **MIDI Import/Export** — Import existing MIDI files or export your creations
- **Save & Share** — Save melodies to the cloud and share via unique URLs
- **Keyboard Shortcuts** — Play notes with your computer keyboard (Z-M for C3-B3, Q-U for C4-B4)
- **Loop Mode** — Continuously loop your melody during playback
- **Tempo Control** — Adjust playback speed from 40-240 BPM

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/TarasMoskovych/tone-sketch.git
cd tone-sketch

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database connection string

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start creating!

### Environment Variables

Create a `.env.local` file with:

```env
DATABASE_URL=your_neon_postgres_connection_string
```

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Audio**: [Tone.js](https://tonejs.github.io/) for Web Audio synthesis
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Database**: [Neon Postgres](https://neon.tech/) (serverless)
- **MIDI**: [@tonejs/midi](https://github.com/Tonejs/Midi) for import/export
- **Testing**: [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)

## 📜 Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
npm run test     # Run tests
npm run test:watch  # Run tests in watch mode
```

## 🎵 How to Use

1. **Create a Melody**: Click and drag on the piano roll to draw notes
2. **Adjust Sound**: Use the sidebar controls to change waveform, envelope, and effects
3. **Play**: Press the play button or hit Space to hear your creation
4. **Save**: Click Save to store your melody and get a shareable link
5. **Share**: Send the URL to anyone — they can listen and remix!

## 🎹 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| S | Stop |
| L | Toggle Loop |
| Z-M | Play notes C3-B3 |
| Q-U | Play notes C4-B4 |
| Esc | Exit fullscreen |

## 📁 Project Structure

```
tone-sketch/
├── app/                 # Next.js App Router pages
│   ├── api/            # API routes for melodies
│   ├── create/         # Melody editor page
│   └── m/[id]/         # Shared melody viewer
├── components/          # React components
├── hooks/              # Custom React hooks
├── lib/                # Core utilities and synthesizer
└── types/              # TypeScript type definitions
```

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

MIT

## 👤 Author

**Taras Moskovych**

- GitHub: [@TarasMoskovych](https://github.com/TarasMoskovych)
- LinkedIn: [taras-moskovych](https://www.linkedin.com/in/taras-moskovych)

---

⭐ If you find this project useful, please consider giving it a star!
