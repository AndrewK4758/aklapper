import { Waiting } from '@aklapper/react-shared';
import { css } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { lazy, ReactElement, Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import CrudNavBar from '../../components/crud/nav_bar';
import CrudHeader from '../../components/crud/page_header.js';
import CenteredFlexDiv from '../../components/styled/centered_flexbox';
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

  const handleSetSearchClick = () => {
    setSearchIsOpen(!searchIsOpen);
  };

  return (
    <CenteredFlexDiv id='crud-wrapper'>
      <Box
        className={css({
          display: 'flex',
          padding: `${Theme.spacing(4)} ${Theme.spacing(8)}`,
          backgroundColor: Theme.palette.background.paper,
          borderRadius: Theme.shape.borderRadius,
        })}
      >
        <Divider flexItem orientation='vertical' />
        <Box className={css({ display: 'flex', flexDirection: 'row' })}>
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
          className={css({
            backgroundColor: Theme.palette.background.paper,
            borderRadius: Theme.shape.borderRadius,
            padding: 0,
          })}
        >
          {searchIsOpen && <Search />}
        </CenteredFlexDiv>
      </Suspense>

      <Box id={`crud-app-wrapper`} className={css({ width: '100%' })}>
        <Suspense fallback={<Waiting src={waiting} />}>
          <Outlet />
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
}
