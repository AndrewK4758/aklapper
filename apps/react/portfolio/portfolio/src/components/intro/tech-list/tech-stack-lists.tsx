import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { type ReactElement } from 'react';
import techStackData from '../static/tech-stack-text';
import TechList from './tech-list';

/**
 * This component renders a list of technologies i am strongest with.
 *
 * @returns {ReactElement} The rendered tech stack list component.
 */

const TechStackLists = (): ReactElement => {
  return (
    <Box sx={{ flex: '70%', height: 'fit-content' }}>
      <Grid container wrap='wrap' rowGap={4} columnGap={1}>
        {techStackData.map(entry => (
          <TechList
            key={entry[0]}
            id={entry[0]}
            labelText={entry[0]}
            tooltipTitle={entry[2]}
            variant={'h5'}
            data={entry[1]}
            title={entry[0]}
            placement='top'
          />
        ))}
      </Grid>
    </Box>
  );
};
export default TechStackLists;
