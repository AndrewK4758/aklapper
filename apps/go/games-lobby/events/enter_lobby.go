package events

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"encoding/json"
	"fmt"

	"github.com/gorilla/websocket"
)

func HandleEnterLobby(ws *websocket.Conn, eventData lobbydata.IncomingWsEvent) {
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

		event := lobbydata.WsEventJSON{
			Event: "error",
			Data:  nil,
			Error: eventError,
		}

		ws.WriteJSON(event)
		return
	}

	eventAck := lobbydata.WsAck{Status: "success", Response: activePlayer.Id}

	event := lobbydata.WsEventJSON{
		Event: "player-added",
		Data:  eventAck,
	}

	ws.WriteJSON(event)
}
