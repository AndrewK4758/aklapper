import { FormikValidationError, Label, Text, Waiting } from '@aklapper/react-shared';
import { AspectRatio } from '@aklapper/types';
import { type ImagenConfig } from '@aklapper/vertex-ai';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import Input from '@mui/material/Input';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import { useFormik, type FormikProps } from 'formik';
import { type ChangeEvent, type JSX } from 'react';
import { Form, useActionData, useNavigation, useOutletContext, useSubmit } from 'react-router';
import * as Yup from 'yup';
import waiting from '../../../assets/swirly-dots-to-chrome.webp';
import { crudHeaderTextSxProps } from '../../../styles/crud-styles.jsx';
import {
  forrmControlLabelStyles,
  genAiGenerateImageButtonBoxSxProps,
  genAiImageDetailsBoxSxProps,
  genAiImageHeaderBoxSxProps,
  genAiImageSampleCountRadioSxProps,
  genAiSampleCountTextSxProps,
  genAiSliderInputSlotProps,
  helperTextSx,
  labelSx,
  promptBuillderFormBoxSxProps,
  radioGroupStyles,
  sampleCountRadioTextStyles,
  textInputSx,
  tooltipSx,
} from '../../../styles/gen-ai-styles.jsx';
import { buttonSXProps, centerFlex, pagesTitleSx } from '../../../styles/pages-styles.jsx';
import type { OutletContextProps } from '../../../types/types.tsx';
import {
  imageGenDescription,
  promptTooltipText,
  sampleCountTooltipText,
  seedTooltipText,
} from '../static/image-text.jsx';

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
 * @returns {JSX.Element} The rendered ImageForm component.
 */

const ImageForm = (): JSX.Element => {
  const { prompt } = useOutletContext<OutletContextProps>();
  const submit = useSubmit();
  const { state } = useNavigation();
  const pics = useActionData() as string[];

  const initialValues: Partial<ImagenConfig> = {
    prompt: prompt.text === null ? '' : prompt.text,
    sampleCount: 1,
    seed: 100,
    aspectRatio: AspectRatio['1:1'],
  };

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: values => submit(values, { encType: 'application/json', relative: 'route', method: 'post' }),
  });

  return (
    <Box component={'div'} key={'image-gen-wrapper'} id='image-gen-wrapper' height={'fit-content'} minHeight={'50vh'}>
      <Container component={'section'} key={'image-gen'} id='image-gen' sx={promptBuillderFormBoxSxProps}>
        <Box
          component={'div'}
          key={'image-gen-header-wrapper'}
          id='image-gen-header-wrapper'
          sx={genAiImageHeaderBoxSxProps}
        >
          <Text component={'h2'} titleVariant='h2' titleText='Image Generator' sx={pagesTitleSx} />
          <Text component={'p'} titleVariant='body1' titleText={imageGenDescription} sx={crudHeaderTextSxProps} />
        </Box>

        <Form
          method='post'
          key={'image-form'}
          id='image-form'
          onSubmit={formik.handleSubmit}
          onReset={formik.handleReset}
        >
          <Box component={'section'} key={'i'} id='image-form-prompt-box'>
            <Label
              id='image-form-prompt-label'
              htmlFor='image-prompt-input'
              placement='top'
              labelText='Prompt'
              labelVariant='h5'
              tooltipTitle={promptTooltipText}
              tooltipSx={tooltipSx}
              labelTextSx={labelSx}
            />
            <TextField
              key={'image-prompt-input'}
              id='image-prompt-input'
              component={'span'}
              multiline={true}
              focused={true}
              fullWidth={true}
              placeholder='The picture you want the AI to create'
              variant='outlined'
              onBlur={formik.handleBlur}
              onChange={formik.handleChange}
              onReset={formik.handleReset}
              name={'prompt'}
              sx={textInputSx}
              value={formik.values.prompt}
            />
            <FormikValidationError<Partial<ImagenConfig>>
              formik={formik}
              elementName={'prompt'}
              helperTextSx={helperTextSx}
            />
          </Box>

          <Box
            component={'section'}
            key={'image-form-sample-count-aspect-ratio-box'}
            id='image-form-sample-count-aspect-ratio-box'
            sx={genAiImageDetailsBoxSxProps}
          >
            <Box component={'section'} key={'image-form-sample-count-box'} id='image-form-sample-count-box'>
              <Label
                id='image-form-sample-count-label'
                htmlFor='image-form-sample-count-box'
                placement='top'
                labelText='Sample Count'
                labelVariant='h5'
                tooltipTitle={sampleCountTooltipText}
                tooltipSx={tooltipSx}
                labelTextSx={labelSx}
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
                sx={radioGroupStyles}
              >
                <FormControlLabel
                  value={1}
                  control={<Radio sx={genAiImageSampleCountRadioSxProps} />}
                  label={
                    <Box sx={sampleCountRadioTextStyles}>
                      <Text component={'h4'} titleVariant='h4' titleText={1} sx={genAiSampleCountTextSxProps} />
                    </Box>
                  }
                  sx={forrmControlLabelStyles}
                />

                <FormControlLabel
                  value={2}
                  control={<Radio sx={genAiImageSampleCountRadioSxProps} />}
                  label={
                    <Box sx={sampleCountRadioTextStyles}>
                      <Text component={'h4'} titleVariant='h4' titleText={2} sx={genAiSampleCountTextSxProps} />
                    </Box>
                  }
                  sx={forrmControlLabelStyles}
                />

                <FormControlLabel
                  value={3}
                  control={<Radio sx={genAiImageSampleCountRadioSxProps} />}
                  label={
                    <Box sx={sampleCountRadioTextStyles}>
                      <Text component={'h4'} titleVariant='h4' titleText={3} sx={genAiSampleCountTextSxProps} />
                    </Box>
                  }
                  sx={forrmControlLabelStyles}
                />
                <FormControlLabel
                  value={4}
                  control={<Radio sx={genAiImageSampleCountRadioSxProps} />}
                  label={
                    <Box sx={sampleCountRadioTextStyles}>
                      <Text component={'h4'} titleVariant='h4' titleText={4} sx={genAiSampleCountTextSxProps} />
                    </Box>
                  }
                  sx={forrmControlLabelStyles}
                />
              </RadioGroup>
            </Box>
            <Box component={'section'} key={'image-form-aspect-ratio-box'} id='image-form-aspect-ratio-box'>
              <Label
                id='image-aspect-ratio-input-label'
                htmlFor='image-aspect-ratio-input'
                placement='top'
                labelText='Aspect Ratio'
                labelVariant='h5'
                tooltipTitle={'Select the Aspect Ratio of the output image.'}
                tooltipSx={tooltipSx}
                labelTextSx={labelSx}
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
          </Box>
          <Box component={'section'} key={'image-form-seed-box'} id='image-form-seed-box'>
            <Label
              id='seed-input-label'
              htmlFor='seed'
              placement='top'
              labelText='Seed'
              labelVariant='h5'
              tooltipTitle={seedTooltipText}
              tooltipSx={tooltipSx}
              labelTextSx={labelSx}
            />
            <Box
              component={'section'}
              key={'slider-and-input-box'}
              id='slider-and-input-box'
              display={'flex'}
              gap={4}
              alignItems={'center'}
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
                value={formik.values.seed}
                onChange={e => handleSliderInputChange(e, formik)}
                sx={{ flex: '0 1 20%' }}
                slotProps={genAiSliderInputSlotProps}
              />
            </Box>
          </Box>

          <Box
            component={'section'}
            key={'image-gen-button-or-generating-box'}
            id='image-gen-button-or-generating-box'
            sx={centerFlex}
          >
            {state !== 'submitting' ? (
              <Box
                component={'span'}
                key={'image-gen-button-box'}
                id='image-gen-button-box'
                sx={genAiGenerateImageButtonBoxSxProps}
              >
                <Button type='submit' key={'gen-image-button'} id='gen-image-button' sx={buttonSXProps}>
                  Generate Image
                </Button>
              </Box>
            ) : (
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
                <Text component={'h4'} titleVariant='h4' titleText={'Generating'} sx={{ textAlign: 'center' }} />
                <Waiting src={waiting} />
              </Box>
            )}
          </Box>
        </Form>
      </Container>
      <Box
        component={'section'}
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
    </Box>
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
