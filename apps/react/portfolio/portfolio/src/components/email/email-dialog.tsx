import { Waiting } from '@aklapper/react-shared';
// import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import { lazy, Suspense, useState } from 'react';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
// import { flexColumnStyles } from '../../styles/pages-styles.jsx';
// import StyledRootComponentWrapper from '../styled/styled_root_wrapper';
import DialogLayout from './dialog/dialog';
import TabsSelector from './dialog/tabs_selector';

//TODO - Add multi language selector for the localization provider and my text content

const GoogleCalendar = lazy(() => import('./google-calendar/google-calendar.jsx'));
const EmailForm = lazy(() => import('./email-form/email-form.jsx'));

interface EmailDialogProps {
  isOpen: boolean;
  handleIsOpen: () => void;
}

const EmailDialog = ({ isOpen, handleIsOpen }: EmailDialogProps) => {
  const [tab, setTab] = useState(0);

  const handleSetTab = (idx: number) => {
    setTab(idx);
  };

  return (
    <DialogLayout isOpen={isOpen} tab={tab} handleSetTab={handleSetTab}>
      <TabsSelector tab={tab} handleSetTab={handleSetTab} />
      {/* <StyledRootComponentWrapper
        component={'section'}
        id='calendar-and-email-section'
        data-testid='calendar-and-email-section'
        sx={{ flex: 4 }}
      > */}
      <Suspense fallback={<Waiting src={waiting} />}>
        {tab === 0 && <GoogleCalendar setOpen={handleIsOpen} />}
        {tab === 1 && <EmailForm setOpen={handleIsOpen} />}
      </Suspense>
      {/* </StyledRootComponentWrapper> */}
      <DialogActions
        key={'email-me-button-box'}
        id='email-me-button-box'
        data-testid='email-me-button-box'
        sx={{ paddingX: 4, height: 'fit-content' }}
      >
        <Button type='button' id='close-email-me-button' data-testid='close-email-me-button' onClick={handleIsOpen}>
          Close
        </Button>
      </DialogActions>
    </DialogLayout>
  );
};

export default EmailDialog;
