import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import Button from '@mui/material/Button';
import type { SxProp } from '@pigment-css/react';
import { lazy, ReactElement, Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import CrudNavBar from '../../components/crud/nav_bar';
import CrudHeader from '../../components/crud/page_header.js';
import CenteredFlexDiv from '../../components/styled/centered_flexbox';
import CRUD_THEME from '../../styles/themes/crud_theme';
import Theme from '../../styles/themes/theme';

const Search = lazy(() => import('../../components/crud/search/search'));

const crudHeaderWrapperSxProps: SxProp = {
  flex: '0 1 auto',
  paddingTop: 0,
  paddingBottom: 0,
  backgroundColor: Theme.palette.background.paper,
  borderRadius: Theme.shape.borderRadius,
};

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
    <Box
      id='crud-wrapper'
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: Theme.spacing(4),
        borderRadius: CRUD_THEME.shape.borderRadius,
        width: '100%',
        backgroundColor: 'transparent',
      }}
    >
      <CenteredFlexDiv sx={crudHeaderWrapperSxProps}>
        <Container disableGutters sx={{ display: 'flex', flexDirection: 'row' }}>
          <CenteredFlexDiv>
            <CrudHeader />
          </CenteredFlexDiv>

          <CenteredFlexDiv sx={{ padding: 0, width: '100%' }}>
            <CrudNavBar />
            <Button onClick={handleSetSearchClick} sx={{ color: CRUD_THEME.palette.secondary.main }}>
              {'Search'}
            </Button>
          </CenteredFlexDiv>
        </Container>
      </CenteredFlexDiv>

      <Suspense fallback={<Waiting src={waiting} />}>
        <CenteredFlexDiv sx={crudHeaderWrapperSxProps}>
          {searchIsOpen && <Search setOpen={handleSetSearchClick} />}
        </CenteredFlexDiv>
      </Suspense>

      <Box id={`crud-app-wrapper`} sx={{ width: '100%' }}>
        <Suspense fallback={<Waiting src={waiting} />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  );
}
