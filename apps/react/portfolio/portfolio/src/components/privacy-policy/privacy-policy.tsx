import { CenteredFlexDiv } from '@aklapper/react-shared';
import { css } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import PrivacyPolicyText from '../../pages/static/privacy-policy-text.jsx';
import Theme from '../../styles/themes/theme';

/**
 * This component renders the privacy policy page as a modal dialog.
 *
 * @returns {ReactElement} The rendered PrivacyPolicy component.
 */

const PrivacyPolicy = (): ReactElement => {
  const nav = useNavigate();
  return (
    <CenteredFlexDiv
      id='privacy-policy-wrapper'
      className={css({ justifyContent: 'center', borderRadius: Theme.shape.borderRadius })}
    >
      <Box
        id={'privacy-policy'}
        className={css({
          height: '60vh',
          width: '100%',
          overflowY: 'auto',
          borderRadius: Theme.shape.borderRadius,
          '&::-webkit-scrollbar': {
            background: Theme.palette.background.default,
            borderRadius: Theme.shape.borderRadius,
          },
          '&::-webkit-scrollbar-thumb': {
            background: Theme.palette.background.paper,
            borderRadius: Theme.shape.borderRadius,
          },
        })}
      >
        <Box
          as={'section'}
          id={'privacy-policy-text-wrapper'}
          sx={{ backgroundColor: '#d1d1d1', borderRadius: Theme.shape.borderRadius }}
        >
          {PrivacyPolicyText}
          <Box
            as={'section'}
            id={'privacy-policy-button-wrapper'}
            className={css({
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '0 6',
            })}
          >
            <Box>
              <Button id={'privacy-policy-button'} color='secondary' onClick={() => nav(-1)}>
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </CenteredFlexDiv>
  );
};
export default PrivacyPolicy;
