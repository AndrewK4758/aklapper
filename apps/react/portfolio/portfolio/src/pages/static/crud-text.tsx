import { Text } from '@aklapper/react-shared';
import Link from '@mui/material/Link';
import CRUD_THEME from '../../styles/themes/crud_theme';

export const CRUD_TITLE = <Text color='textPrimary' variant='h3' children='C.R.U.D. Data Manager' />;

export const CRUD_BODY = (
  <Text color='textSecondary' variant='subtitle2' textAlign={'justify'}>
    Example of crud app with MUI X- DataGrid, debounced search bar, columns have sorting & filtering, cells can be
    updated and changes are represented on the client and back end in real time, full cell values can be seen by
    hovering, rows can be deleted, each catagory has the ability to create an entry, ADD ENTRY provides the opportunity
    to add all fields at once, uses public{' '}
    <Link
      target='_blank'
      rel='noopener'
      href='https://github.com/lerocha/chinook-database'
      sx={{
        color: CRUD_THEME.palette.secondary.main,
        '&:hover': {
          color: CRUD_THEME.palette.primary.dark,
        },
      }}
    >
      Chinook Database
    </Link>{' '}
    as the data.
  </Text>
);

export const addEntrySteps = ['Artist', 'Album', 'Track'];
