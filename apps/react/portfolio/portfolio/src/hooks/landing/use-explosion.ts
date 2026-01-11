import lottie from 'lottie-web';
import { useEffect, useRef } from 'react';
import explosionJson from '@assets/animations/explosion.json';

export default function useExplosion() {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const explosion = elementRef.current;
    if (explosion) {
      const animation = lottie.loadAnimation({
        animationData: explosionJson,
        loop: false,
        autoplay: true,
        container: explosion,
        renderer: 'svg',
        rendererSettings: {
          hideOnTransparent: true,
        },
      });
      return () => {
        if (explosion) animation.destroy();
      };
    }
    return;
  }, []);
  return elementRef;
}
