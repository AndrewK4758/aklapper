import { Text, useScrollIntoView } from '@aklapper/react-shared';
import Divider from '@mui/material/Divider';
import { lazy, useRef, type ReactElement } from 'react';
import Theme from '../../../styles/themes/theme';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import StyledCard from '../../styled/styled_card';
import { IMAGE_TEXT } from '../static/image-text';

const ImageForm = lazy(() => import('./image-form.jsx'));

/**
 * This component renders the image generation section of the generative AI page.
 * It lazy-loads the ImageForm component, which handles the image generation form.
 *
 * @returns {ReactElement} The rendered Image component.
 */

export default function Image(): ReactElement {
  const scrollRef = useRef<HTMLSpanElement>(null);
  useScrollIntoView(scrollRef);
  return (
    <CenteredFlexDiv id='image-gen-header-wrapper' sx={{ gap: Theme.spacing(8) }}>
      <StyledCard
        id='gen-image-wrapper'
        sx={{ padding: Theme.spacing(4), display: 'flex', gap: Theme.spacing(6), alignItems: 'center' }}
      >
        <Text variant='h5' children='Image Generator' />
        <Divider flexItem orientation='vertical' />
        <Text variant='body1' children={IMAGE_TEXT} sx={{ textAlign: 'start' }} />
      </StyledCard>
      <ImageForm />

      <span ref={scrollRef} />
    </CenteredFlexDiv>
  );
}
