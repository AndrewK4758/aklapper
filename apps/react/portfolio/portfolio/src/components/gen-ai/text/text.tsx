import { useScrollIntoView } from '@aklapper/react-shared';
import type { PromptRequest } from '@aklapper/vertex-ai';
import type { FileData } from '@google-cloud/vertexai';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { useRef, type JSX } from 'react';
import { useOutletContext } from 'react-router';
import { io, type Socket } from 'socket.io-client';
import * as Yup from 'yup';
import useGenAiWebsockets from '../../../hooks/useGenAiWebsockets';
import {
  genAiTextInputButtonSxProps,
  labelSx,
  textInputSx,
  topLevelModeStyle,
} from '../../../styles/gen-ai-styles.jsx';
import type { OutletContextProps } from '../../../types/types.js';
import ChatInput from '../chat-input/chat-input.jsx';

const validationSchema = Yup.object<PromptRequest>().shape({
  text: Yup.string().required('Must be a valid question or statement').min(2, 'Must be a valid question or statement'),
  fileData: Yup.mixed<FileData>().nullable().notRequired(),
});

const wsURL = import.meta.env.VITE_VERTEX_WS_URL;

interface TextGeneratorProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

/**
 * This component renders the text generation section of the generative AI page.
 * It allows users to input a prompt and send it to the AI model for processing.
 *
 * @returns {JSX.Element} The rendered TextGenerator component.
 */

const TextGenerator = ({ isLoading, setIsLoading }: TextGeneratorProps): JSX.Element => {
  const clientIo = io(wsURL, {
    autoConnect: false,
    reconnectionAttempts: 10,
    reconnectionDelay: 2500,
    withCredentials: false,
    secure: true,
  });
  const socketRef = useRef<Socket>(clientIo);
  const socket = socketRef.current;
  const { prompt, setPromptResponse } = useOutletContext<OutletContextProps>();
  const divRef = useRef<HTMLDivElement>(null);

  useScrollIntoView(divRef);

  useGenAiWebsockets(socket, setPromptResponse);

  return (
    <Paper component={'div'} key={'gen-ai-text-input-paper'} id='gen-ai-text-input-paper' sx={topLevelModeStyle}>
      <Container component={'section'} key={'gen-ai-text-input-wrapper'} id='gen-ai-text-input-wrapper'>
        <ChatInput<PromptRequest>
          method='get'
          type='text'
          buttonText='Submit Prompt'
          buttonType='submit'
          names={Object.keys(prompt)}
          labelText={'Prompt Input'}
          variant='text'
          socket={socket}
          setLoading={setIsLoading}
          initialValues={prompt}
          validationSchema={validationSchema}
          breakpointsChatInputButton={genAiTextInputButtonSxProps}
          breakpointsChatInputText={textInputSx}
          breakpointsChatInputLabel={labelSx}
          breakpointsWrapperBoxSx={{ width: '100%' }}
        />
      </Container>
    </Paper>
  );
};

export default TextGenerator;
