// AI SDK types have changed, using any for now

// ANSI color codes for pretty console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, -5);
}

function formatMessages(messages: any[]): void {
  if (!messages?.length) return;
  
  console.log(`${colors.yellow}Messages:${colors.reset}`);
  messages.forEach((msg, i) => {
    console.log(`  ${colors.gray}[${i + 1}]${colors.reset} ${colors.blue}${msg.role}:${colors.reset}`);
    if (typeof msg.content === 'string') {
      const content = msg.content.length > 300 ? msg.content.slice(0, 300) + '...' : msg.content;
      console.log(`      ${content.split('\n').join('\n      ')}`);
    } else if (Array.isArray(msg.content)) {
      msg.content.forEach((part: any) => {
        if (part.type === 'text') {
          const content = part.text.length > 300 ? part.text.slice(0, 300) + '...' : part.text;
          console.log(`      ${colors.gray}[text]${colors.reset} ${content}`);
        } else if (part.type === 'image') {
          console.log(`      ${colors.gray}[image]${colors.reset} ${part.image}`);
        }
      });
    } else if (msg.content && typeof msg.content === 'object') {
      // Handle objects by converting to string
      console.log(`      ${JSON.stringify(msg.content, null, 2).split('\n').join('\n      ')}`);
    } else {
      // Fallback for any other content type
      console.log(`      ${String(msg.content)}`);
    }
  });
}

export const loggingMiddleware: any = {
  wrapGenerate: async ({ model, doGenerate, params }: any) => {
    if (process.env.NODE_ENV !== 'development') {
      return doGenerate();
    }

    console.log('\n' + '='.repeat(80));
    console.log(`${colors.cyan}🤖 AI GENERATE${colors.reset} ${colors.gray}[${formatTimestamp()}]${colors.reset}`);
    console.log(`${colors.yellow}Model:${colors.reset} ${model.modelId}`);
    
    if (params.prompt) {
      console.log(`${colors.yellow}Prompt:${colors.reset}`);
      const prompt = Array.isArray(params.prompt) ? params.prompt : [params.prompt];
      prompt.forEach((p: any, i: number) => {
        if (typeof p === 'string') {
          const content = p.length > 300 ? p.slice(0, 300) + '...' : p;
          console.log(`  ${content.split('\n').join('\n  ')}`);
        } else if (p.role) {
          console.log(`  ${colors.blue}${p.role}:${colors.reset} ${p.content}`);
        }
      });
    }

    if (params.messages) {
      formatMessages(params.messages);
    }

    if (params.tools && Object.keys(params.tools).length > 0) {
      console.log(`${colors.yellow}Tools:${colors.reset} ${Object.keys(params.tools).join(', ')}`);
    }

    if (params.temperature !== undefined) {
      console.log(`${colors.yellow}Temperature:${colors.reset} ${params.temperature}`);
    }

    if (params.maxTokens !== undefined) {
      console.log(`${colors.yellow}Max Tokens:${colors.reset} ${params.maxTokens}`);
    }

    console.log(`${colors.gray}${'─'.repeat(80)}${colors.reset}`);

    try {
      const result = await doGenerate();
      
      console.log(`${colors.green}✅ RESPONSE${colors.reset} ${colors.gray}[${formatTimestamp()}]${colors.reset}`);
      
      if (result.text) {
        console.log(`${colors.yellow}Text:${colors.reset}`);
        const text = result.text.length > 500 ? result.text.slice(0, 500) + '...' : result.text;
        console.log(`  ${text.split('\n').join('\n  ')}`);
      }

      if (result.usage) {
        console.log(`${colors.yellow}Usage:${colors.reset}`);
        console.log(`  ${colors.cyan}Input:${colors.reset} ${result.usage.promptTokens} tokens`);
        console.log(`  ${colors.cyan}Output:${colors.reset} ${result.usage.completionTokens} tokens`);
        console.log(`  ${colors.cyan}Total:${colors.reset} ${result.usage.totalTokens} tokens`);
      }

      if (result.finishReason) {
        console.log(`${colors.yellow}Finish Reason:${colors.reset} ${result.finishReason}`);
      }

      console.log('='.repeat(80) + '\n');
      return result;
    } catch (error) {
      console.log(`${colors.red}❌ ERROR${colors.reset} ${colors.gray}[${formatTimestamp()}]${colors.reset}`);
      console.log(`${colors.yellow}Error:${colors.reset} ${(error as Error).message}`);
      console.log('='.repeat(80) + '\n');
      throw error;
    }
  },

  wrapStream: async ({ model, doStream, params }: any) => {
    if (process.env.NODE_ENV !== 'development') {
      return doStream();
    }

    console.log('\n' + '='.repeat(80));
    console.log(`${colors.cyan}🌊 AI STREAM${colors.reset} ${colors.gray}[${formatTimestamp()}]${colors.reset}`);
    console.log(`${colors.yellow}Model:${colors.reset} ${model.modelId}`);
    
    if (params.prompt) {
      console.log(`${colors.yellow}Prompt:${colors.reset}`);
      const prompt = Array.isArray(params.prompt) ? params.prompt : [params.prompt];
      prompt.forEach((p: any) => {
        if (typeof p === 'string') {
          const content = p.length > 300 ? p.slice(0, 300) + '...' : p;
          console.log(`  ${content.split('\n').join('\n  ')}`);
        } else if (p.role) {
          console.log(`  ${colors.blue}${p.role}:${colors.reset} ${p.content}`);
        }
      });
    }

    if (params.messages) {
      formatMessages(params.messages);
    }

    if (params.tools && Object.keys(params.tools).length > 0) {
      console.log(`${colors.yellow}Tools:${colors.reset} ${Object.keys(params.tools).join(', ')}`);
    }

    if (params.temperature !== undefined) {
      console.log(`${colors.yellow}Temperature:${colors.reset} ${params.temperature}`);
    }

    if (params.maxTokens !== undefined) {
      console.log(`${colors.yellow}Max Tokens:${colors.reset} ${params.maxTokens}`);
    }

    console.log(`${colors.gray}${'─'.repeat(80)}${colors.reset}`);
    console.log(`${colors.green}🌊 STREAMING...${colors.reset}`);

    let streamedText = '';
    let usage: any = null;

    try {
      const { stream, ...rest } = await doStream();

      const transformedStream = new ReadableStream({
        start(controller) {
          const reader = stream.getReader();
          
          const pump = async (): Promise<void> => {
            try {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log(`${colors.green}✅ STREAM COMPLETE${colors.reset} ${colors.gray}[${formatTimestamp()}]${colors.reset}`);
                if (streamedText) {
                  const text = streamedText.length > 500 ? streamedText.slice(0, 500) + '...' : streamedText;
                  console.log(`${colors.yellow}Final Text:${colors.reset}`);
                  console.log(`  ${text.split('\n').join('\n  ')}`);
                }
                if (usage) {
                  console.log(`${colors.yellow}Usage:${colors.reset}`);
                  console.log(`  ${colors.cyan}Input:${colors.reset} ${usage.promptTokens} tokens`);
                  console.log(`  ${colors.cyan}Output:${colors.reset} ${usage.completionTokens} tokens`);
                  console.log(`  ${colors.cyan}Total:${colors.reset} ${usage.totalTokens} tokens`);
                }
                console.log('='.repeat(80) + '\n');
                controller.close();
                return;
              }

              // Extract text and usage from stream chunks for logging
              if (value.type === 'text-delta' && value.textDelta) {
                streamedText += value.textDelta;
              } else if (value.type === 'finish' && value.usage) {
                usage = value.usage;
              }

              controller.enqueue(value);
              return pump();
            } catch (error) {
              console.log(`${colors.red}❌ STREAM ERROR${colors.reset} ${(error as Error).message}`);
              console.log('='.repeat(80) + '\n');
              controller.error(error);
            }
          };

          return pump();
        },
      });

      return { stream: transformedStream, ...rest };
    } catch (error) {
      console.log(`${colors.red}❌ STREAM ERROR${colors.reset} ${(error as Error).message}`);
      console.log('='.repeat(80) + '\n');
      throw error;
    }
  },
};