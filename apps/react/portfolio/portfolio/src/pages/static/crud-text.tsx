import { Link } from 'react-router';
import Theme from '../../styles/theme.jsx';

export const title = 'C.R.U.D. Data Manager';

export const body = (
  <span>
    Example of crud app with MUI X- DataGrid, debounced search bar, columns have sorting & filtering, cells can be
    updated and changes are represented on the client and back end in real time, full cell values can be seen by
    hovering, rows can be deleted, each catagory has the ability to create an entry, ADD ENTRY provides the opportunity
    to add all fields at once, uses public{' '}
    <Link
      target="_blank"
      rel="noopener"
      to={'https://github.com/lerocha/chinook-database'}
      style={{ color: Theme.palette.secondary.main }}
      onMouseEnter={e => {
        e.currentTarget.style.color = Theme.palette.secondary.contrastText;
        e.currentTarget.style.backgroundColor = Theme.palette.secondary.main;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = Theme.palette.secondary.main;
        e.currentTarget.style.backgroundColor = Theme.palette.background.paper;
      }}
    >
      Chinook Database
    </Link>{' '}
    as the data.
  </span>
);

export const addEntrySteps = ['Artist', 'Album', 'Track'];
