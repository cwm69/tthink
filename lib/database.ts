import * as schema from '@/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env';
import { createClient } from '@supabase/supabase-js';

declare global {
  var postgresSqlClient: ReturnType<typeof postgres> | undefined;
}

let client: ReturnType<typeof postgres> | undefined;

if (process.env.NODE_ENV !== 'production') {
  if (!global.postgresSqlClient) {
    // Disable prefetch as it is not supported for "Transaction" pool mode
    global.postgresSqlClient = postgres(env.DATABASE_URL, { prepare: false });
  }
  client = global.postgresSqlClient;
} else {
  // Disable prefetch as it is not supported for "Transaction" pool mode
  client = postgres(env.DATABASE_URL, { prepare: false });
}

export const database = drizzle({ client, schema });

// Service role Supabase client for admin operations that bypass RLS
export const serviceRoleSupabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);