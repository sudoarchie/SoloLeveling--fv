# Futuristic Dashboard

## Mock question bank

The **Mock tests** tab lets every signed-in user take shared papers under a database-enforced time limit. Responses autosave, tests submit automatically when time expires, results are graded after submission, and attempt history is stored for performance analysis. A timed mock awards up to 750 EXP for question coverage, up to 1,000 EXP for the score, and 750 EXP for a new personal best, making it the app's largest points reward. Answer keys remain hidden while a test is active.

See [the setup and AI import guide](docs/mock-question-bank.md). Apply every file in `supabase/migrations` in filename order. The timed exam migrations add secure attempts, grading, history, result storage, and atomic EXP rewards.

```sh
node scripts/import-mock-paper.mjs public/mock-paper.example.json --dry-run
```

*Automatically synced with your [v0.dev](https://v0.dev) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/shivamsinghrajputcses-projects/v0-futuristic-dashboard)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/fiil05bGOPN)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/shivamsinghrajputcses-projects/v0-futuristic-dashboard](https://vercel.com/shivamsinghrajputcses-projects/v0-futuristic-dashboard)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/fiil05bGOPN](https://v0.dev/chat/projects/fiil05bGOPN)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
