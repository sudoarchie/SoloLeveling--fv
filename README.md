# Futuristic Dashboard

## Mock question bank

The **Mock tests** tab lets every signed-in user select an exam (GATE by default) and browse shared papers, questions, answer keys, year and metadata. Images are stored in Supabase Storage and readable by all signed-in users. AI tools can import JSON manifests and local image crops once for everyone.

See [the setup and AI import guide](docs/mock-question-bank.md). For a new Supabase project, apply `202610070001_mock_question_bank.sql`, `202610070002_shared_mock_question_bank.sql`, and `202610070003_mock_admin_api.sql` from `supabase/migrations` in order. The third migration supports the [admin API](docs/mock-admin-api.md) for creating exams and importing papers. All three are installed in the `solo` project.

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
