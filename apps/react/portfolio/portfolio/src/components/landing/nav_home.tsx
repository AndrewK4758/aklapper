import type { CSSProperties } from 'react';
import EnterIcon from '../icons/enter_icon';
import styles from '@styles/landing/landing.module.css';

interface NavToHomeProps {
  isVisible: boolean;
  motionOffset: number;
  onHandleClickEnter: () => void;
}

export default function NavToHome({ isVisible, motionOffset, onHandleClickEnter }: NavToHomeProps) {
  const enterIconStyleBase: CSSProperties = {
    opacity: isVisible ? 1 : 0,
    offsetDistance: isVisible ? '100%' : '0%',
    offsetPosition: motionOffset,
    transform: `${isVisible ? 'scale(2.25)' : 'scale(0.3)'}`,
  };

  return <EnterIcon className={styles.enterIcon} onHandleClickEnter={onHandleClickEnter} style={enterIconStyleBase} />;
}
