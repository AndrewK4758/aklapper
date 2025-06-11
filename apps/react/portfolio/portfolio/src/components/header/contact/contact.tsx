import Box from '@mui/material/Box';
import Collapse, { type CollapseProps } from '@mui/material/Collapse';
import { useState } from 'react';
import { contactButtonSxProps, iconSxProps } from '../../../styles/header-styles';
import EmailDialog from '../../email/email-dialog';
import DiscordIcon from '../../icons/discord-icon';
import EmailIcon from '../../icons/email-icon';
import FacebookIcon from '../../icons/facebook-icon';
import GitHibIcon from '../../icons/github-icon';
import HuggingFaceIcon from '../../icons/huggingface-icon';
import LinkedinIcon from '../../icons/linkedin-logo';
import XIcon from '../../icons/x-icon';
import ContactIcon from '../contact-icon/contact-icon';

interface ContactProps extends CollapseProps {
  isVisible: boolean;
  setIsVisible: () => void;
}

export function Contact({ isVisible, setIsVisible, ...props }: ContactProps) {
  const [openEmail, setOpenEmail] = useState<boolean>(false);

  const handleOpenEmail = () => {
    setOpenEmail(!openEmail);
  };

  return (
    <>
      <Collapse {...props} in={isVisible} id='contact-menu-collapse' data-testid='contact-menu-collapse'>
        <Box
          id='social-media-icon-wrapper'
          data-testid='social-media-icon-wrapper'
          sx={{ display: 'flex', border: '3px solid orange', justifyContent: 'space-evenly' }}
        >
          <ContactIcon
            id='github'
            tooltipText='GitHub'
            iconHref='https://github.com/AndrewK4758/aklapper'
            Icon={<GitHibIcon />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          <ContactIcon
            id='facebook'
            tooltipText='Facebook'
            iconHref='https://www.facebook.com/AKlapper47'
            Icon={<FacebookIcon />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          <ContactIcon
            id='linkedin'
            tooltipText='Linkedin'
            iconHref='https://www.linkedin.com/in/andrew-klapper-a9204b23b/'
            Icon={<LinkedinIcon />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id='hugging-face'
            tooltipText='Hugging Face'
            iconHref='https://huggingface.co/ak475826'
            Icon={<HuggingFaceIcon />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id='x'
            tooltipText='X'
            iconHref='https://x.com/ak475826'
            Icon={<XIcon />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id='discord'
            tooltipText='Discord'
            iconHref='https://discord.com/users/989564035542446190'
            Icon={<DiscordIcon />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id='email'
            tooltipText='Email & Google Calendar Event link'
            iconHref={''}
            Icon={<EmailIcon />}
            onClick={handleOpenEmail}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          {/* <ContactIcon
            id='close'
            tooltipText='Close Contact Menu'
            iconHref={''}
            Icon={<ArrowForwardIosIcon color='action' sx={{ height: 64, width: 64 }} />}
            onClick={setIsVisible}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          /> */}
        </Box>
        <Box component={'div'} id='email-form-wrapper' data-testid='email-form-wrapper' width={'100%'}>
          <EmailDialog open={openEmail} setOpen={setOpenEmail} />
        </Box>
      </Collapse>
    </>
  );
}

export default Contact;
