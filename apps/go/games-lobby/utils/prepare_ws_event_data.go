package utils

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"encoding/json"
	"fmt"
)

func PrepareWsJsonEvent(event string, data any, wsError *lobbydata.WsError) (lobbydata.WsMessage, error) {
	var err error
	var wsEventJSON lobbydata.WsMessage

	jsonData, err := json.Marshal(data)
	if err != nil {
		fmt.Println("Error: ", err)
		return lobbydata.WsMessage{}, err
	}

	if wsError != nil {
		wsEventJSON.Error = wsError
	}

	wsEventJSON.Event = event
	wsEventJSON.Data = jsonData

	return wsEventJSON, nil

}
