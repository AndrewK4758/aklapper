import Box, { type BoxProps } from '@mui/material/Box';
import type { SxProps } from '@mui/material/styles';
import lottie from 'lottie-web';
import { useEffect, type RefObject } from 'react';
import explosionJson from '../../assets/videos/explosion.json';

const explosionAnimation: SxProps = {
  position: 'absolute',
  top: 165,
  left: 232,
  zIndex: 2,
  width: 320,
  height: 'auto',
};

interface ExplosionProps extends BoxProps {
  elementRef: RefObject<HTMLDivElement | null>;
}

export default function Explosion({ elementRef, ...props }: ExplosionProps) {
  useEffect(() => {
    const explosion = elementRef.current;
    if (explosion) {
      lottie.loadAnimation({
        animationData: explosionJson,
        loop: false,
        autoplay: true,
        container: explosion,
      });
    }
  }, []);

  return <Box {...props} sx={explosionAnimation} component={'div'} ref={elementRef} />;
}
