import { RevealWrapper } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import styles from '../../../styles/header.module.css';
import DiscordIcon from '../../icons/discord-icon';
import EmailIcon from '../../icons/email-icon';
import FacebookIcon from '../../icons/facebook-icon';
import GitHibIcon from '../../icons/github-icon';
import HuggingFaceIcon from '../../icons/huggingface-icon';
import LinkedinIcon from '../../icons/linkedin-logo';
import XIcon from '../../icons/x-icon';
import ContactIcon from './contact-icon';

interface AnimatedContactMenuProps {
  isOpen: boolean;
  handleOpenEmail: () => void;
}

export default function AnimatedContactMenu({ isOpen, handleOpenEmail }: AnimatedContactMenuProps) {
  return (
    <RevealWrapper isOpen={isOpen} data-testid={'contact-reveal-wrapper'}>
      <Box className={styles.animatedMenu} data-testid={'contact-menu'} inert={!isOpen}>
        <ContactIcon generalId='github' iconHref='https://github.com/AndrewK4758/aklapper'>
          {GitHibIcon}
        </ContactIcon>

        <ContactIcon generalId='facebook' iconHref='https://www.facebook.com/AKlapper47'>
          {FacebookIcon}
        </ContactIcon>
        <ContactIcon generalId='linkedin' iconHref='https://www.linkedin.com/in/andrew-klapper-a9204b23b/'>
          {LinkedinIcon}
        </ContactIcon>

        <ContactIcon generalId='hugging-face' iconHref='https://huggingface.co/ak475826'>
          {HuggingFaceIcon}
        </ContactIcon>

        <ContactIcon generalId='x' iconHref='https://x.com/ak475826'>
          {XIcon}
        </ContactIcon>

        <ContactIcon generalId='discord' iconHref='https://discord.com/users/989564035542446190'>
          {DiscordIcon}
        </ContactIcon>

        <ContactIcon
          generalId='email'
          onClick={handleOpenEmail}
          tooltip={{
            title: 'Click to connect with me',
            placement: 'bottom-end',
            arrow: true,
            slotProps: {
              tooltip: {
                sx: {
                  fontSize: '1.5rem',
                  maxWidth: '7rem',
                },
              },
            },
          }}
        >
          {EmailIcon}
        </ContactIcon>
      </Box>
    </RevealWrapper>
  );
}
