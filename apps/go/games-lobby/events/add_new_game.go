package events

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"encoding/json"
	"fmt"

	websocket "github.com/gorilla/websocket"
)

func HandeNewGame(ws *websocket.Conn, eventData lobbydata.WsMessage) {
	var err error
	var eventError lobbydata.WsError
	var newGame lobbydata.ActiveGame

	jsonGame, err := json.Marshal(eventData.Data)
	if err != nil {
		fmt.Println("error marshalling GameInstanceLobbyData: ", err.Error())
	}

	err = json.Unmarshal(jsonGame, &newGame)
	if err != nil {
		fmt.Println("error UnMarshalling GameInstanceLobbyData: ", err.Error())
	}

	err = lobbydata.AddGameToMap(&newGame)

	if err != nil {
		eventError.Name = "AddGameToMap"
		eventError.Reason = err.Error()

		event := lobbydata.WsMessage{
			Event: "error",
			Data:  nil,
			Error: &eventError,
		}

		fmt.Println(event)
		ws.WriteJSON(event)
	}

	eventAck := lobbydata.WsAck{Status: "success", Event: newGame.GameInstanceID, Response: true}

	event := lobbydata.WsMessage{
		Event: "game-added",
		Data:  eventAck,
	}

	ws.WriteJSON(event)
}
