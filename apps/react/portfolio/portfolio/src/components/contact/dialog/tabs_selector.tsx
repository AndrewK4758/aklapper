import { CenteredFlexDiv, SectionTitle } from '@aklapper/react-shared';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import type { ReactElement } from 'react';
import Theme from '../../../styles/themes/theme';

interface TabsSelectorProps {
  tab: number;
  handleSetTab: (tab: number) => void;
}

export default function TabsSelector({ tab, handleSetTab }: TabsSelectorProps): ReactElement {
  return (
    <CenteredFlexDiv as={'section'} id='email-me-title-box' data-testid='email-me-title-box'>
      <Tabs
        variant='fullWidth'
        aria-label='contact-tabs'
        id='contact-tabs'
        data-testid='contact-tabs'
        component={'nav'}
        value={tab}
        onChange={(_, tab) => handleSetTab(tab)}
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
          label={<SectionTitle id='appointment-request-tab-label' variant={'h4'} title={'Calendar'} />}
        />
        <Tab
          key={'email-me-tab'}
          id='email-me-tab'
          data-testid='email-me-tab'
          label={<SectionTitle id='email-me-tab-label' title={'Email'} variant={'h4'} />}
        />
      </Tabs>
    </CenteredFlexDiv>
  );
}
