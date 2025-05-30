import { RenderList, Text } from '@aklapper/react-shared';
import type {
  ClientLobbyData,
  GameInstanceLobbyData,
  IPlayerClientData,
  JoinGameData,
  PlayerID,
  PrivateMessageDetails,
} from '@aklapper/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { useContext, useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { useRouteLoaderData } from 'react-router';
import PrivateMessageModal from '../../components/messages/private_message';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../context/active-player-context';
import { MessageContext, type MessagesContextProps } from '../../context/messages_context';
import { WebsocketContext, type WebsocketContextProps } from '../../context/websocket_context';
import GamesList from '../games_list';

// Components of lobby
// X Active players in lobby
// - Active games looking for players
// - Join game functionality (mouse or keyboard)
// - pub/sub & we bsocket event handling and emitting
// X Emit event when player enters lobby
// X Emit event when game is created to inLobby players not in game
// X Emit event when player leaves lobby
// X Mesaging between players
// -- Remove players from lobby if in active game
// X- Create closed messaging group for players in active game
// --- Create websocket namespace or path for each active game ID and connect players on join

// X Emit event when game is created to inLobby players not in game
// X Remove navigation to :id/register route when game is created
// X On succesful response code for registering game, display active game in UI by emit event to all players
//      with ability to join game
// ---- All active games will have ability for player to join with button
// ---- Game will automatically emit event once max players reached and remove ability to connect with game from ui
// ---- Redirect game with players to avatar registration page according to game

export default function Lobby() {
  const { activeGamesInLobby, activePlayersInLobby } = useRouteLoaderData('lobby') as ClientLobbyData;
  const { activePlayer, addActivePlayer, removeFromLobby } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const { addMessage, messages } = useContext<MessagesContextProps>(MessageContext);
  const { addExtraHeaders, socket } = useContext<WebsocketContextProps>(WebsocketContext);

  const [activeLobby, setActiveLobby] = useState<IPlayerClientData[]>(activePlayersInLobby);
  const [openMessage, setOpenMessage] = useState<boolean>(false);
  const [messageTarget, setMessageTarget] = useState<PrivateMessageDetails | null>(null);
  const [activeGames, setActiveGames] = useState<GameInstanceLobbyData[]>(activeGamesInLobby);

  useEffect(() => {
    if (!socket.connected && activePlayer.id) {
      addExtraHeaders(activePlayer.id);
      socket.connect();

      socket.on('connect', () => {
        console.log(`Websocket Connected to path: /lobby with id: ${socket.id}`);
        activePlayer.inLobby = true;
        activePlayer.socketIoId = socket.id as string;
        addActivePlayer({ ...activePlayer });
      });

      socket.emit('enter-lobby', activePlayer);

      socket.on('new-player', (newPlayer: IPlayerClientData) => {
        setActiveLobby(prevLobby =>
          !prevLobby.some(p => p.id === newPlayer.id) ? [...prevLobby, newPlayer] : [...prevLobby],
        );
      });

      socket.on('private-message', (message: PrivateMessageDetails) => {
        addMessage(message);
      });

      socket.on('deleted-player', (playerId: PlayerID) => {
        setActiveLobby(prevLobby => [...prevLobby.filter(p => p.id !== playerId)]);
      });

      socket.on('new-game', ({ gameInstanceID, gameName, playersArray, inLobby }: GameInstanceLobbyData) => {
        sessionStorage.setItem('joined-game', JSON.stringify({ joinedGameId: gameInstanceID }));
        addActivePlayer({ ...activePlayer, activeGameID: gameInstanceID });
        setActiveGames(prevGamesLobby =>
          !prevGamesLobby.some(g => g.gameInstanceID === gameInstanceID)
            ? [...prevGamesLobby, { gameInstanceID, gameName, playersArray, inLobby }]
            : [...prevGamesLobby],
        );
      });

      socket.on('player-joined', ({ gameId, joiningPlayer }: JoinGameData) => {
        setActiveGames(prevGamesLobby => {
          //find the game instance players array in the prev state
          const gameToUpdate = prevGamesLobby.find(g => g.gameInstanceID === gameId);
          if (gameToUpdate) {
            //add the player to the players array for game instance
            gameToUpdate.playersArray = [...gameToUpdate.playersArray, joiningPlayer];

            //filter the game out of the prev lobby state in order to re add it with the updated players array
            //this is done in order to keep the entire game instance as state objects. if i broke up the players
            // array from the instance, i would need to manage a sync between player array state and game instance state
            const newGameLobby = prevGamesLobby.filter(g => g.gameInstanceID !== gameId);

            //add the updated game back to the active games state
            return [...newGameLobby, gameToUpdate];
            //if no game instance found in the prev state, do nothing
          } else return [...prevGamesLobby];
        });
      });

      socket.on('no-game', () => {
        console.log('game not found');
      });
      socket.on('disconnect', () => {
        console.log('disconnecting');
      });
    }
    return () => {
      console.log('cleanup called');
      if (socket.connected) {
        socket.emit('remove-player', activePlayer.id);
        removeFromLobby();
        socket.disconnect();
        socket.removeAllListeners();
        sessionStorage.removeItem('joined-game');
      }
    };
  }, []);

  return (
    <>
      <Box component={'div'} key={'lobby'} id='lobby-wrapper' flex={1} display={'flex'} flexDirection={'column'}>
        <Box component={'section'} id='lobby-header-wrapper' display={'flex'} alignItems={'flex-end'}>
          <Box component={'section'} id='players-in-lobby-wrapper' flex={'0 1 27%'} textAlign={'left'}>
            <Text titleText={'Players'} titleVariant='h2' component={'h2'} sx={{ paddingLeft: 4 }} />
          </Box>
          <Box component={'section'} id='game-list-title-wrapper' flex={'0 1 73%'}>
            <Text component={'h2'} titleVariant='h2' titleText={'Games'} sx={{ textAlign: 'center' }} />
          </Box>
        </Box>
        <Divider />

        <Box component={'section'} id='lobby-data-wrapper' display={'flex'} flexDirection={'column'} flex={1}>
          <Divider textAlign='left' flexItem orientation='vertical' />
          <Box display={'flex'} flex={1}>
            <Box component={'section'} id='players-wrapper' flex={'0 1 27%'} display={'flex'} flexDirection={'column'}>
              <RenderList<IPlayerClientData>
                data={activeLobby}
                listMapCallback={(e, i, arr) =>
                  playersMapCallback(e, i, arr, activePlayer, setOpenMessage, setMessageTarget)
                }
              />
            </Box>

            <Box
              component={'section'}
              id='active-games-not-started-wrapper'
              flex={1}
              sx={{ display: 'flex', flexDirection: 'column' }}
            >
              <GamesList activeGames={activeGames} />
            </Box>
          </Box>

          <Box component={'section'} id='lobby-messages-wrapper' flex={4} display={'flex'} flexDirection={'column'}>
            <Text titleText='Messages' titleVariant='h2' component={'h2'} sx={{ textAlign: 'left', paddingLeft: 4 }} />
            <RenderList<PrivateMessageDetails>
              data={messages}
              listMapCallback={(e, i) => messagesListCallback(e, i, activePlayer)}
            />
          </Box>
        </Box>
      </Box>

      <PrivateMessageModal open={openMessage} setOpen={setOpenMessage} messageTarget={messageTarget} />
    </>
  );
}

function playersMapCallback(
  e: IPlayerClientData,
  _i: number,
  _arr: IPlayerClientData[],
  currentPlayer: Partial<IPlayerClientData>,
  setOpenMessage: Dispatch<SetStateAction<boolean>>,
  setMessageTarget: Dispatch<SetStateAction<PrivateMessageDetails | null>>,
): ReactElement {
  const { name, id } = e;

  return (
    <Box
      component={'section'}
      id={`active-player-${name}-${id}-wrapper`}
      key={`active-player-${name}-${id}-wrapper`}
      sx={{
        borderBottom: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 1.5,
      }}
    >
      <Text
        key={`${name}-${id}`}
        titleText={name}
        titleVariant='body1'
        component={'p'}
        sx={{ textAlign: 'left', fontSize: '1.5rem' }}
      />
      {id !== currentPlayer.id && (
        <Button
          LinkComponent={'button'}
          variant='outlined'
          name={name}
          id={`message-player-${id}-button`}
          size='small'
          onClick={() =>
            handleMessageClick(
              {
                sender: {
                  senderName: currentPlayer.name as string,
                  senderId: currentPlayer.id as string,
                },
                target: {
                  targetName: name as string,
                  targetId: id as string,
                },
                message: '',
              },
              setOpenMessage,
              setMessageTarget,
            )
          }
          sx={{ fontSize: '1rem' }}
        >
          Message
        </Button>
      )}
    </Box>
  );
}

async function handleMessageClick(
  messageDetails: PrivateMessageDetails,
  setOpenMessage: Dispatch<SetStateAction<boolean>>,
  setMessageTarget: Dispatch<SetStateAction<PrivateMessageDetails | null>>,
) {
  setOpenMessage(true);
  setMessageTarget(messageDetails);
}

function messagesListCallback(
  { message, target, sender }: PrivateMessageDetails,
  i: number,
  activePlayer: IPlayerClientData,
) {
  return (
    <Box
      component={'section'}
      key={`${i}-${activePlayer.id}-${message}`}
      id='lobby-messages'
      sx={{
        display: 'flex',
        justifyContent: activePlayer.id === sender.senderId ? 'flex-start' : 'flex-end',
        alignContent: 'center',
      }}
    >
      <Box
        component={'section'}
        id={`${target.targetId}-${message}-wrapper`}
        key={`${message}-wrapper`}
        sx={{
          flex: '0 1 95%',
          padding: 1.5,
          display: 'flex',
        }}
      >
        <Divider orientation='vertical' textAlign='left' />
        <Box component={'section'} flex={1} textAlign={'left'} sx={{ paddingLeft: 1 }}>
          <Text
            component={'span'}
            titleText={sender.senderName}
            titleVariant={'body1'}
            key={`${sender.senderName}-${message}`}
          />
        </Box>

        <Box component={'section'} flex={5} textAlign={'right'} sx={{ paddingRight: 1 }}>
          <Text component={'span'} titleVariant={'body1'} titleText={message} />
        </Box>
        <Divider orientation='vertical' textAlign='right' />
      </Box>
    </Box>
  );
}
