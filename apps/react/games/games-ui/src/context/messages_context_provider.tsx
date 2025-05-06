import type { PrivateMessageDetails } from '@aklapper/types';
import { useState, type ReactNode } from 'react';
import { MessageContext } from './messages_context';

interface MessageContextProviderProps {
  children: ReactNode | ReactNode[];
}

export default function MessageContextProvider({ children }: MessageContextProviderProps) {
  const [messages, setMessages] = useState<PrivateMessageDetails[]>(() => {
    const savedMessages = sessionStorage.getItem('messages');

    return savedMessages ? JSON.parse(savedMessages) : [];
  });

  const addMessage = (newMessage: PrivateMessageDetails) => {
    const updatedMessages = [...messages, newMessage];

    setMessages(updatedMessages);
  };

  sessionStorage.setItem('messages', JSON.stringify(messages));

  return <MessageContext.Provider value={{ messages, addMessage }}>{children}</MessageContext.Provider>;
}
