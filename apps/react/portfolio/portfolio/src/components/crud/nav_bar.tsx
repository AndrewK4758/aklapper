import Grid from '@mui/material-pigment-css/Grid';
import CRUD_THEME from '../../styles/themes/crud_theme';
import NavButton from '../navigation/nav_button';

export default function CrudNavBar() {
  return (
    <Grid id='grid' container spacing={1} rowSpacing={1} wrap='wrap' sx={{ border: 3 }}>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-home-button'
          path='/portfolio/crud'
          buttonText={'CRUD Home'}
          sx={{ color: CRUD_THEME.palette.primary.main, borderColor: CRUD_THEME.palette.primary.main }}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-artists-button'
          path='artists'
          buttonText='Artists'
          sx={{ color: CRUD_THEME.palette.primary.main, borderColor: CRUD_THEME.palette.primary.main }}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-albums-button'
          path='albums'
          buttonText='Albums'
          sx={{ color: CRUD_THEME.palette.primary.main, borderColor: CRUD_THEME.palette.primary.main }}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-add-entry-button'
          path='add-entry'
          buttonText='Add Entry'
          sx={{ color: CRUD_THEME.palette.primary.main, borderColor: CRUD_THEME.palette.primary.main }}
        />
      </Grid>
    </Grid>
  );
}
