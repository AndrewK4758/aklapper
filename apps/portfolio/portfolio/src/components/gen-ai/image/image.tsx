import { useScrollIntoView } from '@aklapper/react-shared';
import { topLevelModeStyle } from '../../../styles/gen-ai-styles';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { lazy, useRef, type JSX } from 'react';

const ImageForm = lazy(() => import('./image-form'));

/**
 * This component renders the image generation section of the generative AI page.
 * It lazy-loads the ImageForm component, which handles the image generation form.
 *
 * @returns {JSX.Element} The rendered Image component.
 */

const Image = (): JSX.Element => {
  const divRef = useRef<HTMLDivElement>(null);
  useScrollIntoView(divRef);
  return (
    <Box component={'div'} key={'gen-image-wrapper'} id="gen-image-wrapper" ref={divRef} sx={topLevelModeStyle}>
      <Paper component={'div'} key={'gen-image-paper'} id="gen-image-paper">
        <Container component={'section'} key={'gen-image-form-wrapper'} id="gen-image-form-wrapper">
          <ImageForm />
        </Container>
      </Paper>
    </Box>
  );
};
export default Image;
