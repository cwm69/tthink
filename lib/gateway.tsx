import { createGateway } from '@ai-sdk/gateway';
import { wrapLanguageModel } from 'ai';
import { env } from './env';
import { loggingMiddleware } from './ai-middleware';

// Base gateway instance for getAvailableModels() calls
const baseGateway = createGateway({
  apiKey: env.AI_GATEWAY_API_KEY,
});

// Export the base gateway for providers that need getAvailableModels()
export const gateway = baseGateway;

// Export logged version for AI calls
export const createModel = (modelId: string) => {
  const model = baseGateway(modelId);
  
  if (process.env.NODE_ENV === 'development') {
    return wrapLanguageModel({
      model,
      middleware: loggingMiddleware,
    });
  }
  
  return model;
};
