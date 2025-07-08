import { ResponseType, type IPromptInputData } from '@aklapper/prompt-builder';
import {
  CenteredFlexDiv,
  FormikValidationError,
  HelperTextBox,
  SectionTitle,
  StyledCard,
  Text,
  TextInput,
  useScrollIntoView,
} from '@aklapper/react-shared';
import type { ChatEntry } from '@aklapper/types';
import type { PromptRequest } from '@aklapper/vertex-ai';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import axios from 'axios';
import { useFormik } from 'formik';
import { useRef, useState, type Dispatch, type JSX, type SetStateAction } from 'react';
import { Form, useNavigate, type NavigateFunction } from 'react-router';
import * as Yup from 'yup';
import handleFormikBlur from '../../../services/actions/crud-actions/handle_formik_blur';
import Theme from '../../../styles/themes/theme';
import JsonIcon from '../../icons/json-icon';
import TextIcon from '../../icons/text-icon';
import { SUPPORTED_FORMATS } from '../static/definitions';
import { promptBuilderHeaderText } from '../static/prompt-builder-text';
import handleFileUpload from './file_upload';
import PromptBuilderResponse from './prompt-builder-response';

const promptInit: PromptRequest = { text: null, fileData: null };

const initialValues: IPromptInputData = {
  objective: '',
  instructions: '',
  textData: '',
  examples: '',
  constraints: '',
  tone: '',
  responseFormat: ResponseType.TEXT,
  responseInstructions: '',
};

const validationSchema = Yup.object({
  objective: Yup.string().required('Must have valid objective statement'),
  instructions: Yup.string(),
  textData: Yup.string(),
  examples: Yup.string(),
  constraints: Yup.string(),
  tone: Yup.string(),
  resposeFormat: Yup.string().oneOf(Object.values(ResponseType)),
  responseInstructions: Yup.string(),
});

interface PromptBuilderProps {
  loading: boolean;
  setUserChatEntry: Dispatch<SetStateAction<ChatEntry[]>>;
  setLoading: (loading: boolean) => void;
}

/**
 * This component renders a form for building prompts for the generative AI model.
 * It allows users to input various parameters for the prompt and then submits the data to the server to generate a prompt.
 *
 * @param {PromptBuilderProps} props - The props for the PromptBuilder component.
 * @param {boolean} props.loading - Whether the prompt is being generated.
 * @param {Dispatch<SetStateAction<PromptRequest>>} props.setPrompt - A function to update the prompt state.
 * @param {Dispatch<SetStateAction<boolean>>} props.setLoading - A function to update the loading state.
 * @returns {JSX.Element} The rendered PromptBuilder component.
 */

const PromptBuilder = ({ loading, setLoading }: PromptBuilderProps): JSX.Element => {
  const [openPromptResponse, setOpenPromptResponse] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<PromptRequest>(promptInit);
  const [builtPrompt, setBuiltPrompt] = useState<null | string>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useScrollIntoView(divRef);

  const formik = useFormik<IPromptInputData>({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async values => await handlePromptBuilder(values, setBuiltPrompt, setOpenPromptResponse, setLoading),
    onReset: () => setFileName(''),
  });

  /**
   * This function handles the file upload button click event.
   * It triggers the hidden file input element to open the file selection dialog.
   */

  const handleFileUploadButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <StyledCard id='prompt-builder-paper' sx={{ padding: Theme.spacing(4), width: '70%', margin: 'auto' }}>
      <CenteredFlexDiv id='prompt-builder'>
        <Box
          ref={divRef}
          component={'section'}
          id='prompt-builder-header-box'
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Text variant='h4' children={'Prompt Builder'} sx={{ flex: '0 1 25%' }} />
          <Divider orientation='vertical' flexItem />
          <Text
            variant='body1'
            children={promptBuilderHeaderText}
            sx={{ flex: '0 1 75%', padding: Theme.spacing(4) }}
          />
        </Box>
        <Form
          key={'prompt-builder-form'}
          method='POST'
          onSubmit={formik.handleSubmit}
          onReset={formik.handleReset}
          style={{ width: '70%' }}
        >
          <TextInput<IPromptInputData>
            id='objective-input'
            label='Objective'
            multiline={true}
            placeholder='What you want the AI todo'
            formik={formik}
            name={'objective'}
            variant={'outlined'}
            handleBlur={handleFormikBlur}
            slotProps={{ input: { sx: { backgroundColor: Theme.palette.background.default } } }}
          />
          <HelperTextBox multiline>
            <TextField
              label='Instructions'
              id='prompt-builder-instructions'
              multiline={true}
              fullWidth={true}
              rows={2}
              placeholder='How you want the AI to execute the objective'
              variant='outlined'
              onBlur={formik.handleBlur}
              onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
              onChange={formik.handleChange}
              onReset={formik.handleReset}
              name={'instructions'}
              value={formik.values.instructions}
              error={!!formik.errors['instructions']}
              slotProps={{
                input: {
                  sx: {
                    backgroundColor: Theme.palette.background.default,
                  },
                },
              }}
              helperText={formik.touched.instructions && formik.errors.instructions}
            />
          </HelperTextBox>
          <HelperTextBox multiline>
            <TextField
              label='Text Data'
              id='prompt-builder-text-data'
              multiline={true}
              fullWidth={true}
              rows={2}
              placeholder='Copy & Paste any simple text for context or processing'
              variant='outlined'
              onBlur={formik.handleBlur}
              onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
              onChange={formik.handleChange}
              onReset={formik.handleReset}
              name={'textData'}
              value={formik.values.textData}
              error={!!formik.errors['textData']}
              slotProps={{
                input: {
                  sx: {
                    backgroundColor: Theme.palette.background.default,
                  },
                },
              }}
              helperText={formik.touched['textData'] && formik.errors['textData']}
            />
          </HelperTextBox>
          <HelperTextBox multiline>
            <TextField
              label='Examples'
              id='prompt-builder-examples'
              multiline={true}
              fullWidth={true}
              rows={2}
              placeholder='Show AI Example of your desired outcome'
              variant='outlined'
              onBlur={formik.handleBlur}
              onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
              onChange={formik.handleChange}
              onReset={formik.handleReset}
              name={'examples'}
              value={formik.values.examples}
              error={!!formik.errors['examples']}
              slotProps={{
                input: {
                  sx: {
                    backgroundColor: Theme.palette.background.default,
                  },
                },
              }}
              helperText={formik.touched['examples'] && formik.errors['examples']}
            />
          </HelperTextBox>
          <HelperTextBox multiline>
            <TextField
              label='Constraints'
              id='prompt-builder-constraints'
              multiline={true}
              fullWidth={true}
              rows={2}
              placeholder='Limits you want AI to adhere to'
              variant='outlined'
              onBlur={formik.handleBlur}
              onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
              onChange={formik.handleChange}
              onReset={formik.handleReset}
              name={'constraints'}
              value={formik.values.constraints}
              error={!!formik.errors['constraints']}
              slotProps={{
                input: {
                  sx: {
                    backgroundColor: Theme.palette.background.default,
                  },
                },
              }}
              helperText={formik.touched['constraints'] && formik.errors['constraints']}
            />
          </HelperTextBox>
          <HelperTextBox multiline>
            <TextField
              label='Tone'
              id='prompt-builder-tone'
              multiline={true}
              fullWidth={true}
              rows={2}
              placeholder='The style, voice, mood, feeling you want the AI to convey'
              variant='outlined'
              onBlur={formik.handleBlur}
              onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
              onChange={formik.handleChange}
              onReset={formik.handleReset}
              name={'tone'}
              value={formik.values.tone}
              error={!!formik.errors['tone']}
              slotProps={{
                input: {
                  sx: {
                    backgroundColor: Theme.palette.background.default,
                  },
                },
              }}
              helperText={formik.touched['tone'] && formik.errors['tone']}
            />
          </HelperTextBox>
          <HelperTextBox multiline>
            <TextField
              label='Response Instructions'
              id='prompt-builder-response-instructions'
              multiline={true}
              fullWidth={true}
              rows={2}
              placeholder='The how AI will respond'
              variant='outlined'
              onBlur={formik.handleBlur}
              onFocus={async e => formik.setFieldTouched(e.currentTarget.name as string, false)}
              onChange={formik.handleChange}
              onReset={formik.handleReset}
              name={'responseInstructions'}
              value={formik.values.responseInstructions}
              error={!!formik.errors['responseInstructions']}
              slotProps={{
                input: {
                  sx: {
                    backgroundColor: Theme.palette.background.default,
                  },
                },
              }}
              helperText={formik.touched['responseInstructions'] && formik.errors['responseInstructions']}
            />
          </HelperTextBox>
          <Box as={'section'} id='prompt-builder-response-format-box'>
            <SectionTitle title={'Response Format'} variant='h6' />
            <Box as={'section'} id='prompt-builder-response-format-radio-box'>
              <RadioGroup
                id='prompt-builder-response-format'
                onBlur={formik.handleBlur}
                onChange={formik.handleChange}
                onReset={formik.handleReset}
                value={formik.values.responseFormat}
                name={'responseFormat'}
                sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around' }}
              >
                <FormControlLabel
                  id='response-format-text'
                  value={ResponseType.TEXT}
                  control={<Radio icon={<TextIcon />} />}
                  label={'Text'}
                />

                <FormControlLabel
                  id='response-format-json'
                  value={ResponseType.JSON}
                  control={<Radio icon={<JsonIcon />} />}
                  label={'JSON'}
                />
                <FormControlLabel
                  id='response-format-image'
                  value={ResponseType.IMAGE}
                  control={
                    <Radio icon={<InsertPhotoOutlinedIcon color='inherit' sx={{ height: '32px', width: '32px' }} />} />
                  }
                  label={'Image'}
                />
              </RadioGroup>
            </Box>
          </Box>
          <CenteredFlexDiv
            as={'span'}
            id='prompt-builder-document-wrapper'
            sx={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text variant='h6' children={`Uploaded File: `} />
            {loading ? null : <Text variant='h6' children={`${fileName}`} />}

            <input
              ref={fileInputRef}
              accept={SUPPORTED_FORMATS.join(', ')}
              id='document'
              name='document'
              type='file'
              style={{ display: 'none' }}
              onChange={() => handleFileUpload(prompt, fileInputRef, setPrompt, setFileName, setLoading)}
              onBlur={formik.handleBlur}
              onReset={formik.handleReset}
            />
            <FormikValidationError<IPromptInputData> elementName='document' formik={formik} />
          </CenteredFlexDiv>

          <Box as={'section'} id='prompt-builder-submit-box' sx={{ display: 'flex', justifyContent: 'space-evenly' }}>
            {!prompt.fileData && (
              <Button
                variant='text'
                type='button'
                id='prompt-builder-upload-file-button'
                onClick={handleFileUploadButtonClick}
              >
                Upload File
              </Button>
            )}
            <Button variant='text' type='submit' id='prompt-builder-submit-button'>
              Build Prompt
            </Button>
            <Button variant='text' type='reset' id='prompt-builder-reset-button' onReset={formik.handleReset}>
              Clear Values
            </Button>
            {builtPrompt && (
              <Button
                variant='text'
                type='button'
                id='copy-and-add-to-input'
                onClick={() => handleCopyPromptToClipboard(builtPrompt, setOpenPromptResponse, nav)}
              >
                Copy Prompt
              </Button>
            )}
            {builtPrompt && (
              <Button
                variant='text'
                id='open-prompt'
                type='button'
                onClick={() => setOpenPromptResponse(!openPromptResponse)}
              >
                {!openPromptResponse ? 'Open Prompt' : 'Close Prompt'}
              </Button>
            )}
          </Box>
        </Form>
      </CenteredFlexDiv>
      {openPromptResponse && (
        <Container id={'prompt-response-container'}>
          <PromptBuilderResponse prompt={builtPrompt} />
        </Container>
      )}
    </StyledCard>
  );
};
export default PromptBuilder;
/**
 * This function handles copying the generated prompt to the clipboard and adding it to the prompt state.
 *
 * @param {string | null} builtPrompt - The generated prompt.
 * @param {Dispatch<SetStateAction<PromptRequest>>} setUserChatEntry - A function to update the prompt state.
 * @param {Dispatch<SetStateAction<boolean>>} setOpenPromptResponse - A function to close the prompt response modal.
 * @param {NavigateFunction} nav - A function to navigate to the text section.
 */
const handleCopyPromptToClipboard = async (
  builtPrompt: string | null,
  setOpenPromptResponse: Dispatch<SetStateAction<boolean>>,
  nav: NavigateFunction,
) => {
  if (builtPrompt) {
    await navigator.clipboard.writeText(builtPrompt);
    setOpenPromptResponse(false);
    nav('text');
  }
};

const baseURL = import.meta.env.VITE_VERTEX_API_URL;

const handlePromptBuilder = async (
  values: IPromptInputData,
  setBuiltPrompt: Dispatch<SetStateAction<null | string>>,
  setOpenPromptResponse: Dispatch<SetStateAction<boolean>>,
  setLoading: (loading: boolean) => void,
) => {
  try {
    setLoading(true);
    const resp = await axios.post(`${baseURL}/build-prompt`, values, {
      headers: { 'Content-Type': 'application/json' },
    });

    const { finalPrompt } = resp.data;

    console.log(finalPrompt);
    setBuiltPrompt(finalPrompt);
    setOpenPromptResponse(true);
  } catch (error) {
    console.log(error);
  } finally {
    setLoading(false);
  }
};
