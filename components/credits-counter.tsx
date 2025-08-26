'use client';

import { getCredits } from '@/app/actions/credits/get';
import { Button } from '@/components/ui/button';
import NumberFlow from '@number-flow/react';
import { CoinsIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const creditsFetcher = async () => {
  const response = await getCredits();

  if ('error' in response) {
    throw new Error(response.error);
  }

  return response;
};

const pluralize = (count: number) => (count === 1 ? 'credit' : 'credits');

export const CreditCounter = () => {
  const { data, error } = useSWR('credits', creditsFetcher, {
    revalidateOnMount: true,
  });

  if (error) {
    return null;
  }

  if (!data) {
    return <Loader2Icon size={16} className="size-4 animate-spin" />;
  }

  const label = pluralize(Math.abs(data.credits));

  return (
    <div className="flex shrink-0 items-center gap-2 px-2 text-muted-foreground">
      <CoinsIcon size={16} />
      <NumberFlow
        className="text-nowrap text-sm"
        value={Math.abs(data.credits)}
        suffix={
          data.credits < 0 ? ` ${label} in overage` : ` ${label}`
        }
      />
      {data.credits <= 0 && (
        <Button size="sm" className="-my-2 -mr-3 ml-1 rounded-full" asChild>
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      )}
    </div>
  );
};