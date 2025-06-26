import DialogContent from '@mui/material/DialogContent';
import { Decimal } from 'decimal.js';
import { useFormik } from 'formik';
import { useState } from 'react';
import { Form, useNavigate } from 'react-router';
import * as Yup from 'yup';
import { addEntrySteps } from '../../../pages/static/crud-text';
import handleSubmitNewEntry from '../../../services/actions/crud-actions/submit-new-entry-action.jsx';
import type { CompletedState, NewEntry } from '../../../types/types';
import AddEntryFormActions from './form_actions';
import AddEntryFormInputs from './inputs';
import AddEntryStepper from './stepper';
import AddEntryStepperButtons from './stepper_buttons';

const initialValues: NewEntry = {
  artist: {
    name: '',
  },
  album: {
    title: '',
  },
  track: {
    name: '',
    composer: '',
    bytes: 0,
    milliseconds: 0,
    media_type_id: 0,
    genre_id: 0,
    unit_price: new Decimal(0.0),
  },
};

const artistVal = Yup.object({
  name: Yup.string().max(200, 'Must be less than 200 characters').required('Required'),
});

const albumVal = Yup.object({
  title: Yup.string().max(160, 'Must be less than 160 characters').required('Required'),
});

const trackVal = Yup.object({
  name: Yup.string().max(160, 'Must be less than 160 characters').required('Required'),
  composer: Yup.string().max(220, 'Must be less than 160 characters').required('Required'),
  bytes: Yup.number()
    .required('Enter size of file in bytes')
    .positive('Enter size of file in bytes')
    .lessThan(2147483647, 'must be less than 32bit signed integer 2147483647'),
  milliseconds: Yup.number()
    .required('Enter length of track in milliseconds')
    .positive('Enter length of track in milliseconds')
    .lessThan(2147483647, 'must be less than 32bit signed integer 2147483647')
    .required('Enter length of track in milliseconds'),
  media_type_id: Yup.number().required('Enter media type number').positive('Enter media type number'),
  genre_id: Yup.number().required('Enter genre ID number').positive('Enter genre ID number'),
  unit_price: Yup.number().required('Enter unit price in form 0.00').positive('Enter unit price in form 0.00'),
});

const validationSchema = Yup.object({
  artist: artistVal,
  album: albumVal,
  track: trackVal,
});

export default function AddEntryForm() {
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<CompletedState>({});
  const nav = useNavigate();

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values, { setSubmitting }) => await handleSubmitNewEntry(values, setSubmitting, nav),
    onReset: () => handleReset(),
    validateOnMount: false,
  });

  const totalSteps = () => {
    return addEntrySteps.length;
  };

  const completedSteps = () => {
    return Object.keys(completed).length;
  };

  const isLastStep = () => {
    return activeStep === totalSteps() - 1;
  };

  const allStepsCompleted = () => {
    return completedSteps() === totalSteps();
  };

  const handleNext = () => {
    const newActiveStep =
      isLastStep() && !allStepsCompleted() ? addEntrySteps.findIndex((_step, i) => !(i in completed)) : activeStep + 1;
    setActiveStep(newActiveStep);
  };

  const handleBack = () => {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  };

  const handleStep = (step: number) => () => {
    setActiveStep(step);
  };

  const handleComplete = () => {
    setCompleted({
      ...completed,
      [activeStep]: true,
    });
    handleNext();
  };

  const handleReset = () => {
    setActiveStep(0);
    setCompleted({});
  };

  return (
    <Form method='post' encType='text/plain' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <DialogContent id={'add-entry-dialog-content'}>
        <AddEntryFormInputs activeStep={activeStep} formik={formik} completed={completed} />
        <AddEntryStepper
          activeStep={activeStep}
          addEntrySteps={addEntrySteps}
          completed={completed}
          handleStep={handleStep}
        />
        <AddEntryStepperButtons
          activeStep={activeStep}
          completed={completed}
          allStepsCompleted={allStepsCompleted}
          completedSteps={completedSteps}
          handleBack={handleBack}
          handleComplete={handleComplete}
          handleNext={handleNext}
          totalSteps={totalSteps}
        />
      </DialogContent>
      <AddEntryFormActions formik={formik} allStepsCompleted={allStepsCompleted} />
    </Form>
  );
}
