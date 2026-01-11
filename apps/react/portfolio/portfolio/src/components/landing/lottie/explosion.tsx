import Box, { type BoxProps } from '@mui/material/Box';
import styles from '@styles/landing/landing.module.css';
import useExplosion from '@hooks/landing/use-explosion';

interface ExplosionProps extends Omit<BoxProps, 'component' | 'sx'> {
  isVisible: boolean;
}

export default function LandingExplosion({ isVisible, ...props }: ExplosionProps) {
  const elementRef = useExplosion();
  return <Box {...props} className={styles.explosion} ref={elementRef} />;
}
