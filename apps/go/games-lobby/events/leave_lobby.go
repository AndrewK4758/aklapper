package events

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"fmt"

	"github.com/gorilla/websocket"
)

func HandleLeaveLobby(ws *websocket.Conn, eventData lobbydata.WsMessage) {
	var err error
	var eventError lobbydata.WsError

	playerID := eventData.Data.(string)

	_, err = lobbydata.DeletePlayerFromLobby(playerID)
	if err != nil {

		eventError.Name = "DeletePlayerFromLobby"
		eventError.Reason = err.Error()

		errorToSend := lobbydata.WsMessage{
			Event: "error",
			Data:  nil,
			Error: &eventError,
		}

		ws.WriteJSON(errorToSend)

		fmt.Printf("error un-marshalling playerID data: %v", err)
		return
	}

	activePlayers := []lobbydata.ActivePlayer{}

	for _, activePlayer := range lobbydata.ActivePlayers {
		activePlayers = append(activePlayers, *activePlayer)
	}

	eventAck := lobbydata.WsAck{Status: "success", Event: playerID, Response: activePlayers}

	event := lobbydata.WsMessage{
		Event: "deleted-player",
		Data:  eventAck,
	}

	ws.WriteJSON(event)
}
