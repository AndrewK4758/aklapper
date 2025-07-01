import Box, { type BoxProps } from '@mui/material/Box';
import Button from '@mui/material/Button';

interface FooterProps extends Omit<BoxProps, 'id | data-testid | component'> {
  handleOpenPrivacyPolicy: () => void;
}

export default function Footer({ handleOpenPrivacyPolicy, ...props }: FooterProps) {
  return (
    <Box {...props} component={'footer'} id='footer' data-testid='footer' textAlign={'center'} marginTop={'auto'}>
      <Button variant='text' onClick={handleOpenPrivacyPolicy} style={{ cursor: 'pointer' }}>
        Privacy Policy
      </Button>
    </Box>
  );
}
