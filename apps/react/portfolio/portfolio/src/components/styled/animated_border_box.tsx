import Box, { type BoxProps } from '@mui/material/Box';
import styles from '@styles/shared.module.css';

export default function AnimatedBorderBox({children,...props}:BoxProps){
  return (
    <Box {...props} className={styles.animatedBorderBox}>
      {children}
    </Box>
  )
};
