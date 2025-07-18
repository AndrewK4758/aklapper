import { css } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import Grid from '@mui/material-pigment-css/Grid';
import { type ReactElement } from 'react';
import Theme from '../../../styles/themes/theme';
import techStackData from '../static/tech-stack-text';
import TechList from './tech-list';

/**
 * This component renders a list of technologies i am strongest with.
 *
 * @returns {ReactElement} The rendered tech stack list component.
 */

const TechStackLists = (): ReactElement => {
  return (
    <Box
      className={css({
        flex: '1 0 70%',
        height: 'fit-content',
      })}
      id='tech-stack-wrapper'
    >
      <Grid
        container
        wrap='wrap'
        data-testid='tech-stack-lists-grid'
        sx={{
          rowGap: Theme.spacing(4),
          columnGap: Theme.spacing(2),
        }}
      >
        {techStackData.map(entry => (
          <TechList key={entry[0]} id={entry[0]} labelText={entry[0]} variant={'h5'} data={entry[1]} title={entry[0]} />
        ))}
      </Grid>
    </Box>
  );
};
export default TechStackLists;
