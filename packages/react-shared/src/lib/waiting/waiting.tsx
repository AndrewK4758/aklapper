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
      id={'waiting-image'}
      test-dataid={'waiting-image'}
      alt='waiting symbol'
      src={src}
      style={{ width: width, height: 'auto', borderRadius: '16px' }}
    />
  </Box>
);

export default Waiting;
