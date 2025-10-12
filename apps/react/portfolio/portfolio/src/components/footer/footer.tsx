import Box, { type BoxProps } from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import styles from '../../styles/layout.module.css';

export default function Footer({ ...props }: Omit<BoxProps, 'id | data-testid | component'>) {
  const nav = useNavigate();

  const handleOpenPrivacyPolicy = useCallback(() => {
    nav('privacy-policy', { relative: 'route' });
  }, []);
  return (
    <Box
      {...props}
      component={'footer'}
      id='footer'
      data-testid='footer'
      textAlign={'center'}
      marginTop={'auto'}
      sx={{ border: 'solid' }}
    >
      <Button variant='text' onClick={handleOpenPrivacyPolicy} className={styles.footer}>
        Privacy Policy
      </Button>
    </Box>
  );
}
