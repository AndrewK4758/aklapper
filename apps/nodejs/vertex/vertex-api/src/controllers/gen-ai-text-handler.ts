import type { SocketCallback } from '@aklapper/types';
import { generateTextContent } from '@aklapper/vertex-ai';
import { type Socket } from 'socket.io';

const handleTextDataChunks: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async prompt => {
    const { stream } = await generateTextContent(prompt);

    for await (const chunk of stream) {
      if (chunk.candidates) {
        if (chunk.candidates[0].content.parts[0].text) {
          const textData = chunk.candidates[0].content.parts[0].text;
          socket.emit('chunk', { response: textData });
        }
      }
    }
  });
};

export default handleTextDataChunks;
