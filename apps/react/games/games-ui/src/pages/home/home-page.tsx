import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import type { SxProps } from '@mui/material/styles';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useState } from 'react';
import LoginPlayer from '../../components/login/login';
import RegisterPlayer from '../../components/register-player/register-player';

const Home = () => {
  const [tab, setTab] = useState<number>(0);

  return (
    <Box
      component={'div'}
      id='home-page-wrapper'
      sx={{ display: 'flex', flexDirection: 'column', gap: 10, paddingY: 4 }}
    >
      <Box component={'section'} id='home-page-instructions-register-wrapper' sx={{ display: 'flex' }}>
        <Card component={'section'} id='home-page-instructions-wrapper'>
          <CardHeader
            component='section'
            title={<Text titleVariant='h2' component={'h2'} titleText='Instructions' sx={{ textAlign: 'center' }} />}
          />
          <Divider variant='middle' />
          <List component={'ul'} id='intructions-list' sx={{ paddingY: 4, fontSize: '1.25rem' }}>
            <ListItem component={'li'} id='instruction-1'>
              Submit your player name to enter the Game Lobby
            </ListItem>
            <ListItem component={'li'} id='instruction-2'>
              You can join a game looking for players or create a game for others to join
            </ListItem>
            <ListItem component={'li'} id='instruction-3'>
              The Game Lobby has private messaging to communicate with other active players
            </ListItem>
            <ListItem component={'li'} id='instruction-4'>
              Player is data is erased once when you leave the lobby using the button
            </ListItem>
          </List>
        </Card>
        <Container
          component={'section'}
          id='home-page-register-player-wrapper'
          sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <Tabs
            centered
            variant='fullWidth'
            value={tab}
            onChange={(_, newVal) => {
              setTab(newVal);
            }}
          >
            <Tab label={'Register'} tabIndex={1} {...tabProps(0)} />
            <Tab label={'Login'} tabIndex={2} {...tabProps(1)} />
          </Tabs>
          <RegisterPlayer method={'POST'} index={0} tab={tab} inputSx={registerPlayerFormSxProps} />
          <LoginPlayer method='POST' index={1} tab={tab} inputSx={registerPlayerFormSxProps} />
        </Container>
      </Box>
    </Box>
  );
};

export default Home;

const registerPlayerFormSxProps: SxProps = {
  width: '100%',
};

const tabProps = (index: number) => ({ id: `simple-tab-${index}`, 'aria-controls': `simple-tabpanel-${index}` });
