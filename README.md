# AI-Native Assistant (Expo + React Native)

An AI-native mobile assistant that provides proactive, context-aware reminders tailored to a user’s calendar, with text-to-speech delivery for hands-free and accessible interactions.

This project is designed as a flagship portfolio project to demonstrate modern mobile development, AI integration, and end-to-end product thinking.

---

## Overview

The goal of this application is to move beyond static, manually configured reminders and instead provide intelligent, adaptive nudges that reduce user cognitive load. By combining calendar data with AI-driven logic, the system generates and prioritizes reminders based on timing, urgency, and contextual relevance.

The app is built using **Expo and React Native** for rapid cross-platform development, with sensitive AI operations handled by a lightweight backend service to ensure security and flexibility.

---

## Core Features

- **Calendar Ingestion**
  - Reads calendar events (e.g. meetings, deadlines) to understand user context.
  - Designed to support OAuth-based integrations (e.g. Google Calendar).

- **AI-Generated Reminders**
  - Automatically generates reminder suggestions for upcoming events.
  - Prioritizes reminders based on event timing and inferred importance.
  - Produces concise, actionable reminder messages.

- **Text-to-Speech (TTS)**
  - Converts reminders and summaries into spoken audio.
  - Enables hands-free and accessibility-focused interactions.

- **Human-in-the-Loop Controls**
  - Users can accept, edit, snooze, or dismiss AI-generated reminders.
  - Feedback is intended to improve future reminder relevance.

---

## Technical Architecture

**Client**
- Expo (managed workflow)
- React Native
- TypeScript
- Expo Notifications for local scheduling
- Expo Speech / Audio for TTS

**Backend**
- Node.js (lightweight service)
- LLM integration for reminder generation and prioritization
- Secure handling of API keys and sensitive operations

**Design Principles**
- AI used where approximation and adaptation add value
- Deterministic logic for scheduling and system-critical paths
- Clear separation between client and AI inference logic
- Privacy-conscious handling of user data

---

## Project Structure (Planned)

app/
├─ src/
│ ├─ screens/
│ ├─ components/
│ ├─ services/
│ │ ├─ calendarService.ts
│ │ ├─ reminderService.ts
│ │ ├─ ttsService.ts
│ │ └─ apiClient.ts
│ ├─ hooks/
│ ├─ models/
│ └─ utils/
server/
├─ index.js
├─ routes/
└─ services/

---

## Development Status

- Git repository initialized and connected to GitHub using SSH authentication
- Project planning and architecture defined
- Expo-based development environment ready

Upcoming milestones:
1. Scaffold Expo application
2. Implement stubbed reminder generation flow
3. Add local notification scheduling
4. Integrate text-to-speech playback
5. Replace stubs with AI-backed backend logic
6. Add calendar OAuth integration

---

## Running Locally (Planned)

```bash
# client
cd app
npm install
npx expo start

# backend
cd server
npm install
npm run dev
