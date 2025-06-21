import Step from '@mui/material/Step';
import StepButton from '@mui/material/StepButton';
import Stepper from '@mui/material/Stepper';
import type { CompletedState } from '../../../types/types';

interface AddEntryStepperProps {
  activeStep: number;
  addEntrySteps: string[];
  handleStep: (step: number) => void;
  completed: CompletedState;
}

export default function AddEntryStepper({ activeStep, addEntrySteps, completed, handleStep }: AddEntryStepperProps) {
  return (
    <Stepper nonLinear activeStep={activeStep}>
      {addEntrySteps.map((step, index) => (
        <Step key={step} completed={completed[index]}>
          <StepButton color='inherit' onClick={() => handleStep(index)}>
            {step}
          </StepButton>
        </Step>
      ))}
    </Stepper>
  );
}
