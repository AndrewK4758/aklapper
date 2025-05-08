import type { PrivateMessageDetails } from '@aklapper/types';
import { createContext } from 'react';

export interface MessagesContextProps {
  messages: PrivateMessageDetails[];
  addMessage: (newMessage: PrivateMessageDetails) => void;
  clearSavedMessages: () => void;
}

export const MessageContext = createContext<MessagesContextProps>({
  messages: [],
  addMessage: () => ({}),
  clearSavedMessages: () => ({}),
});
