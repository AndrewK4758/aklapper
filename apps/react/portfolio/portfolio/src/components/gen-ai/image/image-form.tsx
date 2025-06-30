import { Label, Text, Waiting } from '@aklapper/react-shared';
import { AspectRatio } from '@aklapper/types';
import { type ImagenConfig } from '@aklapper/vertex-ai';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Input from '@mui/material/Input';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import { useFormik, type FormikProps } from 'formik';
import { type ChangeEvent, type ReactElement } from 'react';
import { Form, useActionData, useNavigation, useOutletContext, useSubmit } from 'react-router';
import * as Yup from 'yup';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import {
  forrmControlLabelStyles,
  genAiGenerateImageButtonBoxSxProps,
  genAiImageDetailsBoxSxProps,
  genAiImageSampleCountRadioSxProps,
  genAiSampleCountTextSxProps,
  genAiSliderInputSlotProps,
  promptBuillderFormBoxSxProps,
  radioGroupStyles,
  sampleCountRadioTextStyles,
  textInputSx,
} from '../../../styles/gen-ai-styles.jsx';
import { buttonSXProps, centerFlex } from '../../../styles/pages-styles.jsx';
import Theme from '../../../styles/themes/theme';
import type { OutletContextProps } from '../../../types/types.js';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import StyledCard from '../../styled/styled_card';
import TextInput from '../../styled/text_input';

const validationSchema = Yup.object({
  prompt: Yup.string().required('The prompt is required'),
  sampleCount: Yup.number().required('Sample Count is required'),
  seed: Yup.number().required('Seed is required'),
  aspectRatio: Yup.string().oneOf(Object.values(AspectRatio)),
});

/**
 * This component renders a form for generating images using the generative AI model.
 * It allows users to input a prompt, select the number of images to generate, choose the aspect ratio, and set a seed value.
 *
 * @returns {ReactElement} The rendered ImageForm component.
 */

const ImageForm = (): ReactElement => {
  const { chatHistory, setChatHistory } = useOutletContext<OutletContextProps>();
  const submit = useSubmit();
  const { state } = useNavigation();
  const pics = useActionData() as string[];

  const lastPrompt = chatHistory[chatHistory.length - 1] ?? null;

  const initialValues: Partial<ImagenConfig> = {
    prompt: lastPrompt ? lastPrompt.prompt : '',
    sampleCount: 1,
    seed: 100,
    aspectRatio: AspectRatio['1:1'],
  };

  const formik = useFormik<Partial<ImagenConfig>>({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: values => submit(values, { encType: 'application/json', relative: 'route', method: 'post' }),
  });

  return (
    <CenteredFlexDiv
      id='image-gen-wrapper'
      sx={{ height: 'fit-content', border: 1, width: '100%', padding: Theme.spacing(4) }}
    >
      <Form
        method='post'
        id='image-form'
        onSubmit={formik.handleSubmit}
        onReset={formik.handleReset}
        style={{ width: '100%', gap: Theme.spacing(4) }}
      >
        <TextInput<Partial<ImagenConfig>>
          id='image-prompt-input'
          formik={formik}
          name={'prompt'}
          label={'Prompt'}
          variant={'outlined'}
          multiline={true}
        />

        <StyledCard sx={{ display: 'flex' }}>
          <Box as={'section'} id='image-form-sample-count-aspect-ratio-box' sx={{ padding: Theme.spacing(4) }}>
            <Box as={'section'} id='image-form-sample-count-box' sx={{ border: 2 }}>
              <Label
                id='image-form-sample-count-label'
                htmlFor='image-form-sample-count-box'
                placement='top'
                tooltipTitle='Select the number of images you would like returned from the prompt'
                labelText='Sample Count'
                labelVariant='h5'
              />
              <RadioGroup
                key={'image-form-sample-count'}
                id='image-form-sample-count'
                onBlur={formik.handleBlur}
                onChange={(e, newValue) => handleFormikValueChange(e.target.name, newValue, formik)}
                onReset={formik.handleReset}
                value={formik.values.sampleCount}
                name={'sampleCount'}
                color='primary'
                sx={{ display: 'flex', flexDirection: 'row' }}
              >
                <FormControlLabel value={1} control={<Radio />} label={<Text variant='h5' children={1} />} />
                <FormControlLabel value={2} control={<Radio />} label={<Text variant='h5' children={2} />} />
                <FormControlLabel value={3} control={<Radio />} label={<Text variant='h5' children={3} />} />
                <FormControlLabel value={4} control={<Radio />} label={<Text variant='h5' children={4} />} />
              </RadioGroup>
            </Box>
            <Box component={'section'} key={'image-form-aspect-ratio-box'} id='image-form-aspect-ratio-box'>
              <Label
                id='image-aspect-ratio-input-label'
                htmlFor='image-aspect-ratio-input'
                placement='top'
                labelText='Aspect Ratio'
                labelVariant='h5'
              />
              <Select
                key={'image-aspect-ratio-input'}
                id='image-aspect-ratio-input'
                rows={2}
                variant='outlined'
                onBlur={formik.handleBlur}
                onChange={formik.handleChange}
                onReset={formik.handleReset}
                name={'aspectRatio'}
                sx={textInputSx}
                value={formik.values.aspectRatio}
              >
                <MenuItem value={AspectRatio['1:1']}>{AspectRatio['1:1']}</MenuItem>
                <MenuItem value={AspectRatio['3:4']}>{AspectRatio['3:4']}</MenuItem>
                <MenuItem value={AspectRatio['4:3']}>{AspectRatio['4:3']}</MenuItem>
                <MenuItem value={AspectRatio['16:9']}>{AspectRatio['16:9']}</MenuItem>
                <MenuItem value={AspectRatio['9:16']}>{AspectRatio['9:16']}</MenuItem>
              </Select>
            </Box>

            <Box component={'section'} key={'image-form-seed-box'} id='image-form-seed-box'>
              <Label id='seed-input-label' htmlFor='seed' placement='top' labelText='Seed' labelVariant='h5' />
              <Box
                as={'section'}
                id='slider-and-input-box'
                sx={{
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <Slider
                  component={'div'}
                  id='seed-slider'
                  name='seed'
                  value={formik.values.seed}
                  onChange={(_, newValue) => handleFormikValueChange('seed', newValue, formik)}
                  aria-labelledby='seed-input'
                  sx={{ flex: '0 1 80%' }}
                />
                <Input
                  id='seed-input'
                  readOnly={true}
                  value={formik.values.seed}
                  onChange={e => handleSliderInputChange(e, formik)}
                  sx={{ flex: '0 1 20%' }}
                  slotProps={genAiSliderInputSlotProps}
                />
              </Box>
            </Box>

            <ButtonGroup id='image-gen-button-box'>
              <Button type='submit' id='gen-image-submit-button'>
                Generate Image
              </Button>
              <Button type='reset' id='gen-image-reset-button'>
                Reset Form
              </Button>
            </ButtonGroup>
          </Box>
        </StyledCard>
      </Form>
      {state === 'submitting' && (
        <Box
          component={'span'}
          key={'image-gen-generating-box'}
          id='image-gen-generating-box'
          sx={{
            ...centerFlex,
            flex: '0 1 50%',
            height: 'fit-content',
          }}
        >
          <Text component={'h4'} variant='h4' children={'Generating'} sx={{ textAlign: 'center' }} />
          <Waiting src={waiting} />
        </Box>
      )}

      <Box
        as={'section'}
        key={'generated-image-wrapper'}
        sx={{
          ...centerFlex,
          flex: '1 0 20%',
          flexWrap: 'wrap',
        }}
      >
        {pics &&
          state !== 'submitting' &&
          pics.map((pic, i) => (
            <img
              key={`generated-image-${i}`}
              src={`data:image/png;base64, ${pic}`}
              alt={`generated from prompt entered ${i}`}
              style={{ zIndex: 100 }}
            />
          ))}
      </Box>
    </CenteredFlexDiv>
  );
};

export default ImageForm;

/**
 * This function handles the seed input change event.
 * It updates the seed value in the Formik state.
 *
 * @param {ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} event - The change event object.
 * @param {FormikProps<Partial<ImagenConfig>>} formik - The Formik props object.
 */

const handleSliderInputChange = (
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  formik: FormikProps<Partial<ImagenConfig>>,
) => {
  formik.setFieldValue('seed', event.target.value === '' ? 0 : Number(event.target.value));
};

/**
 * This function handles the Formik value change event.
 * It updates the corresponding value in the Formik state.
 *
 * @param {string} name - The name of the input field.
 * @param {string | number | number[]} value - The new value of the input field.
 * @param {FormikProps<Partial<ImagenConfig>>} formik - The Formik props object.
 */

const handleFormikValueChange = async (
  name: string,
  value: string | number | number[],
  formik: FormikProps<Partial<ImagenConfig>>,
) => {
  await formik.setFieldValue(name, value);
};
