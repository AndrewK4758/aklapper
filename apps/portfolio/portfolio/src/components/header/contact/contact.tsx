import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import MenuList from '@mui/material/MenuList';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  contactButtonSxProps,
  drawerPaperProps,
  iconSize,
  iconSxProps,
  iconWrapperSxProps
} from '../../../styles/header-styles';
import EmailDialog from '../../email/email-dialog';
import DiscordIcon from '../../icons/discord-icon';
import EmailIcon from '../../icons/email-icon';
import FacebookIcon from '../../icons/facebook-icon';
import GitHibIcon from '../../icons/github-icon';
import HuggingFaceIcon from '../../icons/huggingface-icon';
import LinkedinIcon from '../../icons/linkedin-logo';
import XIcon from '../../icons/x-icon';
import ContactIcon from '../contact-icon/contact-icon';

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
        key={`Contact-menu-draw-${openEmail}`}
        id="Contact-menu-draw"
        data-testid="Contact-menu-draw"
        open={openMenu}
        anchor="right"
        elevation={6}
        PaperProps={drawerPaperProps}
      >
        <MenuList
          ref={contactMenuRef}
          component={'div'}
          key={'social-media-icon-wrapper'}
          id="social-media-icon-wrapper"
          data-testid="social-media-icon-wrapper"
          sx={iconWrapperSxProps}
        >
          <ContactIcon
            id="github"
            tooltipText="Github"
            iconHref="https://github.com/AndrewK4758/aklapper"
            Icon={<GitHibIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          <ContactIcon
            id="facebook"
            tooltipText="Facebook"
            iconHref="https://www.facebook.com/AKlapper47"
            Icon={<FacebookIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          <ContactIcon
            id="linkedin"
            tooltipText="Linkedin"
            iconHref="https://www.linkedin.com/in/andrew-klapper-a9204b23b/"
            Icon={<LinkedinIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id="hugging-face"
            tooltipText="Hugging Face"
            iconHref="https://huggingface.co/ak475826"
            Icon={<HuggingFaceIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id="x"
            tooltipText="X"
            iconHref="https://x.com/ak475826"
            Icon={<XIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id="discord"
            tooltipText="Discord"
            iconHref="https://discord.com/users/989564035542446190"
            Icon={<DiscordIcon sx={iconSize} />}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />

          <ContactIcon
            id="email"
            tooltipText="Email & Google Calendar Event link"
            iconHref=""
            Icon={<EmailIcon sx={iconSize} />}
            onClick={setOpenEmail}
            stateVariable={true}
            itemSx={iconSxProps}
            buttonSx={contactButtonSxProps}
          />
          <ContactIcon
            id="close"
            tooltipText="Close Contact Menu"
            iconHref=""
            Icon={<ArrowForwardIosIcon color="action" sx={iconSize} />}
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
        id="email-form-wrapper"
        data-testid="email-form-wrapper"
        width={'100%'}
      >
        <EmailDialog open={openEmail} setOpen={setOpenEmail} />
      </Box>
    </>
  );
}

export default Contact;
