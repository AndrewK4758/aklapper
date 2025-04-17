package utils

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"encoding/json"
	"fmt"
)

func PrepareWsJsonEvent(event string, data any, wsError *lobbydata.WsError) (lobbydata.WsEventJSON, error) {
	var err error
	var wsEventJSON lobbydata.WsEventJSON

	jsonData, err := json.Marshal(data)
	if err != nil {
		fmt.Println("Error: ", err)
		return lobbydata.WsEventJSON{}, err
	}

	if wsError != nil {
		errorData, err := json.Marshal(wsError)
		if err != nil {
			fmt.Println("Error: ", err)
			return lobbydata.WsEventJSON{}, err
		}

		wsEventJSON.Error = errorData

	}

	wsEventJSON.Event = event
	wsEventJSON.Data = jsonData

	return wsEventJSON, nil

}
