import Box, { type BoxProps } from '@mui/material/Box';
import Link from '@mui/material/Link';
import { useNavigate } from 'react-router';

export default function Footer({ ...props }: Omit<BoxProps, 'id | data-testid | component'>) {
  const nav = useNavigate();

  const handleOpenPrivacyPolicy = () => {
    nav('privacy-policy', { relative: 'route' });
  };

  return (
    <Box {...props} component={'footer'} id='footer' data-testid='footer' textAlign={'center'} marginTop={'auto'}>
      <Link component={'a'} underline='hover' onClick={handleOpenPrivacyPolicy} sx={{ cursor: 'pointer' }}>
        Privacy Policy
      </Link>
    </Box>
  );
}
