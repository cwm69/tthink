'use client';

import { Button } from '@/components/ui/button';
import { useProject } from '@/providers/project';
import { useGateway } from '@/providers/gateway/client';
import { useChat } from '@ai-sdk/react';
import { getIncomers, useReactFlow } from '@xyflow/react';
import {
  getTextFromTextNodes,
  getTranscriptionFromAudioNodes,
  getImagesFromImageNodes,
  getDescriptionsFromImageNodes,
  getTweetContentFromTweetNodes,
  getFilesFromFileNodes,
} from '@/lib/xyflow';
import { SparklesIcon, RotateCcwIcon, Loader2Icon, MessageCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { ModelSelector } from '@/components/nodes/model-selector';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';

type ChatInterfaceProps = {
  nodeId: string;
  initialMessages?: any[];
  onMessageUpdate?: (messages: any[]) => void;
  projectId?: string;
  onApplyRefinement?: (prompt: string, modelId: string) => void;
};

const getDefaultModel = (models: ReturnType<typeof useGateway>['models']) => {
  const defaultModel = Object.entries(models).find(([_, model]) => model.default);
  return defaultModel?.[0] || 'o3';
};

export const ChatInterface = ({ nodeId, initialMessages = [], onMessageUpdate, projectId, onApplyRefinement }: ChatInterfaceProps) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isRefining, setIsRefining] = useState(false);
  const [reasoningStartTime, setReasoningStartTime] = useState<number | null>(null);
  const [reasoningDuration, setReasoningDuration] = useState<Record<string, number>>({});
  const projectContext = useProject();
  const project = projectContext?.project;
  const { updateNodeData, getNode, getNodes, getEdges } = useReactFlow();
  const { models } = useGateway();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentProjectId = project?.id || projectId;

  useEffect(() => {
    if (!selectedModel && Object.keys(models).length > 0) {
      setSelectedModel(getDefaultModel(models));
    }
  }, [models, selectedModel]);

  const getContextSystemMessage = useCallback(() => {
    const node = getNode(nodeId);
    if (!node) return '';

    const generatedContent = node.data.generated?.text;
    const instructions = node.data.instructions;
    const nodeType = node.type;
    
    const nodes = getNodes();
    const edges = getEdges();
    const incomers = getIncomers(node, nodes, edges);
    
    const textPrompts = getTextFromTextNodes(incomers);
    const audioPrompts = getTranscriptionFromAudioNodes(incomers);
    const imageDescriptions = getDescriptionsFromImageNodes(incomers);
    const tweetContent = getTweetContentFromTweetNodes(incomers);
    
    let contextMessage = `You are helping the user refine content in a ${nodeType} node.`;
    
    if (textPrompts.length > 0) contextMessage += `\n\nUPSTREAM TEXT INPUTS:\n${textPrompts.join('\n')}`;
    if (audioPrompts.length > 0) contextMessage += `\n\nUPSTREAM AUDIO TRANSCRIPTS:\n${audioPrompts.join('\n')}`;
    if (imageDescriptions.length > 0) contextMessage += `\n\nUPSTREAM IMAGE DESCRIPTIONS:\n${imageDescriptions.join('\n')}`;
    if (tweetContent.length > 0) contextMessage += `\n\nUPSTREAM TWEET CONTENT:\n${tweetContent.join('\n')}`;
    if (generatedContent) contextMessage += `\n\nCURRENT GENERATED CONTENT:\n${generatedContent}`;
    if (instructions) contextMessage += `\n\nCURRENT INSTRUCTIONS:\n${instructions}`;
    
    return contextMessage;
  }, [getNode, getNodes, getEdges, nodeId]);

  const { messages, sendMessage, setMessages, status } = useChat({
    id: `node-${nodeId}-chat`,
    onError: (error) => toast.error('chat error: ' + error.message),
  });

  // Initialize messages once when component mounts
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    if (!initialized && initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      setInitialized(true);
    } else if (!initialized) {
      setInitialized(true);
    }
  }, [initialized, initialMessages, setMessages]);

  const prevMessagesLength = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessagesLength.current && messages.length > 0) {
      updateNodeData(nodeId, { chatHistory: messages });
      onMessageUpdate?.(messages);
    }
    prevMessagesLength.current = messages.length;
  }, [messages, updateNodeData, nodeId, onMessageUpdate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track reasoning timing
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.role === 'assistant') {
      const hasReasoning = latestMessage.parts?.some(part => part.type === 'reasoning');
      
      if (hasReasoning && status === 'streaming' && !reasoningStartTime) {
        setReasoningStartTime(Date.now());
      } else if (hasReasoning && status !== 'streaming' && reasoningStartTime) {
        const duration = Math.round((Date.now() - reasoningStartTime) / 1000);
        setReasoningDuration(prev => ({
          ...prev,
          [latestMessage.id]: duration
        }));
        setReasoningStartTime(null);
      }
    }
  }, [messages, status, reasoningStartTime]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'streaming' || !currentProjectId) return;
    
    const currentInput = input;
    setInput('');

    await sendMessage({
      text: currentInput,
    }, {
      body: {
        modelId: selectedModel,
        systemMessage: getContextSystemMessage(),
      },
    });
  }, [input, status, currentProjectId, sendMessage, selectedModel, getContextSystemMessage]);

  const applyToNode = useCallback(async (messageText: string) => {
    if (!currentProjectId) return;
    setIsRefining(true);
    
    try {
      const node = getNode(nodeId);
      if (!node) {
        toast.error('node not found');
        return;
      }

      const currentContent = node.data.generated?.text || node.data.instructions || '';
      const recentMessages = messages.filter(m => m.role !== 'system').slice(-6);
      const chatContext = recentMessages.map(m => `${m.role}: ${m.parts?.find(p => p.type === 'text')?.text || m.content || ''}`).join('\n');

      const refinementPrompt = `Based on this chat conversation, please refine the following content:

CURRENT CONTENT:
${currentContent}

RECENT CHAT CONTEXT:
${chatContext}

SPECIFIC GUIDANCE TO APPLY:
${messageText}

Please provide a refined version that incorporates the insights from our conversation. Only return the refined content, nothing else.`;

      if (onApplyRefinement) {
        onApplyRefinement(refinementPrompt, selectedModel);
        toast.success('starting node refinement...');
      } else {
        toast.error('refinement not available');
      }
    } catch (error) {
      console.error('Refinement error:', error);
      toast.error('failed to start refinement');
    } finally {
      setIsRefining(false);
    }
  }, [getNode, nodeId, currentProjectId, messages, selectedModel, onApplyRefinement]);

  const resetChat = useCallback(() => {
    updateNodeData(nodeId, { chatHistory: [] });
    onMessageUpdate?.([]);
    setMessages([]);
    toast.success('chat reset');
  }, [setMessages, updateNodeData, nodeId, onMessageUpdate]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex gap-2 items-center">
        <div className="flex-1 min-w-0">
          <ModelSelector
            value={selectedModel}
            options={models}
            onChange={setSelectedModel}
            width="100%"
            className="max-w-full"
          />
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => {
            const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
            const textContent = lastAssistantMessage?.parts?.find(p => p.type === 'text')?.text || '';
            applyToNode(textContent);
          }}
          disabled={isRefining || !messages.some(m => m.role === 'assistant')}
        >
          {isRefining ? (
            <>
              <Loader2Icon className="animate-spin mr-2" />
              Refining...
            </>
          ) : (
            <>
              <SparklesIcon className="mr-2" />
              Apply to Node
            </>
          )}
        </Button>
      </div>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <MessageCircleIcon className="size-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-muted-foreground text-sm">
                  Chat with AI to refine your content
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Use "Apply to Node" to implement suggestions
                </p>
              </div>
            </div>
          ) : (
            messages
              .filter(message => message.role !== 'system')
              .filter(message => 
                message.parts?.some(part => part.type === 'reasoning' || (part.type === 'text' && part.text)) ||
                message.content
              )
              .map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.role === 'assistant' && message.parts?.some(part => part.type === 'reasoning') && (
                    <Reasoning 
                      isStreaming={status === 'streaming' && message.id === messages[messages.length - 1]?.id}
                      key={`reasoning-${message.id}`}
                    >
                      <ReasoningTrigger 
                        title={
                          reasoningDuration[message.id] 
                            ? `Thought for ${reasoningDuration[message.id]} seconds`
                            : status === 'streaming' && message.id === messages[messages.length - 1]?.id
                            ? "Thinking..."
                            : "Reasoning"
                        }
                      />
                      <ReasoningContent>
                        {message.parts?.find(part => part.type === 'reasoning')?.text}
                      </ReasoningContent>
                    </Reasoning>
                  )}
                  
                  {(message.content || message.parts?.some(part => part.type === 'text' && part.text)) && (
                    <Response>
                      {message.content || message.parts?.find(part => part.type === 'text')?.text}
                    </Response>
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          <div ref={messagesEndRef} />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="p-4">
        <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for refinements or changes..."
        />
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputButton onClick={resetChat} disabled={isRefining}>
              <RotateCcwIcon />
            </PromptInputButton>
          </PromptInputTools>
          <PromptInputSubmit
            status={status === 'streaming' ? 'streaming' : 'ready'}
            disabled={!input.trim() || status === 'streaming' || !currentProjectId}
          />
        </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};