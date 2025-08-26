import { getCurrentUserId } from '@/lib/auth';
import { trackCreditUsage } from '@/lib/credits';
import { parseError } from '@/lib/error/parse';
import { gateway, createModel } from '@/lib/gateway';
import { createRateLimiter, slidingWindow } from '@/lib/rate-limit';
import { generateText } from 'ai';

// Allow up to 30 seconds for refinement
export const maxDuration = 30;

// Create a rate limiter for the refinement API
const rateLimiter = createRateLimiter({
  limiter: slidingWindow(5, '1 m'), // 5 requests per minute
  prefix: 'api-refine',
});

export const POST = async (req: Request) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return new Response('User not found', { status: 401 });
    }
  } catch (error) {
    const message = parseError(error);
    return new Response(message, { status: 401 });
  }

  // Apply rate limiting
  if (process.env.NODE_ENV === 'production') {
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
    const { success, limit, reset, remaining } = await rateLimiter.limit(ip);

    if (!success) {
      return new Response('Too many requests', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      });
    }
  }

  try {
    const { prompt, modelId } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response('Prompt is required', { status: 400 });
    }

    if (!modelId || typeof modelId !== 'string') {
      return new Response('Model ID is required', { status: 400 });
    }

    // Get model pricing information
    const { models } = await gateway.getAvailableModels();
    const model = models.find((m) => m.id === modelId);

    if (!model) {
      return new Response('Invalid model', { status: 400 });
    }

    // Generate refined text using AI SDK
    const { text: refinedText, usage } = await generateText({
      model: createModel(modelId),
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Track credits usage with proper pricing
    if (usage) {
      try {
        const inputCost = model.pricing?.input
          ? Number.parseFloat(model.pricing.input)
          : 0;
        const outputCost = model.pricing?.output
          ? Number.parseFloat(model.pricing.output)
          : 0;
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;

        // Calculate actual cost based on token usage
        const dollarCost = (inputTokens / 1000000) * inputCost + (outputTokens / 1000000) * outputCost;
        
        await trackCreditUsage({
          action: 'refine-node',
          cost: dollarCost,
        });
      } catch (error) {
        console.error('Failed to track credits for refinement:', error);
      }
    }

    return Response.json({ refinedText });
  } catch (error) {
    console.error('Refinement error:', error);
    const message = parseError(error);
    return new Response(message, { status: 500 });
  }
};