import { Label } from '@aklapper/react-shared';
// import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import ButtonGroup, { type ButtonGroupProps } from '@mui/material/ButtonGroup';
// import Toolbar from '@mui/material/Toolbar';
import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router';
import { headerLabelSxProps } from '../../styles/header-styles.jsx';
import { buttonSXProps } from '../../styles/pages-styles.js';
import Contact from './contact/contact.jsx';

/**
 * This component renders the header section of the application, which includes social media links and an email contact form.
 *
 * @returns {JSX.Element} The rendered Header component.
 */

const Header = ({ ...props }: ButtonGroupProps): JSX.Element => {
  const [openContact, setOpenContact] = useState<boolean>(false);
  const nav = useNavigate();

  return (
    // <AppBar
    //   elevation={4}
    //   component={'nav'}
    //   key={'navbar-appbar'}
    //   id='navbar-appbar'
    //   data-testid='navbar-appbar'
    //   enableColorOnDark={true}
    //   position='fixed'
    // >
    //   <Toolbar component={'div'} id='navbar-toolbar' data-testid='navbar-toolbar'>
    <>
      <ButtonGroup
        {...props}
        id='navbar-button-group'
        component={'section'}
        fullWidth={true}
        variant='text'
        color='inherit'
        size='medium'
        sx={{
          '& .MuiButtonGroup-grouped': {
            borderColor: 'inherit',
          },
        }}
      >
        <Button
          id='home-button'
          data-testid='home-button'
          sx={buttonSXProps}
          onClick={() => {
            nav('/');
            window.scrollTo({ behavior: 'smooth', top: 0 });
          }}
        >
          <Label
            id='home-button-label'
            htmlFor='home-button'
            tooltipTitle={'HOME DESCRIPTION'}
            labelVariant={'h2'}
            labelText={'Home'}
            placement={'bottom'}
            labelTextSx={headerLabelSxProps}
          />
        </Button>

        <Button id='games-button' data-testid='games-button' onClick={() => nav('games')} sx={buttonSXProps}>
          <Label
            id='games-button-label'
            htmlFor='games-button'
            tooltipTitle={'GAME DESCRIPTION'}
            labelVariant={'h2'}
            labelText={'Games'}
            placement={'bottom'}
            labelTextSx={headerLabelSxProps}
          />
        </Button>

        <Button id='crud-button' data-testid='crud-button' onClick={() => nav('crud')} sx={buttonSXProps}>
          <Label
            id='crud-button-label'
            htmlFor='crud-button'
            tooltipTitle={'CRUD DESCRIPTION'}
            labelVariant={'h2'}
            labelText={'CRUD'}
            placement={'bottom'}
            labelTextSx={headerLabelSxProps}
          />
        </Button>

        <Button id='gen-ai-button' data-testid='gen-ai-button' onClick={() => nav('gen-ai')} sx={buttonSXProps}>
          <Label
            id='gen-ai-button-label'
            htmlFor='gen-ai-button'
            tooltipTitle={'GEN-AI DESCRIPTION'}
            labelVariant={'h2'}
            labelText={'Gen-AI'}
            placement={'bottom'}
            labelTextSx={headerLabelSxProps}
          />
        </Button>

        <Button
          autoFocus={true}
          id='contact-button'
          data-testid='contact-menu-button'
          onClick={() => setOpenContact(true)}
          sx={buttonSXProps}
        >
          <Label
            id='contact-button-label'
            htmlFor='contact-button'
            tooltipTitle={'CONTACT DESCRIPTION'}
            labelVariant={'h2'}
            labelText={'Contact'}
            placement={'bottom'}
            labelTextSx={headerLabelSxProps}
          />
        </Button>
      </ButtonGroup>
      {/* // </Toolbar> */}
      {/* // </AppBar> */}
      <Contact openContact={openContact} setOpenContact={setOpenContact} />
    </>
  );
};

export default Header;
