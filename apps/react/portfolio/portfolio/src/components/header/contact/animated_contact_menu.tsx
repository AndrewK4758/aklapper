import { type BoxProps } from '@mui/material/Box';
import { useLayoutEffect, useRef, useState } from 'react';
import ContactMenu from './contact_menu.js';
import ContactRevealWrapper from './contact_reveal.js';

interface AnimatedContactMenuProps extends Omit<BoxProps, 'ref'> {
  isOpen: boolean;
  handleOpenEmail: () => void;
}

export default function AnimatedContactMenu({ isOpen, handleOpenEmail, ...props }: AnimatedContactMenuProps) {
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
    <ContactRevealWrapper contactRef={contactRef} dynamicWidth={contactWidth} isOpen={isOpen}>
      <ContactMenu isOpen={isOpen} handleOpenEmail={handleOpenEmail} />
      {/* <Box width={'100%'} display={'flex'} alignItems={'center'} justifyContent={'space-around'} inert={!isOpen}>
        <ContactIcon
          generalId='github'
          tooltipTitle={addToToolipString(TOOLTIP_STRING, 'GitHub!')}
          iconHref='https://github.com/AndrewK4758/aklapper'
          Icon={<GitHibIcon />}
          variant='socialMediaLink'
        />
        <ContactIcon
          generalId='facebook'
          tooltipTitle={addToToolipString(TOOLTIP_STRING, 'Facebook!')}
          iconHref='https://www.facebook.com/AKlapper47'
          Icon={<FacebookIcon />}
          variant='socialMediaLink'
        />
        <ContactIcon
          generalId='linkedin'
          tooltipTitle={addToToolipString(TOOLTIP_STRING, 'LinkedIn!')}
          iconHref='https://www.linkedin.com/in/andrew-klapper-a9204b23b/'
          Icon={<LinkedinIcon />}
          variant='socialMediaLink'
        />

        <ContactIcon
          generalId='hugging-face'
          tooltipTitle={addToToolipString(TOOLTIP_STRING, 'Hugging Face!')}
          iconHref='https://huggingface.co/ak475826'
          Icon={<HuggingFaceIcon />}
          variant='socialMediaLink'
        />

        <ContactIcon
          generalId='x'
          tooltipTitle={addToToolipString(TOOLTIP_STRING, 'X!')}
          iconHref='https://x.com/ak475826'
          Icon={<XIcon />}
          variant='socialMediaLink'
        />

        <ContactIcon
          generalId='discord'
          tooltipTitle={addToToolipString(TOOLTIP_STRING, 'Discord!')}
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
      </Box> */}
    </ContactRevealWrapper>
  );
}
