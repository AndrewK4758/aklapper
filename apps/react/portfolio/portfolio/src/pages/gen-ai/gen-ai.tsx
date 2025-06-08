import { Label, Text, useScrollIntoView, Waiting } from '@aklapper/react-shared';
import type { PromptRequest } from '@aklapper/vertex-ai';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type JSX,
  type SetStateAction,
} from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import PromptResponse from '../../components/gen-ai/chat-response/chat-response';
import { MediaRecorderClientContextProvider } from '../../contexts/audio-context';
import loadContextPath from '../../services/loaders/gen-ai/load-context-path';
import { crudHeaderTextSxProps, crudPaperSxProps } from '../../styles/crud-styles';
import { gamesButtonLabelsSxProps } from '../../styles/games-styles';
import { renderPreTagInsideParentDiv } from '../../styles/gen-ai-styles';
import {
  buttonSXProps,
  fullSizeBlock,
  modalButtonBoxStyles,
  pagesOutletStyles,
  pagesTitlesBoxStyles,
  pagesTitleSx,
  pagesToolbarStyles,
  pagesWrapperStyles,
} from '../../styles/pages-styles';
import { body, title } from '../static/gen-ai-text';

const PromptBuilder = lazy(() => import('../../components/gen-ai/prompt-builder/prompt-builder.jsx'));

export type LayoutOutletContextProps = {
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
};

const promptInit: PromptRequest = { text: '', fileData: null };

/**
 * This component renders the home page for the generative AI section of the application.
 * It provides an interface for users to interact with the AI model, including building prompts and viewing responses.
 *
 * @returns {JSX.Element} The rendered GenAiHome component.
 */

const GenAiHome = (): JSX.Element => {
  const { loading, setLoading } = useOutletContext<LayoutOutletContextProps>();
  const [prompt, setPrompt] = useState<PromptRequest>(promptInit);
  const [open, setOpen] = useState<boolean>(false);
  const [promptResponse, setPromptResponse] = useState<string[]>([]);
  const divRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const nav = useNavigate();

  useScrollIntoView(divRef);

  useEffect(() => {
    loadContextPath();
  }, []);

  return (
    <Box
      onLoad={() => setLoading(false)}
      ref={divRef}
      component={'div'}
      key={'gen-ai-wrapper'}
      id='gen-ai-wrapper'
      sx={pagesWrapperStyles}
    >
      <Paper
        elevation={2}
        component={'div'}
        key={'gen-ai-header-wrapper'}
        id='gen-ai-header-wrapper'
        sx={crudPaperSxProps}
      >
        <Box component={'section'} key={'gen-ai-title-wrapper'} id='gen-ai-title-wrapper' sx={pagesTitlesBoxStyles}>
          <Text component={'h3'} variant='h3' children={title} sx={pagesTitleSx} />
        </Box>
        <Container key={'gen-ai-header-container'} id={'gen-ai-header-container'} maxWidth={false}>
          <AppBar
            component={'div'}
            id='gen-ai-navbar-wrapper'
            key={'gen-ai-navbar-wrapper'}
            elevation={0}
            position='static'
            sx={{ borderRadius: 1 }}
          >
            <Toolbar component={'nav'} id='gen-ai-navbar' key={'gen-ai-navbar'} sx={pagesToolbarStyles}>
              <ButtonGroup key={'gen-ai-button-group'} id={'gen-ai-button-group'} color='primary' fullWidth={true}>
                <Button
                  LinkComponent={'button'}
                  variant='text'
                  key={'gen-ai-text-button'}
                  id='gen-ai-text-button'
                  onClick={() => nav('text', { replace: true })}
                  sx={buttonSXProps}
                >
                  <Label
                    id='gen-ai-text-button-label'
                    htmlFor='gen-ai-text-button'
                    tooltipTitle={'Generate a Google Gemini LLM Text Response'}
                    labelVariant='button'
                    labelText='Text'
                    placement='top'
                    labelTextSx={gamesButtonLabelsSxProps}
                  />
                </Button>
                <Button
                  LinkComponent={'button'}
                  variant='text'
                  key={'gen-ai-image'}
                  id='gen-ai-image'
                  onClick={() => nav('image', { replace: true })}
                  sx={buttonSXProps}
                >
                  <Label
                    id='gen-ai-image-button-label'
                    htmlFor='gen-ai-image'
                    tooltipTitle={'Generate an Google Gemini LLM Image Response'}
                    labelVariant='button'
                    labelText='Image'
                    placement='top'
                    labelTextSx={gamesButtonLabelsSxProps}
                  />
                </Button>
                <Button
                  LinkComponent={'button'}
                  variant='text'
                  key={'gen-ai-audio'}
                  id='gen-ai-audio'
                  onClick={() => nav('audio', { replace: true })}
                  sx={buttonSXProps}
                >
                  <Label
                    id='gen-ai-audio-button-label'
                    htmlFor='gen-ai-audio'
                    tooltipTitle={'Generate a Google Gemini LLM Text Response with Audio as Input'}
                    labelVariant='button'
                    labelText='Audio'
                    placement='top'
                    labelTextSx={gamesButtonLabelsSxProps}
                  />
                </Button>
              </ButtonGroup>
            </Toolbar>
          </AppBar>
        </Container>
        <Container maxWidth={false} sx={{ paddingY: 2 }}>
          <Collapse
            in={pathname === '/gen-ai' && !open}
            key={'gen-ai-header-text-collapse'}
            id={'gen-ai-header-text-collapse'}
          >
            <Box
              component={'div'}
              key={'gen-ai-header-text-wrapper'}
              id='gen-ai-header-text-wrapper'
              sx={{ paddingY: 2 }}
            >
              <Text
                component={'p'}
                key={'gen-ai-header-text'}
                id='gen-ai-header-text'
                variant='body1'
                children={body}
                sx={crudHeaderTextSxProps}
              />
            </Box>
          </Collapse>
          <Box key={'prompt-builder-wrapper'} id={'prompt-builder-wrapper'} sx={modalButtonBoxStyles}>
            <Button
              key={'prompt-builder-button'}
              id={'prompt-builder-button'}
              color='secondary'
              variant='text'
              onClick={() => setOpen(!open)}
              sx={buttonSXProps}
            >
              {open ? 'Close' : 'Prompt Builder'}
            </Button>
          </Box>
        </Container>
      </Paper>
      {open && (
        <Box
          component={'section'}
          key={'prompt-builder-form-wrapper'}
          id='prompt-builder-form-wrapper'
          sx={crudPaperSxProps}
        >
          <Suspense fallback={<Waiting src={waiting} />}>
            <Collapse in={open} component={'div'}>
              <PromptBuilder loading={loading} setLoading={setLoading} setPrompt={setPrompt} />
            </Collapse>
          </Suspense>
        </Box>
      )}

      <MediaRecorderClientContextProvider>
        <Box component={'div'} key={'gen-ai-outlet-wrapper'} id='gen-ai-outlet-wrapper' sx={pagesOutletStyles}>
          <Outlet context={{ prompt, promptResponse, loading, setPromptResponse, setLoading }} />
        </Box>
      </MediaRecorderClientContextProvider>

      <Dialog
        open={loading}
        component={'div'}
        key={'gen-ai-response-loading-wrapper'}
        id='gen-ai-response-loading-wrapper'
      >
        <Box
          component={'div'}
          key={'gen-ai-response-loading-wrapper'}
          id='gen-ai-response-loading-wrapper'
          height={'40%'}
          maxHeight={'350px'}
          flex={'0 1 40%'}
        >
          <Waiting src={waiting} />
        </Box>
      </Dialog>

      {promptResponse.length > 0 ? (
        <Box
          component={'div'}
          key={'gen-ai-response-wrapper'}
          id='gen-ai-response-wrapper'
          sx={{ height: 'fit-content', width: '60vw' }}
        >
          <Paper component={'div'} key={'gen-ai-response-paper'} id='gen-ai-response-paper' sx={fullSizeBlock}>
            <Container
              component={'div'}
              key={'gen-ai-response-container'}
              id='gen-ai-response-container'
              sx={fullSizeBlock}
            >
              <PromptResponse
                response={promptResponse}
                setLoading={setLoading}
                setPromptResponse={setPromptResponse}
                chatResponseLabelProps={{ textAlign: 'center' }}
                chatResponseTextProps={renderPreTagInsideParentDiv as CSSProperties}
              />
            </Container>
          </Paper>
        </Box>
      ) : null}
    </Box>
  );
};

export default GenAiHome;
