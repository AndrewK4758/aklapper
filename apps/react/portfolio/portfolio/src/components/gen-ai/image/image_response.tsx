import { CenteredFlexDiv, StyledCard, Text, Waiting } from '@aklapper/react-shared';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import Box from '@mui/material-pigment-css/Box';
import IconButton from '@mui/material/IconButton';
import { useActionData, useNavigation } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import { BOX_SHADOW_MAIN } from '../../../styles/base/base_styles';
import Theme from '../../../styles/themes/theme';

export default function ImageResponse() {
  const { state } = useNavigation();
  const pics = useActionData() as string[];
  console.log(pics);
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
                boxShadow: BOX_SHADOW_MAIN,
              }}
            >
              <CenteredFlexDiv sx={{ justifyContent: 'center', p: 0, gap: Theme.spacing(2) }}>
                <IconButton
                  color='secondary'
                  onClick={() => handleDownloadImage(pic, i)}
                  sx={{ alignSelf: 'flex-end', fontSize: '2rem' }}
                >
                  <SaveAltIcon fontSize='inherit' />
                </IconButton>
                <img src={`data:image/png;base64, ${pic}`} alt={`generated from prompt entered ${i}`} />
              </CenteredFlexDiv>
            </StyledCard>
          ))}
        </CenteredFlexDiv>
      )}
    </>
  );
}

type Base64ImageString = string;

function handleDownloadImage(imgStr: Base64ImageString, imageNumber: number) {
  const dataStr = atob(imgStr);
  const byteData = new Uint8Array(dataStr.length);

  for (let i = 0; i < byteData.length; i++) {
    byteData[i] = dataStr.charCodeAt(i);
  }

  const blob = new Blob([byteData], { type: 'image/png' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `image_${imageNumber}.png`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
