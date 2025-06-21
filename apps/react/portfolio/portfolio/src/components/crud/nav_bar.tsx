import Grid from '@mui/material/Grid';
import NavButton from '../navigation/nav_button';

export default function CrudNavBar() {
  return (
    <Grid id='grid' container spacing={1} rowSpacing={1} wrap='wrap'>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-home-button'
          path='/portfolio/crud'
          buttonText={'CRUD Home'}
          tooltipTitle={'Return to the main page of CRUD App'}
          placement='top-start'
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-artists-button'
          path='artists'
          buttonText='Artists'
          tooltipTitle={'This displays all artists in the database with server side pagination'}
          placement='top-end'
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-albums-button'
          path='albums'
          buttonText='Albums'
          tooltipTitle={'This displays all albums in the database with server side pagination'}
          placement='bottom-start'
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-add-entry-button'
          path='add-entry'
          buttonText='Add Entry'
          tooltipTitle={'This displays the dialog to add an artist / album / track entry in the database'}
          placement='bottom-end'
        />
      </Grid>
    </Grid>
  );
}
