import Box, { type BoxProps } from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import lottie from 'lottie-web';
import { useEffect, useRef } from 'react';
import explosionJson from '../../../assets/animations/explosion.json';

const explosionBaseStyle: SxProps<Theme> = {
  position: 'absolute',
  top: 165,
  left: 232,
  zIndex: 2,
  width: 320,
  height: 'auto',
  transition: 'opacity 0.8s ease-in-out',
};

interface ExplosionProps extends Omit<BoxProps, 'component'> {
  isVisible: boolean;
}

export default function LandingExplosion({ isVisible, ...props }: ExplosionProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const explosion = elementRef.current;
    if (explosion) {
      const animation = lottie.loadAnimation({
        animationData: explosionJson,
        loop: false,
        autoplay: true,
        container: explosion,
      });
      return () => animation.destroy();
    }
    return;
  }, []);

  return (
    <Box {...props} sx={[explosionBaseStyle, { opacity: isVisible ? 1 : 0 }] as SxProps<Theme>} ref={elementRef} />
  );
}
