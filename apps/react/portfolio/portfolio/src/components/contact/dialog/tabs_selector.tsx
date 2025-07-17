import { SectionTitle } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { css } from '@pigment-css/react';
import type { ReactElement } from 'react';
import Theme from '../../../styles/themes/theme.js';

interface TabsSelectorProps {
  tab: number;
  handleSetTab: (tab: number) => void;
}

export default function TabsSelector({ tab, handleSetTab }: TabsSelectorProps): ReactElement {
  return (
    <Box
      as={'section'}
      id='email-me-title-box'
      data-testid='email-me-title-box'
      className={css({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
      })}
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
              overrideThemeStyles={{ color: Theme.palette.primary.dark }}
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
              overrideThemeStyles={{ color: Theme.palette.primary.dark }}
            />
          }
        />
      </Tabs>
    </Box>
  );
}
