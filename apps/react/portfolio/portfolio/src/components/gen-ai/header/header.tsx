import { Text } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Divider from '@mui/material/Divider';
import { useNavigate } from 'react-router';
import { BODY_TEXT, TITLE } from '../../../pages/static/gen-ai-text';
import Theme from '../../../styles/themes/theme';
import AnimatedBorderBox from '../../styled/animated_border_box';
import CenteredFlexDiv from '../../styled/centered_flexbox';

interface GenAiHeaderProps {
  isPromptBuilderOpen: boolean;
  setIsPromptBuilderOpen: () => void;
}

export default function GenAiHeader({ isPromptBuilderOpen, setIsPromptBuilderOpen }: GenAiHeaderProps) {
  const nav = useNavigate();

  const handleNavToGenAiSection = (path: string) => {
    nav(path, { replace: true, relative: 'route' });
  };

  return (
    <CenteredFlexDiv
      sx={{
        backgroundColor: Theme.palette.background.paper,
        borderRadius: Theme.shape.borderRadius,
        justifyContent: 'flex-start',
        gap: Theme.spacing(2),
      }}
    >
      <Box as={'section'} id='gen-ai-title-wrapper' sx={{ display: 'flex', alignItems: 'center' }}>
        <Text variant='h4' children={TITLE} sx={{ flex: '0 1 25%' }} />
        <Divider orientation='vertical' flexItem />
        <Text
          id='gen-ai-header-text'
          variant='body1'
          children={BODY_TEXT}
          sx={{ flex: '0 1 75%', padding: Theme.spacing(4), textAlign: 'start' }}
        />
      </Box>

      <AnimatedBorderBox sx={{ width: '100%' }}>
        <ButtonGroup id={'gen-ai-button-group'} color='primary' fullWidth={true}>
          <Button id='gen-ai-text-button' onClick={() => handleNavToGenAiSection('text')}>
            Text
          </Button>
          <Button id='gen-ai-image' onClick={() => handleNavToGenAiSection('image')}>
            Image
          </Button>
          <Button id='gen-ai-audio' onClick={() => handleNavToGenAiSection('audio')}>
            Audio
          </Button>
        </ButtonGroup>
      </AnimatedBorderBox>

      <Button
        id={'prompt-builder-button'}
        color='secondary'
        variant='text'
        onClick={setIsPromptBuilderOpen}
        sx={{ alignSelf: 'flex-end', paddingY: Theme.spacing(4) }}
      >
        {isPromptBuilderOpen ? 'Close' : 'Prompt Builder'}
      </Button>
    </CenteredFlexDiv>
  );
}
