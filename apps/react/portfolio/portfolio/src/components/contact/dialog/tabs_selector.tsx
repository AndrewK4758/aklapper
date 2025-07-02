import { SectionTitle } from '@aklapper/react-shared';
import Box, { type BoxProps } from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import type { ReactElement } from 'react';
import Theme from '../../../styles/themes/theme.js';

interface TabsSelectorProps extends Omit<BoxProps, 'id' | 'data-testid'> {
  tab: number;
  handleSetTab: (tab: number) => void;
}

export default function TabsSelector({ tab, handleSetTab, ...props }: TabsSelectorProps): ReactElement<BoxProps> {
  return (
    <Box
      {...props}
      component={'section'}
      id='email-me-title-box'
      data-testid='email-me-title-box'
      sx={{
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
        slotProps={{
          indicator: {
            sx: {
              backgroundColor: Theme.palette.primary.dark,
            },
          },
        }}
      >
        <Tab
          key={'appointment-request-tab'}
          id='appointment-request-tab'
          data-testid='appointment-request-tab'
          label={
            <SectionTitle
              id='appointment-request-tab-label'
              variant={'h4'}
              title={'Appt. Request'}
              placement={'bottom'}
              style={{ color: Theme.palette.primary.dark }}
            />
          }
        />
        <Tab
          key={'email-me-tab'}
          id='email-me-tab'
          data-testid='email-me-tab'
          label={
            <SectionTitle
              id='email-me-tab-label'
              title={'Email Me'}
              variant={'h4'}
              placement={'bottom'}
              style={{ color: Theme.palette.primary.dark }}
            />
          }
        />
      </Tabs>
    </Box>
  );
}
