import Box from '@mui/material/Box';

interface WaitingProps {
  src: string;
  width?: string;
}

export const Waiting = ({ src, width = '200px' }: WaitingProps) => (
  <Box
    component={'div'}
    id='waiting-wrapper'
    test-dataid='waiting-wrapper'
    display={'flex'}
    justifyContent={'center'}
    alignItems={'center'}
    width={'100%'}
    height={'100%'}
  >
    <img
      key={'waiting-image'}
      id={'waiting-image'}
      test-dataid={'waiting-image'}
      alt='waiting'
      src={src}
      style={{ width: width, height: 'auto' }}
    />
  </Box>
);

export default Waiting;
