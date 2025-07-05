import Grid from '@mui/material-pigment-css/Grid';
import { css } from '@pigment-css/react';
import NavButton from '../layout/navigation/nav_button.js';

export default function CrudNavBar() {
  return (
    <Grid id='grid' container spacing={1} rowSpacing={1} wrap='wrap'>
      <Grid size={6} sx={{ height: '50%' }}>
        <NavButton
          variant='outlined'
          id='crud-home-button'
          name='/portfolio/crud'
          buttonText={'CRUD Home'}
          className={css({
            color: 'var(--mui-palette-info-main)',
            borderColor: 'var(--mui-palette-info-main)',
            width: '100%',
            height: '100%',
          })}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          variant='outlined'
          id='crud-artists-button'
          name='artists'
          buttonText='Artists'
          className={css({
            color: 'var(--mui-palette-info-main)',
            borderColor: 'var(--mui-palette-info-main)',
            width: '100%',
            height: '100%',
          })}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          variant='outlined'
          id='crud-albums-button'
          name='albums'
          buttonText='Albums'
          className={css({
            color: 'var(--mui-palette-info-main)',
            borderColor: 'var(--mui-palette-info-main)',
            width: '100%',
            height: '100%',
          })}
        />
      </Grid>
      <Grid size={6}>
        <NavButton
          buttonSx={{ width: '100%' }}
          variant='outlined'
          id='crud-add-entry-button'
          name='add-entry'
          buttonText='Add Entry'
          className={css({
            color: 'var(--mui-palette-info-main)',
            borderColor: 'var(--mui-palette-info-main)',
            width: '100%',
            height: '100%',
          })}
        />
      </Grid>
    </Grid>
  );
}
