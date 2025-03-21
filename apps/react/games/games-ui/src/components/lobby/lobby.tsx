import Box from '@mui/material/Box';

// Components of lobby
// - Active players in lobby
// - Active games looking for players
// - Join game functionality (mouse or keyboard)
// - pub/sub & websocket event handling and emitting
// -- Emit event when player enters lobby
// -- Emit event when game is created to inLobby players not in game
// -- Emit event when player leaves lobby
// -- Mesaging between players
// -- Remove players from lobby if in active game
// --- Create closed messaging group for players in active game
// --- Connect to game instance websocket when player selects game instance

export default function Lobby() {
  return (
    <Box component={'div'} id="lobby-wrapper">
      <Box component={'section'} id="players-in-lobby-wrapper"></Box>
      <Box component={'section'} id="active-games-not-started-wrapper"></Box>
      <Box component={'section'} id="lobby-messages-wrapper"></Box>
    </Box>
  );
}
