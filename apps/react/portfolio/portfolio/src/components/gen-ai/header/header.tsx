import { Text } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Divider from '@mui/material/Divider';
import { useNavigate } from 'react-router';
import { body, title } from '../../../pages/static/gen-ai-text';
import Theme from '../../../styles/themes/theme';
import AnimatedBorderBox from '../../styled/animated_border_box';
import StyledCard from '../../styled/styled_card';

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
    <StyledCard sx={{ display: 'flex', flexDirection: 'column', paddingX: Theme.spacing(4) }}>
      <Box
        as={'section'}
        id='gen-ai-title-wrapper'
        sx={{ display: 'flex', alignItems: 'center', padding: Theme.spacing(4) }}
      >
        <Text variant='h4' children={title} sx={{ flex: '0 1 25%' }} />
        <Divider orientation='vertical' flexItem />
        <Text
          id='gen-ai-header-text'
          variant='body1'
          children={body}
          sx={{ flex: '0 1 75%', padding: Theme.spacing(4) }}
        />
      </Box>

      <AnimatedBorderBox>
        <ButtonGroup id={'gen-ai-button-group'} color='primary' fullWidth={true}>
          <Button variant='text' id='gen-ai-text-button' onClick={() => handleNavToGenAiSection('text')}>
            Text
          </Button>
          <Button variant='text' id='gen-ai-image' onClick={() => handleNavToGenAiSection('text')}>
            Image
          </Button>
          <Button variant='text' id='gen-ai-audio' onClick={() => handleNavToGenAiSection('audio')}>
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
    </StyledCard>
  );
}
