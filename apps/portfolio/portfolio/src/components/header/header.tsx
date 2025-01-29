import { Label } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Toolbar from '@mui/material/Toolbar';
import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router';
import { buttonSXProps } from '../../styles/header-styles';
import Connect from './contact/contact';
import Theme from '../../styles/theme';

/**
 * This component renders the header section of the application, which includes social media links and an email contact form.
 *
 * @returns {JSX.Element} The rendered Header component.
 */

const Header = (): JSX.Element => {
  const [openMenu, setOpenMenu] = useState<boolean>(false);
  const nav = useNavigate();

  return (
    <AppBar
      elevation={4}
      component={'nav'}
      key={'navbar-appbar'}
      id="navbar-appbar"
      data-testid="navbar-appbar"
      enableColorOnDark={true}
      position="fixed"
    >
      <Toolbar disableGutters component={'section'} id="navbar-toolbar" data-testid="navbar-toolbar">
        <ButtonGroup fullWidth={true} variant="text" color="inherit" size="medium">
          <Button
            id="home-button"
            data-testid="home-button"
            sx={buttonSXProps}
            onClick={() => {
              nav('/');
              window.scrollTo({ behavior: 'smooth', top: 0 });
            }}
          >
            <Label
              tooltipTitle={'HOME DESCRIPTION'}
              labelVariant={'h2'}
              labelText={'Home'}
              placement={'bottom'}
              labelTextsx={{
                fontSize: '2.5rem',
                width: '100%',
                [Theme.breakpoints.down('lg')]: { fontSize: '1rem' }
              }}
            />
          </Button>

          <Button id="games-button" data-testid="games-button" onClick={() => nav('games')} sx={buttonSXProps}>
            <Label
              tooltipTitle={'GAME DESCRIPTION'}
              labelVariant={'h2'}
              labelText={'Games'}
              placement={'bottom'}
              labelTextsx={{ fontSize: '2.5rem', [Theme.breakpoints.down('lg')]: { fontSize: '1rem' } }}
            />
          </Button>

          <Button id="crud-button" data-testid="crud-button" onClick={() => nav('crud')} sx={buttonSXProps}>
            <Label
              tooltipTitle={'CRUD DESCRIPTION'}
              labelVariant={'h2'}
              labelText={'CRUD'}
              placement={'bottom'}
              labelTextsx={{ fontSize: '2.5rem', [Theme.breakpoints.down('lg')]: { fontSize: '1rem' } }}
            />
          </Button>

          <Button id="gen-ai-button" data-testid="gen-ai-button" onClick={() => nav('gen-ai')} sx={buttonSXProps}>
            <Label
              tooltipTitle={'GEN-AI DESCRIPTION'}
              labelVariant={'h2'}
              labelText={'Gen-AI'}
              placement={'bottom'}
              labelTextsx={{ fontSize: '2.5rem', [Theme.breakpoints.down('lg')]: { fontSize: '1rem' } }}
            />
          </Button>

          <Button
            autoFocus={true}
            id="contact-menu-button"
            data-testid="contact-menu-button"
            onClick={() => setOpenMenu(true)}
            sx={buttonSXProps}
          >
            <Label
              tooltipTitle={'CONTACT DESCRIPTION'}
              labelVariant={'h2'}
              labelText={'Contact'}
              placement={'bottom'}
              labelTextsx={{ fontSize: '2.5rem', [Theme.breakpoints.down('lg')]: { fontSize: '1rem' } }}
            />
          </Button>
        </ButtonGroup>
      </Toolbar>
      <Connect openMenu={openMenu} setOpenMenu={setOpenMenu} />
    </AppBar>
  );
};

export default Header;
