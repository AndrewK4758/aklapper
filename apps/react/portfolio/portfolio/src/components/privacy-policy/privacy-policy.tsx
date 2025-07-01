import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import PrivacyPolicyText from '../../pages/static/privacy-policy-text.jsx';
import CenteredFlexDiv from '../styled/centered_flexbox';

/**
 * This component renders the privacy policy page as a modal dialog.
 *
 * @returns {ReactElement} The rendered PrivacyPolicy component.
 */

export const PrivacyPolicy = (): ReactElement => {
  const nav = useNavigate();
  return (
    <CenteredFlexDiv id='privacy-policy-wrapper' sx={{ justifyContent: 'center' }}>
      <Modal
        id={'privacy-policy-modal'}
        open={true}
        sx={{
          height: '90vh',
          width: '90vw',
          top: '5%',
          left: '5%',
          overflowY: 'scroll',
        }}
      >
        <Box component={'section'} id={'privacy-policy-modal-wrapper'} sx={{ backgroundColor: '#d1d1d1' }}>
          <PrivacyPolicyText />
          <Box
            component={'section'}
            id={'privacy-policy-button-wrapper'}
            display={'flex'}
            justifyContent={'flex-end'}
            paddingX={6}
          >
            <Box className='animated-border'>
              <Button id={'privacy-policy-button'} onClick={() => nav(-1)}>
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
    </CenteredFlexDiv>
  );
};
export default PrivacyPolicy;
