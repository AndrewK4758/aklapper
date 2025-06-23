import Box from '@mui/material/Box';
// import { addToToolipString } from '../../../utils/utils';
import DiscordIcon from '../../icons/discord-icon';
import EmailIcon from '../../icons/email-icon';
import FacebookIcon from '../../icons/facebook-icon';
import GitHibIcon from '../../icons/github-icon';
import HuggingFaceIcon from '../../icons/huggingface-icon';
import LinkedinIcon from '../../icons/linkedin-logo';
import XIcon from '../../icons/x-icon';
import ContactIcon from './contact-icon';

//space at end is intentional
// const TOOLTIP_STRING = 'Connect with me on ';

interface ContactMenuProps {
  isOpen: boolean;
  handleOpenEmail: () => void;
}

export default function ContactMenu({ isOpen, handleOpenEmail }: ContactMenuProps) {
  return (
    <Box width={'100%'} display={'flex'} alignItems={'center'} justifyContent={'space-around'} inert={!isOpen}>
      <ContactIcon
        generalId='github'
        // tooltipTitle={addToToolipString(TOOLTIP_STRING, 'GitHub!')}
        iconHref='https://github.com/AndrewK4758/aklapper'
        Icon={<GitHibIcon />}
        variant='socialMediaLink'
      />
      <ContactIcon
        generalId='facebook'
        // tooltipTitle={addToToolipString(TOOLTIP_STRING, 'Facebook!')}
        iconHref='https://www.facebook.com/AKlapper47'
        Icon={<FacebookIcon />}
        variant='socialMediaLink'
      />
      <ContactIcon
        generalId='linkedin'
        // tooltipTitle={addToToolipString(TOOLTIP_STRING, 'LinkedIn!')}
        iconHref='https://www.linkedin.com/in/andrew-klapper-a9204b23b/'
        Icon={<LinkedinIcon />}
        variant='socialMediaLink'
      />

      <ContactIcon
        generalId='hugging-face'
        // tooltipTitle={addToToolipString(TOOLTIP_STRING, 'Hugging Face!')}
        iconHref='https://huggingface.co/ak475826'
        Icon={<HuggingFaceIcon />}
        variant='socialMediaLink'
      />

      <ContactIcon
        generalId='x'
        // tooltipTitle={addToToolipString(TOOLTIP_STRING, 'X!')}
        iconHref='https://x.com/ak475826'
        Icon={<XIcon />}
        variant='socialMediaLink'
      />

      <ContactIcon
        generalId='discord'
        // tooltipTitle={addToToolipString(TOOLTIP_STRING, 'Discord!')}
        iconHref='https://discord.com/users/989564035542446190'
        Icon={<DiscordIcon />}
        variant='socialMediaLink'
      />

      <ContactIcon
        generalId='email'
        // tooltipTitle='Email & Google Calendar Event link'
        Icon={<EmailIcon />}
        variant='socialMediaLink'
        onClick={handleOpenEmail}
      />
    </Box>
  );
}
