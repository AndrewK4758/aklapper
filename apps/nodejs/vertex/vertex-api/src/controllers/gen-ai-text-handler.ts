import type { ChatEntry, SocketCallback } from '@aklapper/types';
import { generateTextContent } from '@aklapper/vertex-ai';
import { type Socket } from 'socket.io';

const handleTextDataChunks: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (chatData: ChatEntry, callback: ({ status }: { status: number }) => void) => {
    console.log(`[${new Date().toLocaleDateString()} - RECEIVED]: `, chatData);

    const { stream } = await generateTextContent(chatData);

    for await (const chunk of stream) {
      if (chunk.candidates) {
        if (chunk.candidates[0].content.parts[0].text) {
          const textData = chunk.candidates[0].content.parts[0].text;
          console.log(textData);
          chatData.response += textData;
          socket.emit('chunk', chatData);
        }
      }
    }
    callback({
      status: 200,
    });
    console.log(`[${new Date().toLocaleDateString()} - SUCCESFUL]: `, chatData);
  });
};

export default handleTextDataChunks;
