import { vercel } from '@t3-oss/env-core/presets-zod';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  extends: [vercel()],
  server: {
    // Required for database operations
    DATABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    SUPABASE_AUTH_HOOK_SECRET: z.string(),

    // Optional for development - Vercel Upstash KV integration naming
    KV_REST_API_URL: z.string().url().optional(),
    KV_REST_API_TOKEN: z.string().optional(),

    RESEND_TOKEN: z.string().optional(),
    RESEND_EMAIL: z.string().email().optional(),

    // AI SDK - Optional for development, will be user-provided
    OPENAI_API_KEY: z.string().optional(),
    XAI_API_KEY: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    HUME_API_KEY: z.string().optional(),
    LMNT_API_KEY: z.string().optional(),

    // Other Models - Optional for development
    MINIMAX_GROUP_ID: z.string().optional(),
    MINIMAX_API_KEY: z.string().optional(),
    RUNWAYML_API_SECRET: z.string().optional(),
    LUMA_API_KEY: z.string().optional(),
    BF_API_KEY: z.string().optional(),

    // Vercel AI Gateway - Optional for development
    AI_GATEWAY_API_KEY: z.string().optional(),

    // Tutorial Template - Optional for tutorial cloning
    TUTORIAL_TEMPLATE_PROJECT_ID: z.string().optional(),
  },
  client: {
    // Optional for development since we're removing these dependencies
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

    // Required for Supabase operations
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    XAI_API_KEY: process.env.XAI_API_KEY,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    RESEND_TOKEN: process.env.RESEND_TOKEN,
    RESEND_EMAIL: process.env.RESEND_EMAIL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_AUTH_HOOK_SECRET: process.env.SUPABASE_AUTH_HOOK_SECRET,
    RUNWAYML_API_SECRET: process.env.RUNWAYML_API_SECRET,
    LUMA_API_KEY: process.env.LUMA_API_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    HUME_API_KEY: process.env.HUME_API_KEY,
    LMNT_API_KEY: process.env.LMNT_API_KEY,
    BF_API_KEY: process.env.BF_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    TUTORIAL_TEMPLATE_PROJECT_ID: process.env.TUTORIAL_TEMPLATE_PROJECT_ID,
  },
});
