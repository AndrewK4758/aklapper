import type { PrivateMessageDetails } from '@aklapper/types';
import { useState, type ReactNode } from 'react';
import { MessageContext } from './messages_context';

function initMessageState() {
  const savedMessages = sessionStorage.getItem('messages');

  return savedMessages ? JSON.parse(savedMessages) : [];
}

interface MessageContextProviderProps {
  children: ReactNode | ReactNode[];
}

export default function MessageContextProvider({ children }: MessageContextProviderProps) {
  const [messages, setMessages] = useState<PrivateMessageDetails[]>(() => initMessageState());

  const addMessage = (newMessage: PrivateMessageDetails) => {
    setMessages(prev => {
      const updatedMessages = [...prev, newMessage];

      sessionStorage.setItem('messages', JSON.stringify(updatedMessages));

      return updatedMessages;
    });
  };

  const clearSavedMessages = () => {
    console.log('cleared messages');
    sessionStorage.removeItem('messages');
    setMessages(() => initMessageState());
  };

  return (
    <MessageContext.Provider value={{ messages, addMessage, clearSavedMessages }}>{children}</MessageContext.Provider>
  );
}
