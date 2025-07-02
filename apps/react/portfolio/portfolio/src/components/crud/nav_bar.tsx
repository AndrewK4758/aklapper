import Grid from '@mui/material-pigment-css/Grid';
import NavButton from '../layout/navigation/nav_button.js';

export default function CrudNavBar() {
  return (
    <Grid id='grid' container spacing={1} rowSpacing={1} wrap='wrap'>
      <Grid size={6}>
        <NavButton
          variant='outlined'
          id='crud-home-button'
          name='/portfolio/crud'
          buttonText={'CRUD Home'}
          sx={{ color: 'var(--mui-palette-info-main)', borderColor: 'var(--mui-palette-info-main)', width: '100%' }}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          variant='outlined'
          id='crud-artists-button'
          name='artists'
          buttonText='Artists'
          sx={{ color: 'var(--mui-palette-info-main)', borderColor: 'var(--mui-palette-info-main)', width: '100%' }}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          variant='outlined'
          id='crud-albums-button'
          name='albums'
          buttonText='Albums'
          sx={{ color: 'var(--mui-palette-info-main)', borderColor: 'var(--mui-palette-info-main)', width: '100%' }}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-add-entry-button'
          name='add-entry'
          buttonText='Add Entry'
          sx={{ color: 'var(--mui-palette-info-main)', borderColor: 'var(--mui-palette-info-main)', width: '100%' }}
        />
      </Grid>
    </Grid>
  );
}
