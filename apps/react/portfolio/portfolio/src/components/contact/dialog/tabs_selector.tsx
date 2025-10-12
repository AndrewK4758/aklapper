import { SectionTitle } from '@aklapper/react-shared';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { type ReactElement } from 'react';

interface TabsSelectorProps {
  tab: number;
  handleSetTab: (tab: number) => void;
}

export default function TabsSelector({ tab, handleSetTab }: TabsSelectorProps): ReactElement {
  return (
    <Tabs
      variant='fullWidth'
      aria-label='contact-tabs'
      id='contact-tabs'
      data-testid='contact-tabs'
      component={'nav'}
      value={tab}
      onChange={(_, tab) => handleSetTab(tab)}
    >
      <Tab
        key={'appointment-request-tab'}
        id='appointment-request-tab'
        data-testid='appointment-request-tab'
        label={<SectionTitle id='appointment-request-tab-label' variant={'h5'} title={'Calendar'} />}
      />
      <Tab
        key={'email-me-tab'}
        id='email-me-tab'
        data-testid='email-me-tab'
        label={<SectionTitle id='email-me-tab-label' title={'Email'} variant={'h5'} />}
      />
    </Tabs>
  );
}
