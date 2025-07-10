import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';

interface WaitingProps {
  src: string;
}

export const Waiting = ({ src }: WaitingProps) => (
  <Box
    component={'div'}
    id='waiting-wrapper'
    data-testid='waiting-wrapper'
    className={css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
    })}
  >
    <img
      id={'waiting-image'}
      data-testid={'waiting-image'}
      alt='waiting symbol'
      src={src}
      className={css({ width: '200px', height: 'auto', borderRadius: '16px' })}
    />
  </Box>
);

export default Waiting;
