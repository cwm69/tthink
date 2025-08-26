'use client';

import {
  type TersaModel,
  type TersaProvider,
  providers,
} from '@/lib/providers';
import { getCurrentUserId } from '@/lib/auth';
import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

export type PriceBracket = 'lowest' | 'low' | 'high' | 'highest';

type TersaTextModel = TersaModel & {
  providers: (TersaProvider & {
    model: string;
    getCost: ({ input, output }: { input: number; output: number }) => number;
  })[];
  requiresSignup?: boolean;
};

type GatewayProviderClientProps = {
  children: ReactNode;
  models: GatewayLanguageModelEntry[];
  isAnonymous?: boolean;
};

type GatewayContextType = {
  models: Record<string, TersaTextModel>;
};

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

export const useGateway = () => {
  const context = useContext(GatewayContext);

  if (!context) {
    throw new Error('useGateway must be used within a GatewayProviderClient');
  }

  return context;
};

/**
 * Determines price indicator based on statistical distribution of model costs
 * @param totalCost - The total cost (input + output) for the model
 * @param allCosts - Array of all model costs for comparison
 * @returns PriceBracket or undefined if relatively on par
 */
const getPriceIndicator = (
  totalCost: number,
  allCosts: number[]
): 'lowest' | 'low' | 'high' | 'highest' | undefined => {
  if (allCosts.length < 2) {
    return undefined;
  }

  // Sort costs to calculate percentiles
  const sortedCosts = [...allCosts].sort((a, b) => a - b);
  const length = sortedCosts.length;

  // Calculate percentile thresholds
  const p20 = sortedCosts[Math.floor(length * 0.2)];
  const p40 = sortedCosts[Math.floor(length * 0.4)];
  const p60 = sortedCosts[Math.floor(length * 0.6)];
  const p80 = sortedCosts[Math.floor(length * 0.8)];

  // Determine price bracket based on percentiles
  if (totalCost <= p20) {
    return 'lowest';
  }
  if (totalCost <= p40) {
    return 'low';
  }
  if (totalCost >= p80) {
    return 'highest';
  }
  if (totalCost >= p60) {
    return 'high';
  }

  // If between p40 and p60 (middle 20%), it's relatively on par
  return undefined;
};

export const GatewayProviderClient = ({
  children,
  models,
  isAnonymous = false,
}: GatewayProviderClientProps) => {
  const textModels: Record<string, TersaTextModel> = {};

  // Calculate all model costs for statistical analysis
  const allCosts = models.map((model) => {
    const inputPrice = model.pricing?.input
      ? Number.parseFloat(model.pricing.input)
      : 0;
    const outputPrice = model.pricing?.output
      ? Number.parseFloat(model.pricing.output)
      : 0;
    return inputPrice + outputPrice;
  });

  for (const model of models) {
    const [chef] = model.id.split('/');
    const inputPrice = model.pricing?.input
      ? Number.parseFloat(model.pricing.input)
      : 0;
    const outputPrice = model.pricing?.output
      ? Number.parseFloat(model.pricing.output)
      : 0;

    let realChef = providers.unknown;
    let realProvider = providers.unknown;

    if (chef in providers) {
      realChef = providers[chef as keyof typeof providers];
    }

    if (model.specification.provider in providers) {
      realProvider =
        providers[model.specification.provider as keyof typeof providers];
    }

    const totalCost = inputPrice + outputPrice;

    const priceIndicator = getPriceIndicator(totalCost, allCosts);
    
    // Mark expensive models as disabled for anonymous users instead of filtering them out
    const isDisabledForAnonymous = isAnonymous && (priceIndicator === 'high' || priceIndicator === 'highest');

    textModels[model.id] = {
      label: model.name,
      chef: realChef,
      providers: [
        {
          ...realProvider,
          model: model.id,
          getCost: ({ input, output }: { input: number; output: number }) => {
            return inputPrice * input + outputPrice * output;
          },
        },
      ],
      priceIndicator,
      requiresSignup: isDisabledForAnonymous,
    };
  }

  return (
    <GatewayContext.Provider value={{ models: textModels }}>
      {children}
    </GatewayContext.Provider>
  );
};
