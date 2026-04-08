# FAQs CNCI — Help Center + AI Chatbot

## Project Overview
Help center and AI-powered chatbot for CNCI educational institution (Centro de Ayuda). ~1600 FAQ articles with AI-assisted search and conversation. v3.0.0.

## Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Auth**: NextAuth (Azure AD integration)
- **AI**: Mastra AI framework
- **Database**: SQLite (better-sqlite3)
- **Content**: MDX-based knowledge base in `content/`
- **Real-time**: WebSocket integration with Nexus

## Architecture

```
src/app/                  ← Next.js pages & API routes
content/                  ← MDX knowledge base (~1600 articles)
data/                     ← SQLite database
components/               ← React UI components
lib/                      ← AI integration, search, utilities
```

## Critical Rules
- Knowledge base is MDX files in `content/` — edit there, not in DB
- Azure AD auth is required for admin functions
- AI responses are grounded in the knowledge base content
- WebSocket connects to Nexus platform for real-time features
