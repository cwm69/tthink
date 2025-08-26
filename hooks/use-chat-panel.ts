import { atom, useAtom } from 'jotai';

type ChatPanelState = {
  isOpen: boolean;
  nodeId: string | null;
};

export const chatPanelAtom = atom<ChatPanelState>({
  isOpen: false,
  nodeId: null,
});

export const useChatPanel = () => useAtom(chatPanelAtom);