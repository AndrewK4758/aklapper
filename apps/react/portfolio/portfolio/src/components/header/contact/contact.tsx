import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import MenuList from '@mui/material/MenuList';
import { lazy, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  contactButtonSxProps,
  drawerPaperProps,
  iconSize,
  iconSxProps,
  iconWrapperSxProps,
} from '../../../styles/header-styles.jsx';

const EmailDialog = lazy(() => import('../../email/email-dialog.jsx'));
const DiscordIcon = lazy(() => import('../../icons/discord-icon.jsx'));
const EmailIcon = lazy(() => import('../../icons/email-icon.jsx'));
const FacebookIcon = lazy(() => import('../../icons/facebook-icon.jsx'));
const GitHibIcon = lazy(() => import('../../icons/github-icon.jsx'));
const HuggingFaceIcon = lazy(() => import('../../icons/huggingface-icon.jsx'));
const LinkedinIcon = lazy(() => import('../../icons/linkedin-logo.jsx'));
const XIcon = lazy(() => import('../../icons/x-icon.jsx'));
const ContactIcon = lazy(() => import('../contact-icon/contact-icon.jsx'));

interface ContactProps {
  openMenu: boolean;
  setOpenMenu: Dispatch<SetStateAction<boolean>>;
}

export function Contact({ openMenu, setOpenMenu }: ContactProps) {
  const [openEmail, setOpenEmail] = useState<boolean>(false);
  const contactMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutsideDrawer = (event: MouseEvent) => {
      if (contactMenuRef.current && !contactMenuRef.current.contains(event.target as Node)) {
        setOpenMenu(false);
      }
    };

    // Add the event listener when the drawer is open
    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutsideDrawer);
    }

    // Clean up the event listener when the drawer closes or the component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideDrawer);
    };
  }, [openMenu, setOpenMenu]);

  return (
    <>
      <Drawer
        key={`contact-menu-draw-${openEmail}`}
        id='contact-menu-draw'
        data-testid='contact-menu-draw'
        open={openMenu}
        anchor='right'
        elevation={6}
        slotProps={{ paper: drawerPaperProps }}
      >
        <MenuList
          ref={contactMenuRef}
          component={'div'}
          key={'social-media-icon-wrapper'}
          id='social-media-icon-wrapper'
          data-testid='social-media-icon-wrapper'
          sx={iconWrapperSxProps}
        >
          <ContactIcon
            id='github'
            tooltipText='GitHub'
            iconHref='https://github.com/AndrewK4758/aklapper'
            Icon={<GitHibIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          <ContactIcon
            id='facebook'
            tooltipText='Facebook'
            iconHref='https://www.facebook.com/AKlapper47'
            Icon={<FacebookIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          <ContactIcon
            id='linkedin'
            tooltipText='Linkedin'
            iconHref='https://www.linkedin.com/in/andrew-klapper-a9204b23b/'
            Icon={<LinkedinIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id='hugging-face'
            tooltipText='Hugging Face'
            iconHref='https://huggingface.co/ak475826'
            Icon={<HuggingFaceIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id='x'
            tooltipText='X'
            iconHref='https://x.com/ak475826'
            Icon={<XIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id='discord'
            tooltipText='Discord'
            iconHref='https://discord.com/users/989564035542446190'
            Icon={<DiscordIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id='email'
            tooltipText='Email & Google Calendar Event link'
            iconHref={''}
            Icon={<EmailIcon sx={iconSize} />}
            onClick={setOpenEmail}
            stateVariable={true}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          <ContactIcon
            id='close'
            tooltipText='Close Contact Menu'
            iconHref={''}
            Icon={<ArrowForwardIosIcon color='action' sx={iconSize} />}
            onClick={setOpenMenu}
            stateVariable={false}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
        </MenuList>
      </Drawer>
      <Box
        component={'div'}
        key={'email-form-wrapper'}
        id='email-form-wrapper'
        data-testid='email-form-wrapper'
        width={'100%'}
      >
        <EmailDialog open={openEmail} setOpen={setOpenEmail} />
      </Box>
    </>
  );
}

export default Contact;
