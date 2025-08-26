import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await createClient().auth.getUser();
        if (error) {
          console.log('Auth session not found (anonymous user):', error.message);
          setUser(null);
          return;
        }

        setUser(data.user);
      } catch (error) {
        console.log('Auth session error (anonymous user):', error);
        setUser(null);
      }
    };

    fetchUser();
  }, []);

  return user;
};
