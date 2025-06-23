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
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-artists-button'
          path='artists'
          buttonText='Artists'
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-albums-button'
          path='albums'
          buttonText='Albums'
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-add-entry-button'
          path='add-entry'
          buttonText='Add Entry'
        />
      </Grid>
    </Grid>
  );
}
