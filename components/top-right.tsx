import { currentUser, getCurrentUserId } from '@/lib/auth';
import { database } from '@/lib/database';
import { projects } from '@/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { UserPlusIcon } from 'lucide-react';
import { CreditCounter } from './credits-counter';
import { Menu } from './menu';
import { Button } from './ui/button';

type TopRightProps = {
  id: string;
};

export const TopRight = async ({ id }: TopRightProps) => {
  const user = await currentUser();
  const userId = await getCurrentUserId();
  
  const project = await database.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!userId || !project) {
    return null;
  }

  // Anonymous user - show credits counter and sign up prompt
  if (!user) {
    return (
      <div className="absolute top-16 right-0 left-0 z-[50] m-4 flex items-center gap-2 sm:top-0 sm:left-auto">
        <div className="flex items-center rounded-full border bg-card/90 p-1 drop-shadow-xs backdrop-blur-sm">
          <CreditCounter />
        </div>
        <Button asChild size="sm" className="rounded-full px-3 py-2 drop-shadow-xs">
          <Link href="/auth/sign-up" className="flex items-center gap-2">
            <UserPlusIcon size={16} />
            Sign up
          </Link>
        </Button>
      </div>
    );
  }

  // Authenticated user - show credits counter and menu
  return (
    <div className="absolute top-16 right-0 left-0 z-[50] m-4 flex items-center gap-2 sm:top-0 sm:left-auto">
      <div className="flex items-center rounded-full border bg-card/90 p-1 drop-shadow-xs backdrop-blur-sm">
        <CreditCounter />
      </div>
      <div className="flex items-center rounded-full border bg-card/90 p-1 drop-shadow-xs backdrop-blur-sm">
        <Menu />
      </div>
    </div>
  );
};
