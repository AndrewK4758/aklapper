package events

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"encoding/json"
	"fmt"

	websocket "github.com/gorilla/websocket"
)

type UpdateInfo struct {
	GameId        string                 `json:"gameId"`
	JoiningPlayer lobbydata.ActivePlayer `json:"joiningPlayer"`
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

	activeGame := lobbydata.GamesMap[updateInfo.GameId]

	activePlayer := lobbydata.ActivePlayers[updateInfo.JoiningPlayer.Id]

	activePlayer.ActiveGameID = &updateInfo.GameId

	activeGame.PlayersArray = append(activeGame.PlayersArray, *activePlayer)

	eventAck := lobbydata.WsAck{
		Event:    updateInfo.GameId,
		Status:   "success",
		Response: true,
	}

	event := lobbydata.WsMessage{
		Event: "player-joined",
		Data:  eventAck,
	}

	ws.WriteJSON(event)
}
