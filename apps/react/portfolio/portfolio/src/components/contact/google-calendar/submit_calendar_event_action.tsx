import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useContext } from 'react';
import { type GoogleUserContextProps, GoogleUserContext } from '../../../contexts/contact-context.js';
import AnimatedBorderBox from '../../styled/animated_border_box.js';

export default function SubmitCalendarEventAction() {
  const { GoogleUserContextValues } = useContext<GoogleUserContextProps>(GoogleUserContext);
  return (
    <Box component={'section'} id='google-calendar-submit-box' data-testid='google-calendar-submit-box'>
      {GoogleUserContextValues.name.length ? (
        <AnimatedBorderBox>
          <Button type='submit' id='calendar-submit-buttom' data-testid='calendar-submit-buttom'>
            Submit Event
          </Button>
        </AnimatedBorderBox>
      ) : null}
    </Box>
  );
}
