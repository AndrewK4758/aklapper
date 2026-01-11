import Box from '@mui/material/Box';
import styles from '@styles/landing/landing.module.css';
import LandingBox from '@components/icons/landing_box_icon';

const shakeIconAnimation = {
  animation: `${styles.shake} 2.25s linear 3s 5`,
  transformOrigin: 'center',
};

const baseStyle = {
  position: 'relative' as const,
  flex: '1 0 50%',
};

interface LandingBoxProps {
  isLandingNavOpen: boolean;
  onHandleNavbarClick: () => void;
}

export default function BoxAnimation({ isLandingNavOpen, onHandleNavbarClick }: LandingBoxProps) {

  const openStyle = { ...baseStyle, ...shakeIconAnimation };

  return (
    <Box className={styles.boxWrapper}>
      <LandingBox
        id='open-menu'
        isLandingNavOpen={isLandingNavOpen}
        onHandleOpenMenu={onHandleNavbarClick}
        style={isLandingNavOpen ? baseStyle : openStyle}
      />
    </Box>
  );
}
