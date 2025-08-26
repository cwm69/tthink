'use client';

import { useChatPanel } from '@/hooks/use-chat-panel';
import { ChatTunnel } from '@/tunnels/chat';
import { MessageCircleIcon, XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';

export const ChatPanel = () => {
  const [chatPanel, setChatPanel] = useChatPanel();

  const handleClose = () => {
    setChatPanel({ isOpen: false, nodeId: null });
  };

  return (
    <AnimatePresence>
      {chatPanel.isOpen && chatPanel.nodeId && (
        <motion.div
          className="w-sm overflow-hidden border-r bg-background flex flex-col"
          initial={{ width: 0 }}
          animate={{ width: '24rem' }}
          exit={{ width: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Fixed header */}
          <div className="flex-shrink-0 flex items-center justify-between gap-4 bg-background px-4 py-2 border-b">
            <div className="flex items-center gap-2">
              <MessageCircleIcon className="size-4 text-primary" />
              <p className="font-semibold text-sm">Chat</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <XIcon className="size-3 text-muted-foreground" />
            </Button>
          </div>
          
          {/* Flexible content area */}
          <div className="flex-1 flex flex-col min-h-0">
            <ChatTunnel.Out />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};