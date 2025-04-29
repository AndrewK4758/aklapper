package events

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"encoding/json"
	"fmt"

	websocket "github.com/gorilla/websocket"
)

type UpdateInfo struct {
	GameId    string                 `json:"gameId"`
	NewPlayer lobbydata.ActivePlayer `json:"newPlayer"`
}

func HandleJoinGame(ws *websocket.Conn, eventData lobbydata.WsMessage) {
	var err error
	var updateInfo UpdateInfo

	jsonUpdateInfo, err := json.Marshal(eventData.Data)
	if err != nil {
		fmt.Println("error marshalling GameInstanceLobbyData: ", err.Error())
	}

	err = json.Unmarshal(jsonUpdateInfo, &updateInfo)
	if err != nil {
		fmt.Println("error UnMarshalling GameInstanceLobbyData: ", err.Error())
	}

	fmt.Println(updateInfo)
	ws.WriteJSON("true")
}
