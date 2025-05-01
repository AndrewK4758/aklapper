package events

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"encoding/json"
	"fmt"

	websocket "github.com/gorilla/websocket"
)

type NewGameData struct {
	PlayerId string               `json:"playerId"`
	NewGame  lobbydata.ActiveGame `json:"newGame"`
}

func HandeNewGame(ws *websocket.Conn, eventData lobbydata.WsMessage) {
	var err error
	var eventError lobbydata.WsError
	var newGame NewGameData

	jsonGame, err := json.Marshal(eventData.Data)
	if err != nil {
		fmt.Println("error marshalling GameInstanceLobbyData: ", err.Error())
	}

	err = json.Unmarshal(jsonGame, &newGame)
	if err != nil {
		fmt.Println("error UnMarshalling GameInstanceLobbyData: ", err.Error())
	}

	err = lobbydata.AddGameToMap(&newGame.NewGame)

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

	player := lobbydata.ActivePlayers[newGame.PlayerId]

	player.ActiveGameID = &newGame.NewGame.GameInstanceID

	eventAck := lobbydata.WsAck{Status: "success", Event: newGame.NewGame.GameInstanceID, Response: true}

	event := lobbydata.WsMessage{
		Event: "game-added",
		Data:  eventAck,
	}

	ws.WriteJSON(event)
}
