package events

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"encoding/json"
	"fmt"

	"github.com/gorilla/websocket"
)

func HandleEnterLobby(ws *websocket.Conn, eventData lobbydata.WsMessage) {
	var err error
	var activePlayer lobbydata.ActivePlayer
	var eventError lobbydata.WsError

	jsonPlayer, err := json.Marshal(eventData.Data)
	if err != nil {
		fmt.Println("error marshalling ActivePlayer data: ", err)

	}

	err = json.Unmarshal(jsonPlayer, &activePlayer)
	if err != nil {
		fmt.Println("Error unmarshalling Active Player data. Error: ", err.Error())
	}

	err = lobbydata.AddPlayerToLobby(&activePlayer)
	if err != nil {
		fmt.Println("Error adding ActivePlayer to lobby. Error: ", err.Error())

		eventError.Name = "AddPlayerToLobby"
		eventError.Reason = err.Error()

		event := lobbydata.WsMessage{
			Event: "error",
			Data:  nil,
			Error: &eventError,
		}

		ws.WriteJSON(event)
		return
	}

	activePlayer.InLobby = true

	eventAck := lobbydata.WsAck{Status: "success", Event: activePlayer.Id, Response: true}

	event := lobbydata.WsMessage{
		Event: "player-added",
		Data:  eventAck,
	}

	ws.WriteJSON(event)
}
