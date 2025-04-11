import ActivePlayers from '../data/active_players/active_players.js';

const activePlayers = new ActivePlayers();

export default function useActivePlayersMap() {
  return activePlayers;
}
