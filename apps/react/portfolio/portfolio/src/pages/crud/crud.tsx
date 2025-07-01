import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import type { SxProp } from '@pigment-css/react';
import { lazy, ReactElement, Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import CrudNavBar from '../../components/crud/nav_bar';
import CrudHeader from '../../components/crud/page_header.js';
import CenteredFlexDiv from '../../components/styled/centered_flexbox';
import Theme from '../../styles/themes/theme';

const Search = lazy(() => import('../../components/crud/search/search'));

const crudHeaderWrapperSxProps: SxProp = {
  display: 'flex',
  padding: `${Theme.spacing(4)} ${Theme.spacing(8)}`,
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
        borderRadius: Theme.shape.borderRadius,
      }}
    >
      <Box sx={crudHeaderWrapperSxProps}>
        <Divider flexItem orientation='vertical' />
        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
          <CenteredFlexDiv>
            <CrudHeader />
          </CenteredFlexDiv>
          <CenteredFlexDiv sx={{ padding: 0, width: '100%', justifyContent: 'center' }}>
            <CrudNavBar />
            <Button onClick={handleSetSearchClick} sx={{ color: Theme.palette.primary.contrastText }}>
              {!searchIsOpen ? 'Search' : 'Close'}
            </Button>
          </CenteredFlexDiv>
          <Divider flexItem orientation='vertical' />
        </Box>
      </Box>

      <Suspense fallback={<Waiting src={waiting} />}>
        <CenteredFlexDiv
          sx={{ backgroundColor: Theme.palette.background.paper, borderRadius: Theme.shape.borderRadius, padding: 0 }}
        >
          {searchIsOpen && <Search />}
        </CenteredFlexDiv>
      </Suspense>

      <Box id={`crud-app-wrapper`}>
        <Suspense fallback={<Waiting src={waiting} />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  );
}
