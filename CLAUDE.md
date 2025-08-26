# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm dev` - Start development server with Next.js, Supabase, and email dev server
- `pnpm build` - Build the application using Next.js with Turbopack
- `pnpm start` - Start production server
- `pnpm lint` - Run Next.js linter (uses Biome configuration with ultracite preset)

### Database Operations
- `pnpm migrate` - Push database schema changes using Drizzle Kit
- Database schema is defined in `schema.ts` using Drizzle ORM

### Dependencies & UI
- `pnpm bump-deps` - Update all dependencies using npm-check-updates
- `pnpm bump-ui` - Update all shadcn/ui components with overwrite
- `pnpm export` - Export email templates
- `pnpm generate` - Generate OpenAPI types for Black Forest Labs API

## Architecture Overview

### Core Technologies
- **Next.js 15** with App Router and Turbopack for the web framework
- **Supabase** for authentication, database, and real-time features
- **Drizzle ORM** with PostgreSQL for database operations
- **ReactFlow** for the visual canvas/node editor interface
- **Vercel AI SDK** with AI Gateway for multiple AI model integrations

### Key Architecture Patterns

#### Node-Based Workflow System
The application is built around a visual node editor where users create AI workflows:
- Node types: `image`, `text`, `video`, `audio`, `code`, `file`, `tweet`, `drop`
- All node components are in `components/nodes/` with consistent structure (index.tsx, primitive.tsx, transform.tsx)
- Node operations handled by providers in `providers/node-operations.tsx`

#### AI Model Integration
- Multiple AI providers integrated via Vercel AI SDK and custom gateway (`lib/gateway.tsx`)
- Supported providers: OpenAI, xAI, Amazon Bedrock, Hume, LMNT, Luma, RunwayML, MiniMax, Black Forest Labs
- Model configurations in `lib/models/` organized by media type

#### Authentication & Data
- Supabase authentication with Row Level Security
- Database schema includes `projects` and `profile` tables
- Environment variables strictly typed using t3-env with Zod validation in `lib/env.ts`

#### Project Structure
- `/app` - Next.js App Router with authenticated/unauthenticated route groups
- `/components` - Reusable UI components (shadcn/ui, Kibo UI, custom components)
- `/lib` - Utility functions, database, auth, and integrations
- `/providers` - React context providers for global state
- `/hooks` - Custom React hooks
- `/actions` - Server actions for data mutations

### State Management
- React Context for project state (`providers/project.tsx`)
- Jotai for local component state
- SWR for server state synchronization
- Auto-saving implemented via `use-save-project.ts` hook

### Styling & UI
- Tailwind CSS for styling with custom configuration
- Component library: shadcn/ui + Kibo UI + Radix UI primitives
- Theme switching support with next-themes
- Biome for code formatting/linting (extends ultracite configuration)

## Environment Configuration

All environment variables are defined and validated in `lib/env.ts`. Required variables include:
- Supabase connection (URL, service role key, anon key)
- AI provider API keys (OpenAI, xAI, AWS, etc.)
- Upstash Redis for rate limiting
- PostHog for analytics

## Development Notes

- Uses PNPM as package manager
- TypeScript with strict configuration
- Path mapping configured for `@/*` imports
- Email templates built with React Email
- Webhook handling for Resend emails
- Rate limiting implemented with Upstash Redis

Important: always adhere to existing patterns in the codebase, and opt for the most elegant implementation given the context of the current code. 