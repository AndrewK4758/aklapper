import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import { useState, type Dispatch, type JSX, type SetStateAction, type SyntheticEvent } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { buttonSXProps, menuOpenIconSxProps, socialMediaLinksWrapper } from '../../styles/header-styles';
import Connect from './connect/connect';
import { Label } from '@aklapper/react-shared';

/**
 * This component renders the header section of the application, which includes social media links and an email contact form.
 *
 * @returns {JSX.Element} The rendered Header component.
 */

const Header = (): JSX.Element => {
  const [tab, setTab] = useState<number>(0);
  const [openMenu, setOpenMenu] = useState<boolean>(false);
  const nav = useNavigate();

  return (
    <Box
      component={'div'}
      key={'navbar-wrapper'}
      id="navbar-wrapper"
      data-testid="navbar-wrapper"
      sx={socialMediaLinksWrapper}
    >
      <AppBar
        elevation={4}
        //primary color generator
        component={'nav'}
        key={'navbar-appbar'}
        id="navbar-appbar"
        data-testid="navbar-appbar"
        sx={{ height: '8vh' }}
      >
        <Toolbar
          component={'section'}
          id="navbar-toolbar"
          data-testid="navbar-toolbar"
          sx={{ display: 'flex', flexDirection: 'row', height: '100%' }}
        >
          <Tabs
            textColor="inherit"
            value={tab}
            onChange={(tab: SyntheticEvent<Element, Event>, idx: number) =>
              handleTabChange((tab.currentTarget.textContent as string).toLowerCase(), idx, setTab, nav)
            }
            variant="fullWidth"
            TabIndicatorProps={{
              sx: { background: '#FFFFFF' }
            }}
            sx={{ flex: '100%' }}
          >
            <Tab
              sx={{ ...buttonSXProps }}
              label={
                <Label
                  tooltipTitle={'HOME DESCRIPTION'}
                  labelVariant={'h2'}
                  labelText={'Home'}
                  placement={'top'}
                  sx={{ fontSize: '2.5rem' }}
                />
              }
              id="home-button"
              data-testid="home-button"
              onClick={() => window.scrollTo({ behavior: 'smooth', top: 0 })}
            />

            <Tab
              label={
                <Label
                  tooltipTitle={'GAME DESCRIPTION'}
                  labelVariant={'h2'}
                  labelText={'Games'}
                  placement={'top'}
                  sx={{ fontSize: '2.5rem' }}
                />
              }
              id="games-button"
              data-testid="games-button"
              sx={buttonSXProps}
            />

            <Tab
              label={
                <Label
                  tooltipTitle={'CRUD DESCRIPTION'}
                  labelVariant={'h2'}
                  labelText={'CRUD'}
                  placement={'top'}
                  sx={{ fontSize: '2.5rem' }}
                />
              }
              id="crud-button"
              data-testid="crud-button"
              sx={buttonSXProps}
            />

            <Tab
              label={
                <Label
                  tooltipTitle={'GEN-AI DESCRIPTION'}
                  labelVariant={'h2'}
                  labelText={'Gen-AI'}
                  placement={'top'}
                  sx={{ fontSize: '2.5rem' }}
                />
              }
              id="gen-ai-button"
              data-testid="gen-ai-button"
              sx={buttonSXProps}
            />

            <Tab
              autoFocus={true}
              label={
                <Label
                  tooltipTitle={'CONTACT DESCRIPTION'}
                  labelVariant={'h2'}
                  labelText={'Contact'}
                  placement={'top'}
                  sx={{ fontSize: '2.5rem' }}
                />
              }
              id="contact-menu-button"
              data-testid="contact-menu-button"
              icon={<MenuOpenIcon sx={menuOpenIconSxProps} />}
              iconPosition="end"
              onClick={() => setOpenMenu(true)}
              sx={buttonSXProps}
            />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Box component={'div'} key={'connect-wrapper'} id={'connect-wrapper'} flex={1}>
        <Connect openMenu={openMenu} setOpenMenu={setOpenMenu} />
      </Box>
    </Box>
  );
};

export default Header;

const handleTabChange = (tab: string, idx: number, setTab: Dispatch<SetStateAction<number>>, nav: NavigateFunction) => {
  console.log(tab);
  if (tab === 'contact') return;
  else {
    setTab(idx);
    tab[0] === 'h' ? nav('/') : nav(tab);
  }
};
