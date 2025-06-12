import Box, { type BoxProps } from '@mui/material/Box';
import Link from '@mui/material/Link';
import { useNavigate } from 'react-router';

export default function Footer({ ...props }: Omit<BoxProps, 'sx | id | data-testid'>) {
  const nav = useNavigate();

  const handleOpenPrivacyPolicy = () => {
    nav('privacy-policy', { relative: 'route' });
  };

  return (
    <Box {...props} component={'footer'} id='footer' data-testid='footer' sx={{ marginX: 'auto' }}>
      <Link component={'a'} underline='hover' onClick={handleOpenPrivacyPolicy} sx={{ cursor: 'pointer' }}>
        Privacy Policy
      </Link>
    </Box>
  );
}
