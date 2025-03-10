import { useScrollIntoView } from '@aklapper/react-shared';
import type { PromptRequest } from '@aklapper/vertex-ai';
import { FileData } from '@google-cloud/vertexai';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { useContext, useRef, type JSX } from 'react';
import { useOutletContext } from 'react-router';
import * as Yup from 'yup';
import { WebSocketContext, WebSocketContextType } from '../../../contexts/websocket-context.jsx';
import useGenAiWebsockets from '../../../hooks/useGenAiWebsockets.jsx';
import {
  genAiTextInputButtonSxProps,
  labelSx,
  textInputSx,
  topLevelModeStyle
} from '../../../styles/gen-ai-styles.jsx';
import type { OutletContextProps } from '../../../types/types.tsx';
import ChatInput from '../chat-input/chat-input.jsx';

const validationSchema = Yup.object<PromptRequest>().shape({
  text: Yup.string().required('Must be a valid question or statement').min(2, 'Must be a valid question or statement'),
  fileData: Yup.mixed<FileData>().nullable().notRequired()
});

/**
 * This component renders the text generation section of the generative AI page.
 * It allows users to input a prompt and send it to the AI model for processing.
 *
 * @returns {JSX.Element} The rendered TextGenerator component.
 */

const TextGenerator = (): JSX.Element => {
  const { socket } = useContext<WebSocketContextType>(WebSocketContext);
  const { prompt, setLoading, setPromptResponse } = useOutletContext<OutletContextProps>();
  const divRef = useRef<HTMLDivElement>(null);

  useScrollIntoView(divRef);

  useGenAiWebsockets(socket, setLoading, setPromptResponse);

  return (
    <Paper component={'div'} key={'gen-ai-text-input-paper'} id="gen-ai-text-input-paper" sx={topLevelModeStyle}>
      <Container component={'section'} key={'gen-ai-text-input-wrapper'} id="gen-ai-text-input-wrapper">
        <ChatInput<PromptRequest>
          method="get"
          type="text"
          buttonText="Submit Prompt"
          buttonType="submit"
          names={Object.keys(prompt)}
          labelText={'Prompt Input'}
          variant="text"
          socket={socket}
          setLoading={setLoading}
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
