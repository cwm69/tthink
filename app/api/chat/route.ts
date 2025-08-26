import { getCurrentUserId } from '@/lib/auth';
import { trackCreditUsage } from '@/lib/credits';
import { parseError } from '@/lib/error/parse';
import { gateway, createModel } from '@/lib/gateway';
import { createRateLimiter, slidingWindow } from '@/lib/rate-limit';
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  streamText,
  wrapLanguageModel,
} from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Create a rate limiter for the chat API
const rateLimiter = createRateLimiter({
  limiter: slidingWindow(10, '1 m'),
  prefix: 'api-chat',
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

  const body = await req.json();
  console.log('Full request body received:', JSON.stringify(body, null, 2));
  
  const { messages, modelId, trigger, id, systemMessage } = body;
  // Detect if this is a chat request based on the presence of an id field (from useChat)
  const isChat = Boolean(id && id.includes('-chat'));
  console.log('isChat detected:', isChat, 'id:', id);

  if (typeof modelId !== 'string') {
    console.error('Invalid modelId:', modelId, typeof modelId);
    return new Response('Model must be a string', { status: 400 });
  }

  if (!Array.isArray(messages)) {
    console.error('Messages validation failed:', {
      messages,
      type: typeof messages,
      isArray: Array.isArray(messages),
      bodyKeys: Object.keys(body)
    });
    return new Response('Messages must be an array', { status: 400 });
  }

  const { models } = await gateway.getAvailableModels();

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Invalid model', { status: 400 });
  }

  const enhancedModel = wrapLanguageModel({
    model: createModel(model.id),
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  });

  const result = streamText({
    model: enhancedModel,
    system: isChat ? (
      // Use provided system message if available, otherwise default chat system
      systemMessage || [
        'You are helping refine content through natural conversation.',
        'The user already knows the context they provided - don\'t repeat it back unless specifically asked.',
        'Focus on discussing improvements, changes, and refinements directly.',
        'Be conversational and concise. Avoid formal recaps or restating the obvious.',
        model.id.startsWith('grok') &&
          'The user may refer to you as @gork, you can ignore this',
      ].filter(Boolean).join('\n')
    ) : [
      'You are a helpful assistant that synthesizes an answer or content.',
      'The user will provide a collection of data from disparate sources.',
      'They may also provide instructions for how to synthesize the content.',
      'If the instructions are a question, then your goal is to answer the question based on the context provided.',
      model.id.startsWith('grok') &&
        'The user may refer to you as @gork, you can ignore this',
      "You will then synthesize the content based on the user's instructions and the context provided.",
      'Provide a detailed and comprehensive response. Elaborate thoroughly on all aspects, include examples, explanations, and relevant details.',
    ].filter(Boolean).join('\n'),
    messages: (() => {
      // Normalize mixed message formats to proper UI message format
      const normalizedMessages = messages.map((message: any) => {
        // If message already has proper structure, return as-is
        if (message.parts && Array.isArray(message.parts)) {
          return message;
        }
        
        // Convert content-based messages to parts-based format
        if (message.content) {
          return {
            role: message.role,
            parts: [{ type: 'text', text: message.content }],
            id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          };
        }
        
        // If message has text property (legacy format)
        if (message.text) {
          return {
            role: message.role,
            parts: [{ type: 'text', text: message.text }],
            id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          };
        }
        
        return message;
      });

      try {
        return convertToModelMessages(normalizedMessages);
      } catch (error) {
        console.error('Error converting normalized messages:', error);
        console.error('Normalized messages:', JSON.stringify(normalizedMessages, null, 2));
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Message conversion failed: ${message}`);
      }
    })(),
    onFinish: async ({ usage, providerMetadata }) => {
      console.log('=== AI GATEWAY COST DEBUG ===');
      console.log('Model ID:', modelId);
      console.log('Model pricing:', JSON.stringify(model.pricing, null, 2));
      console.log('Usage:', JSON.stringify(usage, null, 2));
      console.log('Provider metadata:', JSON.stringify(providerMetadata, null, 2));
      
      // Try to get gateway cost first
      let dollarCost = 0;
      if (providerMetadata?.gateway?.cost) {
        dollarCost = Number.parseFloat(String(providerMetadata.gateway.cost));
        console.log('Using gateway cost:', dollarCost);
      } else {
        // Fallback to model pricing calculation
        const inputCost = model.pricing?.input
          ? Number.parseFloat(model.pricing.input)
          : 0;
        const outputCost = model.pricing?.output
          ? Number.parseFloat(model.pricing.output)
          : 0;
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;

        dollarCost = (inputTokens / 1000000) * inputCost + (outputTokens / 1000000) * outputCost;
        console.log('Using model pricing calculation:', dollarCost);
        console.log('Input cost per M tokens:', inputCost);
        console.log('Output cost per M tokens:', outputCost);
      }

      console.log('Final dollar cost:', dollarCost);

      // Track credits based on actual usage
      if (dollarCost > 0) {
        try {
          await trackCreditUsage({
            action: 'chat',
            cost: dollarCost,
          });
          console.log('Successfully tracked credits for cost:', dollarCost);
        } catch (error) {
          console.error('Failed to track credits:', error);
        }
      }
      console.log('=== END DEBUG ===');
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: true,
  });
};
