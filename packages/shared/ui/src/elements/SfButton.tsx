import { Button, type ButtonProps } from '@base-ui/react/button';

import styles from './SfButton.module.css';

export interface SfButtonProps extends ButtonProps {
  variant?: 'default' | 'primary' | 'danger';
}

export function SfButton({ variant = 'default', className, ...props }: SfButtonProps) {
  const merged =
    typeof className === 'string' && className ? `${styles.button} ${className}` : styles.button;
  return <Button {...props} data-variant={variant} className={merged} />;
}
