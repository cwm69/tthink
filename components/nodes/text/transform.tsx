import { NodeLayout } from '@/components/nodes/layout';
import { Button } from '@/components/ui/button';
import {
  AIMessage,
  AIMessageContent,
} from '@/components/ui/kibo-ui/ai/message';
import { AIResponse } from '@/components/ui/kibo-ui/ai/response';
import {
  AISource,
  AISources,
  AISourcesContent,
  AISourcesTrigger,
} from '@/components/ui/kibo-ui/ai/source';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { useChatPanel } from '@/hooks/use-chat-panel';
import { useReasoning } from '@/hooks/use-reasoning';
import { handleError } from '@/lib/error/handle';
import {
  getDescriptionsFromImageNodes,
  getFilesFromFileNodes,
  getImagesFromImageNodes,
  getTextFromTextNodes,
  getTranscriptionFromAudioNodes,
  getTweetContentFromTweetNodes,
} from '@/lib/xyflow';
import { useGateway } from '@/providers/gateway/client';
import { useProject } from '@/providers/project';
import { ChatInterface } from '@/components/chat-interface';
import { ReasoningTunnel } from '@/tunnels/reasoning';
import { ChatTunnel } from '@/tunnels/chat';
import { useChat } from '@ai-sdk/react';
import { getIncomers, useReactFlow } from '@xyflow/react';
import { DefaultChatTransport, type FileUIPart } from 'ai';
import {
  ClockIcon,
  CopyIcon,
  MessageCircleIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
} from 'lucide-react';
import {
  type ChangeEventHandler,
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Response } from '@/components/ai-elements/response';
import { toast } from 'sonner';
import { mutate } from 'swr';
import type { TextNodeProps } from '.';
import { ModelSelector } from '../model-selector';

type TextTransformProps = TextNodeProps & {
  title: string;
  width?: number;
  height?: number;
};

const getDefaultModel = (models: ReturnType<typeof useGateway>['models']) => {
  const defaultModel = Object.entries(models).find(
    ([_, model]) => model.default
  );

  if (!defaultModel) {
    return 'o3';
  }

  return defaultModel[0];
};

export const TextTransform = ({
  data,
  id,
  type,
  title,
  width,
  height,
}: TextTransformProps) => {
  const { updateNodeData, getNodes, getEdges } = useReactFlow();
  const project = useProject();
  const { models } = useGateway();
  const modelId = data.model ?? getDefaultModel(models);
  const analytics = useAnalytics();
  const [reasoning, setReasoning] = useReasoning();
  const [chatPanel, setChatPanel] = useChatPanel();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserNearBottom = useRef(true); // Track if user is near bottom
  const SCROLL_THRESHOLD = 100; // px from bottom to consider "near bottom"
  const { sendMessage, messages, setMessages, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onError: (error) => handleError('Error generating text', error),
    onFinish: ({ message }) => {
      updateNodeData(id, {
        generated: {
          text: message.parts.find((part) => part.type === 'text')?.text ?? '',
          sources:
            message.parts?.filter((part) => part.type === 'source-url') ?? [],
        },
        updatedAt: new Date().toISOString(),
      });

      setReasoning((oldReasoning) => ({
        ...oldReasoning,
        isGenerating: false,
      }));

      toast.success('text generated successfully');

      setTimeout(() => mutate('credits'), 5000);
    },
  });

  const handleRefinement = useCallback(async (refinementPrompt: string, refinementModelId: string) => {
    // Clear the node generation messages and stream the refinement
    setMessages([]);
    await sendMessage(
      {
        text: refinementPrompt,
      },
      {
        body: {
          modelId: refinementModelId,
        },
      }
    );
  }, [sendMessage, setMessages]);

  const handleGenerate = useCallback(async () => {
    const incomers = getIncomers({ id }, getNodes(), getEdges());
    const textPrompts = getTextFromTextNodes(incomers);
    const audioPrompts = getTranscriptionFromAudioNodes(incomers);
    const images = getImagesFromImageNodes(incomers);
    const imageDescriptions = getDescriptionsFromImageNodes(incomers);
    const tweetContent = getTweetContentFromTweetNodes(incomers);
    const files = getFilesFromFileNodes(incomers);

    if (!textPrompts.length && !audioPrompts.length && !data.instructions) {
      handleError('Error generating text', 'No prompts found');
      return;
    }

    const content: string[] = [];

    if (data.instructions) {
      content.push('--- Instructions ---', data.instructions);
    }

    if (textPrompts.length) {
      content.push('--- Text Prompts ---', ...textPrompts);
    }

    if (audioPrompts.length) {
      content.push('--- Audio Prompts ---', ...audioPrompts);
    }

    if (imageDescriptions.length) {
      content.push('--- Image Descriptions ---', ...imageDescriptions);
    }

    if (tweetContent.length) {
      content.push('--- Tweet Content ---', ...tweetContent);
    }

    analytics.track('canvas', 'node', 'generate', {
      type,
      promptLength: content.join('\n').length,
      model: modelId,
      instructionsLength: data.instructions?.length ?? 0,
      imageCount: images.length,
      fileCount: files.length,
    });

    const attachments: FileUIPart[] = [];

    for (const image of images) {
      attachments.push({
        mediaType: image.type,
        url: image.url,
        type: 'file',
      });
    }

    for (const file of files) {
      attachments.push({
        mediaType: file.type,
        url: file.url,
        type: 'file',
      });
    }

    setMessages([]);
    await sendMessage(
      {
        text: content.join('\n'),
        files: attachments,
      },
      {
        body: {
          modelId,
        },
      }
    );
  }, [
    sendMessage,
    data.instructions,
    getEdges,
    getNodes,
    id,
    modelId,
    type,
    analytics.track,
    setMessages,
  ]);

  const handleInstructionsChange: ChangeEventHandler<HTMLTextAreaElement> = (
    event
  ) => updateNodeData(id, { instructions: event.target.value });

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('copied to clipboard');
  }, []);

  const handleOpenChat = useCallback(() => {
    setChatPanel({ isOpen: true, nodeId: id });
  }, [id, setChatPanel]);

  const checkIfNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    
    isUserNearBottom.current = distanceFromBottom <= SCROLL_THRESHOLD;
  }, [SCROLL_THRESHOLD]);

  const handleScroll = useCallback(() => {
    checkIfNearBottom();
  }, [checkIfNearBottom]);

  const toolbar = useMemo(() => {
    const items: ComponentProps<typeof NodeLayout>['toolbar'] = [];

    items.push({
      children: (
        <ModelSelector
          value={modelId}
          options={models}
          key={id}
          className="w-[200px] rounded-full"
          onChange={(value) => updateNodeData(id, { model: value })}
        />
      ),
    });

    if (status === 'submitted' || status === 'streaming') {
      items.push({
        tooltip: 'stop',
        children: (
          <Button
            size="icon"
            className="rounded-full"
            onClick={stop}
            disabled={!project?.id}
          >
            <SquareIcon size={12} />
          </Button>
        ),
      });
    } else if (messages.length || data.generated?.text) {
      const text = messages.length
        ? messages
            .filter((message) => message.role === 'assistant')
            .map(
              (message) =>
                message.parts.find((part) => part.type === 'text')?.text ?? ''
            )
            .join('\n')
        : data.generated?.text;

      // Add chat button as primary action (first/green)
      items.push({
        tooltip: 'chat',
        children: (
          <Button
            size="icon"
            className="rounded-full"
            onClick={handleOpenChat}
          >
            <MessageCircleIcon size={12} />
          </Button>
        ),
      });
      
      // Add regenerate as secondary action
      items.push({
        tooltip: 'regenerate',
        children: (
          <Button
            size="icon"
            className="rounded-full"
            onClick={handleGenerate}
            disabled={!project?.id}
            variant="ghost"
          >
            <RotateCcwIcon size={12} />
          </Button>
        ),
      });
      
      items.push({
        tooltip: 'copy',
        children: (
          <Button
            size="icon"
            className="rounded-full"
            disabled={!text}
            onClick={() => handleCopy(text ?? '')}
            variant="ghost"
          >
            <CopyIcon size={12} />
          </Button>
        ),
      });
    } else {
      items.push({
        tooltip: 'generate',
        children: (
          <Button
            size="icon"
            className="rounded-full"
            onClick={handleGenerate}
            disabled={!project?.id}
          >
            <PlayIcon size={12} />
          </Button>
        ),
      });
    }

    if (data.updatedAt) {
      items.push({
        tooltip: `last updated: ${new Intl.DateTimeFormat('en-US', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(data.updatedAt))}`,
        children: (
          <Button size="icon" variant="ghost" className="rounded-full">
            <ClockIcon size={12} />
          </Button>
        ),
      });
    }

    return items;
  }, [
    data.generated?.text,
    data.updatedAt,
    handleGenerate,
    updateNodeData,
    modelId,
    id,
    messages,
    project?.id,
    status,
    stop,
    handleCopy,
    handleOpenChat,
    models,
  ]);

  const nonUserMessages = messages.filter((message) => message.role !== 'user');

  useEffect(() => {
    const hasReasoning = messages.some((message) =>
      message.parts.some((part) => part.type === 'reasoning')
    );

    if (hasReasoning && !reasoning.isReasoning && status === 'streaming') {
      setReasoning({ isReasoning: true, isGenerating: true });
    }
  }, [messages, reasoning, status, setReasoning]);

  // Smart auto-scroll that respects user scroll position
  useEffect(() => {
    if (status === 'streaming' && scrollContainerRef.current && isUserNearBottom.current) {
      const scrollToBottom = () => {
        if (scrollContainerRef.current && isUserNearBottom.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      };
      
      // Scroll immediately if near bottom
      scrollToBottom();
      
      // Also scroll after a small delay to ensure content has rendered
      const timeoutId = setTimeout(scrollToBottom, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages, status]);

  // Additional effect to handle streaming content updates
  useEffect(() => {
    if (status === 'streaming') {
      const interval = setInterval(() => {
        if (scrollContainerRef.current && isUserNearBottom.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [status]);

  // Ensure scrolling is available immediately on mount and initialize position tracking
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Force a reflow to ensure scroll is available
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollTop;
      // Initialize the bottom check
      checkIfNearBottom();
    }
  }, [checkIfNearBottom]);

  return (
    <div style={{ width: width || 400, height: height || 300 }}>
      <NodeLayout id={id} data={data} title={title} type={type} toolbar={toolbar}>
        <div className="flex h-full flex-col w-full">
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto rounded-t-3xl rounded-b-xl bg-secondary p-4 w-full min-h-[100px]"
          tabIndex={0}
          onFocus={(e) => e.currentTarget.classList.add('nowheel')}
          onBlur={(e) => e.currentTarget.classList.remove('nowheel')}
          onScroll={handleScroll}
          onClick={(e) => {
            e.currentTarget.focus();
            e.stopPropagation();
          }}>
          {status === 'submitted' && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-60 animate-pulse rounded-lg" />
              <Skeleton className="h-4 w-40 animate-pulse rounded-lg" />
              <Skeleton className="h-4 w-50 animate-pulse rounded-lg" />
            </div>
          )}
          {data.generated?.text &&
            (!nonUserMessages.length || status !== 'streaming') &&
            status !== 'submitted' && (
              <div 
                className="nodrag cursor-text select-text w-full"
              >
                <Response className="w-full break-words">{data.generated.text}</Response>
              </div>
            )}
          {!data.generated?.text &&
            !nonUserMessages.length &&
            status !== 'submitted' && (
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  Press <PlayIcon size={12} className="-translate-y-px inline" />{' '}
                  to generate text
                </p>
              </div>
            )}
          {Boolean(nonUserMessages.length) &&
            status !== 'submitted' &&
            nonUserMessages.map((message) => (
              <AIMessage
                key={message.id}
                from={message.role === 'assistant' ? 'assistant' : 'user'}
                className="p-0 [&>div]:max-w-none"
              >
                <div className="h-full">
                  {Boolean(
                    message.parts.filter((part) => part.type === 'source-url')
                      ?.length
                  ) && (
                    <AISources>
                      <AISourcesTrigger
                        count={
                          message.parts.filter(
                            (part) => part.type === 'source-url'
                          ).length
                        }
                      />
                      <AISourcesContent>
                        {message.parts
                          .filter((part) => part.type === 'source-url')
                          .map(({ url, title }) => (
                            <AISource
                              key={url ?? ''}
                              href={url}
                              title={title ?? new URL(url).hostname}
                            />
                          ))}
                      </AISourcesContent>
                    </AISources>
                  )}
                  <AIMessageContent className="bg-transparent p-0">
                    <AIResponse>
                      {message.parts.find((part) => part.type === 'text')?.text ??
                        ''}
                    </AIResponse>
                  </AIMessageContent>
                </div>
              </AIMessage>
            ))}
        </div>
        <div className="relative">
          <div className="px-3 pt-4 pb-2">
            <p className="font-mono text-muted-foreground text-xs tracking-tighter uppercase">
              INSTRUCTION
            </p>
          </div>
          <Textarea
            value={data.instructions ?? ''}
            onChange={handleInstructionsChange}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder="Enter instructions"
            className="nodrag shrink-0 resize-none rounded-none border-none bg-transparent! shadow-none focus-visible:ring-0 min-h-[80px]"
          />
        </div>
      </div>
      <ReasoningTunnel.In>
        {messages.flatMap((message) =>
          message.parts
            .filter((part) => part.type === 'reasoning')
            .flatMap((part) => part.text ?? '')
        )}
      </ReasoningTunnel.In>
      
      {/* Render chat interface in the tunnel when this node is active - key ensures unmount/remount */}
      {chatPanel.isOpen && chatPanel.nodeId === id && (
        <ChatTunnel.In>
          <ChatInterface 
            key={`chat-${id}-${chatPanel.isOpen ? 'open' : 'closed'}`}
            nodeId={id}
            projectId={project?.id}
            initialMessages={(() => {
              const chatHistory = data.chatHistory || [];
              console.log('PASSING TO CHAT INTERFACE:');
              console.log('Node data.chatHistory length:', chatHistory.length);
              console.log('Node data.chatHistory:', JSON.stringify(chatHistory.map((m: any) => ({
                id: m?.id,
                role: m?.role,
                text: m?.parts?.find((p: any) => p.type === 'text')?.text?.substring(0, 50) + '...'
              })), null, 2));
              return chatHistory;
            })()}
            onMessageUpdate={(messages) => {
              console.log('RECEIVED MESSAGE UPDATE:', messages.length, 'messages');
              updateNodeData(id, { chatHistory: messages });
            }}
            onApplyRefinement={handleRefinement}
          />
        </ChatTunnel.In>
      )}
      </NodeLayout>
    </div>
  );
};