import Box, { type BoxProps } from '@mui/material/Box';
import Link from '@mui/material/Link';

interface FooterProps extends Omit<BoxProps, 'id | data-testid | component'> {
  handleOpenPrivacyPolicy: () => void;
}

export default function Footer({ handleOpenPrivacyPolicy, ...props }: FooterProps) {
  return (
    <Box {...props} component={'footer'} id='footer' data-testid='footer' textAlign={'center'} marginTop={'auto'}>
      <Link component={'a'} underline='hover' onClick={handleOpenPrivacyPolicy} sx={{ cursor: 'pointer' }}>
        Privacy Policy
      </Link>
    </Box>
  );
}
