import { CenteredFlexDiv, Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { lazy, type ReactElement, Suspense, useState } from 'react';
import { Outlet, useNavigation } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import CrudNavBar from '../../components/crud/nav_bar';
import CrudHeader from '../../components/crud/page_header';
import Theme from '../../styles/themes/theme';

const Search = lazy(() => import('../../components/crud/search/search'));

/**
 * This component renders the CRUD (Create, Read, Update, Delete) section of the application.
 * It provides an interface for users to interact with the database, including viewing, adding, updating, and deleting records.
 *
 * @returns {ReactElement} The rendered CRUD component.
 */

export default function Crud(): ReactElement {
  const [searchIsOpen, setSearchIsOpen] = useState<boolean>(false);
  const { state } = useNavigation();
  console.log(state);
  const handleSetSearchClick = () => {
    setSearchIsOpen(!searchIsOpen);
  };
  return (
    <CenteredFlexDiv id='crud-wrapper'>
      <Box
        sx={{
          display: 'flex',
          padding: `${Theme.spacing(4)} ${Theme.spacing(8)}`,
          backgroundColor: Theme.palette.background.paper,
          borderRadius: Theme.shape.borderRadius,
        }}
      >
        <Divider flexItem orientation='vertical' />
        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
          <CenteredFlexDiv>
            <CrudHeader />
          </CenteredFlexDiv>
          <CenteredFlexDiv sx={{ paddingRight: '4', width: '100%', justifyContent: 'center' }}>
            <CrudNavBar />
            <Button onClick={handleSetSearchClick} sx={{ color: Theme.palette.primary.contrastText }}>
              {!searchIsOpen ? 'Search' : 'Close'}
            </Button>
          </CenteredFlexDiv>
          <Divider flexItem orientation='vertical' />
        </Box>
      </Box>

      <CenteredFlexDiv
        sx={{
          backgroundColor: Theme.palette.background.paper,
          borderRadius: Theme.shape.borderRadius,
          padding: 0,
        }}
      >
        <Suspense fallback={<Waiting src={waiting} />}>{searchIsOpen && <Search />}</Suspense>
      </CenteredFlexDiv>

      <Box id={`crud-app-wrapper`} sx={{ height: '100%', width: '100%' }}>
        <Outlet />
      </Box>
    </CenteredFlexDiv>
  );
}
