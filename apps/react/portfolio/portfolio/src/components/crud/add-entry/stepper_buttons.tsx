import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { addEntrySteps } from '../../../pages/static/crud-text';
import type { CompletedState } from '../../../types/types';

interface AddEntryStepperButtonsProps {
  activeStep: number;
  completed: CompletedState;
  allStepsCompleted: () => boolean;
  completedSteps: () => number;
  handleBack: () => void;
  handleComplete: () => void;
  handleNext: () => void;
  totalSteps: () => number;
}

export default function AddEntryStepperButtons({
  activeStep,
  completed,
  allStepsCompleted,
  completedSteps,
  handleBack,
  handleComplete,
  handleNext,
  totalSteps,
}: AddEntryStepperButtonsProps) {
  return (
    <Box>
      {allStepsCompleted() ? (
        <Text variant='body1' children={'All steps completed - Please Submit Entry to save'} />
      ) : (
        <>
          <Typography color='textSecondary'>Step {activeStep + 1}</Typography>
          <Box>
            <Button color='primary' disabled={activeStep === 0} onClick={handleBack}>
              Back
            </Button>
            <Box flex={'1 1 auto'} />
            <Button onClick={handleNext}>Next</Button>
            {activeStep !== addEntrySteps.length &&
              (completed[activeStep] ? (
                <Typography variant='caption' sx={{ display: 'inline-block' }}>
                  Step {activeStep + 1} already completed
                </Typography>
              ) : (
                <Button onClick={handleComplete}>
                  {completedSteps() === totalSteps() - 1 ? 'Finish' : 'Complete Step'}
                </Button>
              ))}
          </Box>
        </>
      )}
    </Box>
  );
}
