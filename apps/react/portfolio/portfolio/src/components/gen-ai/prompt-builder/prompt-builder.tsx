import { ResponseType, type IPromptInputData } from '@aklapper/prompt-builder';
import { FormikValidationError, SectionTitle, Text, useScrollIntoView } from '@aklapper/react-shared';
import { getContextPath } from '@aklapper/utils';
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
import { useRef, useState, type Dispatch, type JSX, type RefObject, type SetStateAction } from 'react';
import { Form, useActionData, useNavigate, useSubmit, type NavigateFunction, type SubmitTarget } from 'react-router';
import * as Yup from 'yup';
import Theme from '../../../styles/themes/theme';
import JsonIcon from '../../icons/json-icon.jsx';
import TextIcon from '../../icons/text-icon.jsx';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import HelperTextBox from '../../styled/helper_text_box';
import StyledCard from '../../styled/styled_card';
import { SUPPORTED_FORMATS } from '../static/definitions.jsx';
import { promptBuilderHeaderText } from '../static/prompt-builder-text.jsx';
import PromptBuilderResponse from './prompt-builder-response.jsx';

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
  setPrompt: Dispatch<SetStateAction<PromptRequest>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
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

const PromptBuilder = ({ loading, setPrompt, setLoading }: PromptBuilderProps): JSX.Element => {
  const [openPromptResponse, setOpenPromptResponse] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const submit = useSubmit();
  const nav = useNavigate();

  const action = useActionData() as string;

  useScrollIntoView(divRef);

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: values => submit(values as SubmitTarget, { method: 'POST', encType: 'application/json' }),
    onReset: () => setFileName(''),
    validateOnBlur: true,
    validateOnChange: true,
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
          <Box as={'section'} id='prompt-builder-input-elements-box'>
            <HelperTextBox multiline>
              <TextField
                id='objective-input'
                label='Objective'
                multiline={true}
                focused={true}
                fullWidth={true}
                rows={2}
                placeholder='What you want the AI todo'
                variant='outlined'
                onBlur={formik.handleBlur}
                onFocus={async e => await formik.setFieldTouched(e.currentTarget.name as string, false)}
                onChange={formik.handleChange}
                onReset={formik.handleReset}
                name={'objective'}
                value={formik.values.objective}
                error={!!formik.errors.objective}
                slotProps={{
                  input: {
                    sx: {
                      backgroundColor: Theme.palette.background.default,
                    },
                  },
                }}
                helperText={formik.touched.objective && formik.errors.objective}
              />
            </HelperTextBox>
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
                      <Radio
                        icon={<InsertPhotoOutlinedIcon color='inherit' sx={{ height: '32px', width: '32px' }} />}
                      />
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
                onChange={() => handleFileUpload(fileInputRef, setPrompt, setFileName, setLoading)}
                onBlur={formik.handleBlur}
                onReset={formik.handleReset}
              />
              <FormikValidationError<IPromptInputData> elementName='document' formik={formik} />
            </CenteredFlexDiv>

            <Box as={'section'} id='prompt-builder-submit-box' sx={{ display: 'flex', justifyContent: 'space-evenly' }}>
              {!action && (
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
              {action && (
                <Button
                  variant='text'
                  type='button'
                  id='copy-and-add-to-input'
                  onClick={() =>
                    handleCopyPromptToClipboardAndAddToInput(action, setPrompt, setOpenPromptResponse, nav)
                  }
                >
                  Copy & Add to Input
                </Button>
              )}
              {action && (
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
          </Box>
        </Form>
      </CenteredFlexDiv>
      {openPromptResponse && (
        <Container id={'prompt-response-container'}>
          <PromptBuilderResponse prompt={action} />
        </Container>
      )}
    </StyledCard>
    // </Box>
  );
};
export default PromptBuilder;
/**
 * This function handles copying the generated prompt to the clipboard and adding it to the prompt state.
 *
 * @param {string} buildPrompt - The generated prompt.
 * @param {Dispatch<SetStateAction<PromptRequest>>} setPrompt - A function to update the prompt state.
 * @param {Dispatch<SetStateAction<boolean>>} setOpenPromptResponse - A function to close the prompt response modal.
 * @param {NavigateFunction} nav - A function to navigate to the text section.
 */
const handleCopyPromptToClipboardAndAddToInput = async (
  buildPrompt: string,
  setPrompt: Dispatch<SetStateAction<PromptRequest>>,
  setOpenPromptResponse: Dispatch<SetStateAction<boolean>>,
  nav: NavigateFunction,
) => {
  setPrompt(prev => ({ ...prev, text: buildPrompt }));
  await navigator.clipboard.writeText(buildPrompt);
  setOpenPromptResponse(false);
  nav('text');
};
const baseUrl = import.meta.env.VITE_VERTEX_API_URL;
/**
 * This function handles the file upload event.
 * It uploads the file to the server and updates the prompt state with the file data.
 *
 * @param {RefObject<HTMLInputElement | null>} fileInputRef - A ref to the file input element.
 * @param {Dispatch<SetStateAction<PromptRequest>>} setPrompt - A function to update the prompt state.
 * @param {Dispatch<SetStateAction<string>>} setFileName - A function to update the file name state.
 * @param {Dispatch<SetStateAction<boolean>>} setLoading - A function to update the loading state.
 */
export const handleFileUpload = async (
  fileInputRef: RefObject<HTMLInputElement | null>,
  setPrompt: Dispatch<SetStateAction<PromptRequest>>,
  setFileName: Dispatch<SetStateAction<string>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
) => {
  try {
    if (fileInputRef.current) {
      if (fileInputRef.current.files) {
        const file = fileInputRef.current.files[0];
        const contextPath = getContextPath('context-path');
        setLoading(true);
        const resp = await axios.post(
          `${baseUrl}/upload`,
          { file: file, contextPath: contextPath },
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        const { path } = resp.data as { path: string };
        setPrompt(prev => ({ ...prev, fileData: { fileUri: path, mimeType: file.type } }));
        setFileName(file.name);
        return null;
      } else return null;
    } else return null;
  } catch (error) {
    console.error(error);
    return null;
  } finally {
    setLoading(false);
  }
};
