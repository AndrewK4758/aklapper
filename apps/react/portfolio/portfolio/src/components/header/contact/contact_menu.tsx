import Box, { type BoxProps } from '@mui/material/Box';
import { useLayoutEffect, useRef, useState } from 'react';
import DiscordIcon from '../../icons/discord-icon';
import EmailIcon from '../../icons/email-icon';
import FacebookIcon from '../../icons/facebook-icon';
import GitHibIcon from '../../icons/github-icon';
import HuggingFaceIcon from '../../icons/huggingface-icon';
import LinkedinIcon from '../../icons/linkedin-logo';
import XIcon from '../../icons/x-icon';
import ContactIcon from './contact-icon';

//space at end is intentional
const TOOLTIP_STRING = 'Connect with me on ';

interface ContactMenuProps extends Omit<BoxProps, 'ref'> {
  isOpen: boolean;
  handleOpenEmail: () => void;
}

export default function ContactMenu({ isOpen, handleOpenEmail, ...props }: ContactMenuProps) {
  const [contactWidth, setContactWidth] = useState(0);
  const contactRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = contactRef.current;
    if (element) {
      const width = element.getBoundingClientRect().width;
      setContactWidth(width);
    }
  }, []);

  return (
    <Box {...props} ref={contactRef} flex={'0 1 100%'}>
      <Box
        id='social-media-icon-wrapper'
        data-testid='social-media-icon-wrapper'
        sx={{
          height: '100%',
          width: isOpen ? '100%' : '0%',
          transition: `width 0.35s ease-in-out`,
          overflow: 'hidden',
        }}
      >
        <Box width={'100%'} height={'100%'} minWidth={contactWidth}>
          <Box width={'100%'} display={'flex'} alignItems={'center'} justifyContent={'space-around'}>
            <ContactIcon
              generalId='github'
              tooltipTitle={TOOLTIP_STRING.concat('GitHub!')}
              iconHref='https://github.com/AndrewK4758/aklapper'
              Icon={<GitHibIcon />}
              variant='socialMediaLink'
            />
            <ContactIcon
              generalId='facebook'
              tooltipTitle={TOOLTIP_STRING.concat('Facebook!')}
              iconHref='https://www.facebook.com/AKlapper47'
              Icon={<FacebookIcon />}
              variant='socialMediaLink'
            />
            <ContactIcon
              generalId='linkedin'
              tooltipTitle={TOOLTIP_STRING.concat('LinkedIn!')}
              iconHref='https://www.linkedin.com/in/andrew-klapper-a9204b23b/'
              Icon={<LinkedinIcon />}
              variant='socialMediaLink'
            />

            <ContactIcon
              generalId='hugging-face'
              tooltipTitle={TOOLTIP_STRING.concat('Hugging Face!')}
              iconHref='https://huggingface.co/ak475826'
              Icon={<HuggingFaceIcon />}
              variant='socialMediaLink'
            />

            <ContactIcon
              generalId='x'
              tooltipTitle={TOOLTIP_STRING.concat('X!')}
              iconHref='https://x.com/ak475826'
              Icon={<XIcon />}
              variant='socialMediaLink'
            />

            <ContactIcon
              generalId='discord'
              tooltipTitle={TOOLTIP_STRING.concat('Discord!')}
              iconHref='https://discord.com/users/989564035542446190'
              Icon={<DiscordIcon />}
              variant='socialMediaLink'
            />

            <ContactIcon
              generalId='email'
              tooltipTitle='Email & Google Calendar Event link'
              Icon={<EmailIcon />}
              variant='socialMediaLink'
              onClick={handleOpenEmail}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
