import { Label } from '@aklapper/react-shared';
import Box, { type BoxProps } from '@mui/material/Box';
// import type { SxProps, Theme } from '@mui/material/styles';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
// import { flexColumnStyles } from '../../../styles/pages-styles';

interface TabsSelectorProps extends Omit<BoxProps, 'id' | 'data-testid'> {
  tab: number;
  handleSetTab: (tab: number) => void;
}

export default function TabsSelector({ tab, handleSetTab, ...props }: TabsSelectorProps) {
  return (
    <Box
      {...props}
      component={'section'}
      id='email-me-title-box'
      data-testid='email-me-title-box'
      sx={{
        border: 4,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
      }}
    >
      <Tabs
        variant='fullWidth'
        aria-label='contact-tabs'
        id='contact-tabs'
        data-testid='contact-tabs'
        component={'nav'}
        key={'contact-tabs'}
        value={tab}
        onChange={(_e, tab) => handleSetTab(tab)}
      >
        <Tab
          key={'appointment-request-tab'}
          id='appointment-request-tab'
          data-testid='appointment-request-tab'
          label={
            <Label
              htmlFor='appointment-request-tab'
              tooltipTitle={'Add to Google Calendar'}
              labelVariant={'h3'}
              labelText={'Appt. Request'}
              placement={'bottom'}
              id='appointment-request-tab-label'
            />
          }
        />
        <Tab
          key={'email-me-tab'}
          id='email-me-tab'
          data-testid='email-me-tab'
          label={
            <Label
              htmlFor='email-me-tab'
              tooltipTitle={'Send Email / Upload Appointment Details'}
              labelVariant={'h3'}
              labelText={'Email Me'}
              placement={'bottom'}
              id='email-me-tab-label'
            />
          }
        />
      </Tabs>
    </Box>
  );
}
