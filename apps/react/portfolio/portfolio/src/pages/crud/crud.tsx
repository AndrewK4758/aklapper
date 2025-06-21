import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { ThemeProvider, type SxProps } from '@mui/material/styles';
import { lazy, ReactElement, Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import CrudNavBar from '../../components/crud/nav_bar';
import CrudHeader from '../../components/crud/page_header.js';
import CenteredFlexDiv from '../../components/styled/centered_flexbox';
import CRUD_THEME from '../../styles/themes/crud_theme';

const Search = lazy(() => import('../../components/crud/search/search.js'));

const crudHeaderWrapperSxProps: SxProps = { paddingY: 0, flexDirection: 'row' };

/**
 * This component renders the CRUD (Create, Read, Update, Delete) section of the application.
 * It provides an interface for users to interact with the database, including viewing, adding, updating, and deleting records.
 *
 * @returns {ReactElement} The rendered CRUD component.
 */

export default function Crud(): ReactElement {
  const [searchIsOpen, setSearchIsOpen] = useState<boolean>(false);

  const handleSetSearchClick = () => {
    setSearchIsOpen(!searchIsOpen);
  };

  return (
    <ThemeProvider theme={CRUD_THEME}>
      <Box id='crud-wrapper' borderRadius={1} bgcolor={CRUD_THEME.palette.background.default} width={'100%'}>
        <CenteredFlexDiv id='crud-header-wrapper' sx={crudHeaderWrapperSxProps}>
          <Container disableGutters sx={{ display: 'flex', flexDirection: 'row' }}>
            <CenteredFlexDiv>
              <CrudHeader />
            </CenteredFlexDiv>
            <CenteredFlexDiv sx={{ p: 0, width: '100%' }}>
              <CrudNavBar />
              <Button color='secondary' variant='text' onClick={handleSetSearchClick}>
                {'Search'}
              </Button>
            </CenteredFlexDiv>
          </Container>
        </CenteredFlexDiv>

        <Suspense fallback={<Waiting src={waiting} />}>
          {searchIsOpen && <Search setOpen={handleSetSearchClick} />}
        </Suspense>

        <Box id={`crud-app-wrapper`} paddingX={2}>
          <Suspense fallback={<Waiting src={waiting} />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
