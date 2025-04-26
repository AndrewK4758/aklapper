package events

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"fmt"

	"github.com/gorilla/websocket"
)

func HandleSyncLobbyData(ws *websocket.Conn, msgData lobbydata.WsMessage) {
	var err error
	activePlayers := []lobbydata.ActivePlayer{}
	activeGames := []lobbydata.ActiveGame{}

	for _, playerPtr := range lobbydata.ActivePlayers {

		activePlayers = append(activePlayers, *playerPtr)
	}

	for _, gamePtr := range lobbydata.GamesMap {

		activeGames = append(activeGames, *gamePtr)
	}

	ClientLobbyData := &lobbydata.ClientLobbyData{
		ActiveGamesInLobby:   activeGames,
		ActivePlayersInlobby: activePlayers,
	}

	Response := lobbydata.WsAck{
		Event:    "data-sync-response",
		Status:   "success",
		Response: ClientLobbyData,
	}

	Event := lobbydata.WsMessage{
		Event: "data-sync-response",
		Data:  Response,
	}

	err = ws.WriteJSON(Event)
	if err != nil {
		fmt.Printf("\nError sending data-sync-response: %v\n", err)
	}
}
