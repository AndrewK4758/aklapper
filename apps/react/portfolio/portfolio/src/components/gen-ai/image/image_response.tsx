import { Text, Waiting } from '@aklapper/react-shared';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { useActionData, useNavigation } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import { BOX_SHADOW_MAIN } from '../../../styles/base/base_styles';
import Theme from '../../../styles/themes/theme';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import StyledCard from '../../styled/styled_card';

export default function ImageResponse() {
  const { state } = useNavigation();
  const pics = useActionData() as string[];
  return (
    <>
      {state === 'submitting' && (
        <Box as={'span'} id='image-gen-generating-box'>
          <Text component={'h4'} variant='h4' children={'Generating Images'} sx={{ textAlign: 'center' }} />
          <Waiting src={waiting} />
        </Box>
      )}

      {pics && state !== 'submitting' && (
        <CenteredFlexDiv id='generated-images' as={'section'}>
          {pics.map((pic, i) => (
            <StyledCard
              key={`generated-image-${i}`}
              sx={{
                padding: Theme.spacing(10),
                // backgroundColor: Theme.palette.background.paper,
                boxShadow: BOX_SHADOW_MAIN,
              }}
            >
              <CenteredFlexDiv sx={{ justifyContent: 'center' }}>
                <Button endIcon={<SaveAltIcon sx={{ scale: 2 }} />} sx={{ alignSelf: 'flex-end', fontSize: '2rem' }}>
                  Save
                </Button>
                <img src={`data:image/png;base64, ${pic}`} alt={`generated from prompt entered ${i}`} />
              </CenteredFlexDiv>
            </StyledCard>
          ))}
        </CenteredFlexDiv>
      )}
    </>
  );
}
