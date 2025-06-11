import Box from '@mui/material/Box';
import { useState, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import Contact from '../header/contact/contact';
import StyledRootComponentWrapper from '../styled/layout_root_wrapper';

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {ReactElement} The rendered Layout component.
 */

export default function Layout(): ReactElement {
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);

  const handleOpenContact = () => {
    setIsContactMenuOpen(!isContactMenuOpen);
  };

  console.log(isContactMenuOpen);

  return (
    <StyledRootComponentWrapper>
      <Box component={'div'} width={'100%'} display={'flex'} alignItems={'center'} border={'3px solid blue'}>
        <Box id='contact menu box' flex={'0 1 100%'} border={'3px solid yellow'}>
          {isContactMenuOpen && (
            <Contact
              id='collapse 1'
              orientation='horizontal'
              sx={{
                border: '3px solid green',
                width: '100%',
                '& .MuiCollapse-wrapperInner': { width: '100%', border: '3px solid pink' },
              }}
              isVisible={isContactMenuOpen}
              setIsVisible={handleOpenContact}
            />
          )}
        </Box>
        <Box
          component={'div'}
          sx={{
            flex: '1 0 64px',
            border: '3px solid red',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            height='64px'
            viewBox='0 -960 960 960'
            width='64px'
            fill='#e3e3e3'
            onClick={handleOpenContact}
            style={{ cursor: 'pointer' }}
          >
            <path d='M435-329v-303L283-480l152 151ZM177-104q-30.75 0-51.87-21.13Q104-146.25 104-177v-606q0-30.75 21.13-51.88Q146.25-856 177-856h606q30.75 0 51.88 21.12Q856-813.75 856-783v606q0 30.75-21.12 51.87Q813.75-104 783-104H177Zm459-73h147v-606H636v606Zm-73 0v-606H177v606h386Zm73 0h147-147Z' />
          </svg>
        </Box>
      </Box>

      <Outlet />
    </StyledRootComponentWrapper>
  );
}
