import Box from '@mui/material-pigment-css/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import { css } from '@pigment-css/react';
import Theme from '../../styles/themes/theme';

const PrivacyPolicyText = (
  <Box
    as={'section'}
    id={'privacy-policy-text'}
    className={css({
      padding: Theme.spacing(2),
      fontSize: '1rem',
      color: '#1f1f1f',
      textAlign: 'start',
      borderRadius: Theme.shape.borderRadius,
    })}
  >
    <Typography variant='h3' sx={{ textAlign: 'center' }}>
      Privacy Policy
    </Typography>
    <br />
    <Typography variant={'body1'}>
      This privacy policy explains how Andrew Klapper (owner of portfolio) collects, uses, and shares information when
      you authorize my developer website (
      <a href='https://andrew-k.us' style={{ color: Theme.palette.secondary.main }}>
        https://andrew-k.us
      </a>
      ) to access to your Google Calendar data.
    </Typography>
    <br />
    <Typography variant={'body1'}>
      <strong>1. Information I Collect</strong>
    </Typography>
    <Typography variant={'body1'}>
      When you sign in to{' '}
      <a href='https://andrew-k.us' style={{ color: Theme.palette.secondary.main }}>
        https://andrew-k.us
      </a>{' '}
      using Google OAuth2 and grant permission to view and manage your calendars, I collect the following information
      from your Google account:
    </Typography>
    <List>
      <ListItem divider={true} alignItems='flex-start'>
        <Typography>
          <strong>Basic Profile Information:</strong> Your name, email address, and profile picture.{' '}
        </Typography>
      </ListItem>
      <ListItem divider={true} alignItems='flex-start'>
        <Typography>
          <strong>Calendar Data:</strong> This includes the titles, dates, times, descriptions, and attendees of events
          on your calendars. I may also create new calendar events on your behalf.
        </Typography>
      </ListItem>
      <ListItem divider={true} alignItems='flex-start'>
        <Typography>
          I <strong> do not</strong> access sensitive information like locations or event notes.
        </Typography>
      </ListItem>
    </List>
    <br />
    <Typography variant={'body1'}>
      <strong>2. How I Use Your Information</strong>
    </Typography>
    <Typography variant={'body1'}>I use the information collected for the following purposes:</Typography>
    <List>
      <ListItem divider={true} alignItems='flex-start'>
        <Typography>
          <strong>Authentication:</strong> To verify your identity and allow you to access features on my website.{' '}
        </Typography>
      </ListItem>
      <ListItem divider={true} alignItems='flex-start'>
        <Typography>
          <strong>Calendar Integration:</strong> To enable features that interact with your Google Calendar, such
          as:{' '}
        </Typography>
        <List>
          <ListItem divider={true} alignItems='flex-start'>
            <Typography>
              Adding your suggested appointment time to your calendar &amp; sending me a notification to verify the time
              you request.{' '}
            </Typography>
          </ListItem>
          <ListItem divider={true} alignItems='flex-start'>
            <Typography>Allowing you to schedule consultations or meetings directly through my website. </Typography>
          </ListItem>
          <ListItem divider={true} alignItems='flex-start'>
            <Typography>
              Creating calendar reminders for important deadlines or events related to my services.
            </Typography>
          </ListItem>
        </List>
      </ListItem>
    </List>
    <br />
    <Typography variant={'body1'}>
      <strong>3. Information Sharing</strong>
    </Typography>
    <Typography variant={'body1'}>
      I <strong>do not</strong> share your personal information with any third parties, except as required by law or to
      comply with a legal process.
    </Typography>
    <br />
    <Typography variant={'body1'}>
      <strong>4. Data Security</strong>
    </Typography>
    <Typography variant={'body1'}>
      I take reasonable measures to protect your information from unauthorized access, use, or disclosure. These
      measures include:
    </Typography>
    <List>
      <ListItem divider={true} alignItems='flex-start'>
        <Typography>
          <strong>Secure Storage:</strong> Storing your data on secure servers with limited access. I only put the time
          to live for the token for 5 minutes and do not store any data. You will need to authorize every time you want
          to make an appointment request.{' '}
        </Typography>
      </ListItem>
      <ListItem divider={true} alignItems='flex-start'>
        <Typography>
          <strong>Data Minimization: </strong>Collecting only the necessary information for the purposes described in
          this policy.{' '}
        </Typography>
      </ListItem>
      <ListItem divider={true} alignItems='flex-start'>
        <Typography>
          <strong>Encryption: </strong> Using encryption to protect your data in transit and at rest.
        </Typography>
      </ListItem>
    </List>
    <br />
    <Typography variant={'body1'}>
      <strong>5. Your Choices</strong>
    </Typography>
    <Typography variant={'body1'}>
      You can revoke access to your Google Calendar data at any time by visiting your Google account settings and
      removing access for Andrew's Portfolio - Appointment Maker{' '}
      <a href='https://andrew-k.us' style={{ color: Theme.palette.secondary.main }}>
        https://andrew-k.us
      </a>
      .
    </Typography>
    <br />
    <Typography variant={'body1'}>
      <strong>6. Children&#39;s Privacy</strong>
    </Typography>
    <Typography variant={'body1'}>
      My website is not intended for children under the age of 13. I do not knowingly collect personal information from
      children.
    </Typography>
    <br />
    <Typography variant={'body1'}>
      <strong>7. Changes to this Privacy Policy</strong>
    </Typography>
    <Typography variant={'body1'}>
      I may update this privacy policy from time to time. Any changes will be posted on this page with the updated
      date.{' '}
    </Typography>
    <Typography variant={'body1'}>
      <br />
      <strong>8. Contact Me</strong>{' '}
    </Typography>
    <Typography variant={'body1'}>
      If you have any questions about this privacy policy, please contact me at{' '}
      <a href={'mailto:andrew@andrew-k.us'} style={{ color: Theme.palette.secondary.main }}>
        andrew@andrew-k.us
      </a>
    </Typography>
    <Typography variant={'body1'}>
      <strong>Effective Date:</strong> December 1st, 2024
    </Typography>
  </Box>
);

export default PrivacyPolicyText;
