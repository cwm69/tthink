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
  useState,
} from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import type { TextNodeProps } from '.';
import { ModelSelector } from '../model-selector';
import { NodeHistoryMenu } from '@/components/node-history-menu';
import { addDeltaVersion, switchToDeltaVersion, hasDeltaVersions, getCurrentDeltaContent } from '@/lib/node-history-delta';

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
      // Store current state in history before generation (if content exists)
      const previousData = data.generated;
      const newGeneratedData = {
        text: message.parts.find((part) => part.type === 'text')?.text ?? '',
        sources:
          message.parts?.filter((part) => part.type === 'source-url') ?? [],
      };
      
      let updatedNodeData = {
        ...data,
        generated: newGeneratedData,
        updatedAt: new Date().toISOString(),
        currentVersionPointer: undefined, // Clear to make this the latest version
      };

      // Add to versions if this is a regeneration (previous content exists)
      if (previousData?.text) {
        updatedNodeData = addDeltaVersion(
          updatedNodeData,
          'generation',
          { text: previousData.text },
          { modelId }
        );
      }

      updateNodeData(id, updatedNodeData);

      setReasoning((oldReasoning) => ({
        ...oldReasoning,
        isGenerating: false,
      }));

      toast.success('text generated successfully');

      setTimeout(() => mutate('credits'), 5000);
    },
  });

  const handleRefinement = useCallback(async (refinementPrompt: string, refinementModelId: string) => {
    // Store current state in versions before refinement
    const currentData = getCurrentDeltaContent(data);
    if (currentData?.text) {
      const updatedData = addDeltaVersion(
        data,
        'refinement',
        { text: currentData.text },
        {
          prompt: refinementPrompt,
          modelId: refinementModelId,
        }
      );
      updateNodeData(id, updatedData);
    }

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
  }, [sendMessage, setMessages, data, id, updateNodeData]);

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

  const [isEditingGenerated, setIsEditingGenerated] = useState(false);
  const [preventBlur, setPreventBlur] = useState(false);


  // Store reference to debounced manual edit tracking
  const manualEditTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualEditRef = useRef(false);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (manualEditTimeoutRef.current) {
        clearTimeout(manualEditTimeoutRef.current);
      }
    };
  }, []);
  
  const handleGeneratedTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const currentContent = getCurrentDeltaContent(data);
    const currentText = currentContent?.text || '';
    
    // If this is a significant change, save the current state as a version first
    if (currentText.trim() && newText !== currentText && !isManualEditRef.current) {
      // Clear existing timeout
      if (manualEditTimeoutRef.current) {
        clearTimeout(manualEditTimeoutRef.current);
      }
      
      isManualEditRef.current = true;
      
      // Save current state as a version, then update with new content
      const updatedDataWithVersion = addDeltaVersion(
        {
          ...data,
          generated: { ...data.generated, text: newText },
          currentVersionPointer: undefined, // New edit becomes latest
        },
        'manual_edit',
        { text: currentText },
        { userAction: 'manual_edit' }
      );
      
      updateNodeData(id, updatedDataWithVersion);
      
      // Reset flag after 2 seconds of no typing
      manualEditTimeoutRef.current = setTimeout(() => {
        isManualEditRef.current = false;
      }, 2000);
      
      return;
    }
    
    // Normal update (minor changes or rapid typing)
    updateNodeData(id, {
      ...data,
      generated: { ...data.generated, text: newText },
      currentVersionPointer: undefined, // Always latest when editing
    });
  }, [id, updateNodeData, data]);

  const handleRevert = useCallback((entryId: string) => {
    const { nodeData, success } = switchToDeltaVersion(data, entryId);
    
    if (success) {
      updateNodeData(id, nodeData);
      // Exit edit mode when switching versions
      setIsEditingGenerated(false);
      if (entryId === 'latest') {
        toast.success('Switched to latest version');
      } else {
        toast.success('Switched to previous version');
      }
    } else {
      toast.error('Failed to switch version');
    }
  }, [data, id, updateNodeData]);

  // No longer needed - using textarea instead of rich text editor





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
      
      // Add history menu if there's versions
      if (hasDeltaVersions(data)) {
        items.push({
          tooltip: 'version history',
          children: (
            <NodeHistoryMenu
              nodeData={data}
              onRevert={handleRevert}
              disabled={!project?.id}
              onInteraction={() => {
                // Temporarily prevent blur when interacting with history
                setPreventBlur(true);
                setTimeout(() => {
                  setPreventBlur(false);
                }, 1000);
              }}
            />
          ),
        });
      }
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
      // Debug streaming
      console.log('🔄 Streaming status:', { 
        status, 
        messagesCount: messages.length, 
        nonUserMessages: messages.filter(m => m.role !== 'user').length,
        latestMessage: messages[messages.length - 1]?.parts?.find(p => p.type === 'text')?.text?.slice(0, 50) + '...'
      });
      
      const interval = setInterval(() => {
        if (scrollContainerRef.current && isUserNearBottom.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [status, messages]);

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
          {getCurrentDeltaContent(data)?.text &&
            status !== 'submitted' && 
            status !== 'streaming' && (
              <div className="nodrag cursor-text select-text w-full">
                {isEditingGenerated ? (
                  <Textarea
                    key={(data as any).currentVersionPointer || 'latest'} // Force re-render when version changes
                    autoFocus
                    value={getCurrentDeltaContent(data)?.text || ''}
                    onChange={handleGeneratedTextChange}
                    onBlur={(e) => {
                      const relatedTarget = e.relatedTarget as Element | null;
                      const nodeElement = e.currentTarget.closest(`[data-id="${id}"]`);
                      
                      // Don't exit if we're preventing blur (dropdown interaction)
                      if (preventBlur) {
                        return;
                      }
                      
                      // If focus moved to something within the same node, don't exit
                      if (relatedTarget && nodeElement?.contains(relatedTarget)) {
                        return;
                      }
                      
                      // Exit edit mode
                      setTimeout(() => {
                        if (!preventBlur) {
                          setIsEditingGenerated(false);
                        }
                      }, 50);
                    }}
                    onKeyDown={(e) => {
                      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete'].includes(e.key)) {
                        e.stopPropagation();
                      }
                      if (e.key === 'Escape') {
                        setIsEditingGenerated(false);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full resize-none border-none bg-transparent focus:ring-0 focus:outline-none min-h-[200px]"
                    style={{ fontSize: 'inherit', fontFamily: 'inherit', lineHeight: 'inherit' }}
                  />
                ) : (
                  <div 
                    className="w-full break-words cursor-text hover:bg-muted/20 rounded transition-colors min-h-[200px]"
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsEditingGenerated(true);
                    }}
                    title="Double-click to edit"
                  >
                    <AIResponse className="w-full break-words">{getCurrentDeltaContent(data)?.text}</AIResponse>
                  </div>
                )}
              </div>
            )}
          {!getCurrentDeltaContent(data)?.text &&
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