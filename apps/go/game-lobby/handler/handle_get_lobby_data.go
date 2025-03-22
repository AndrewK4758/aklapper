package handler

import (
	lobbydata "apps/go/game-lobby/lobby-data"
	"apps/go/utils"
	"encoding/json"
	"fmt"
	"net/http"
)

type ActivePlayerInLobby struct {
	Id   string
	Name string
}

func HandleGetLobbyData(resp http.ResponseWriter, req *http.Request) {
	utils.EnableCORS(&resp)

	var activePlayersInLobby []ActivePlayerInLobby

	for playerID, playerData := range lobbydata.LobbyMap {

		fmt.Printf("\n%s\n", playerID)

		playerInLobby := ActivePlayerInLobby{
			Id:   playerID,
			Name: playerData.Name,
		}

		fmt.Printf("\n%v\n", playerInLobby)
		activePlayersInLobby = append(activePlayersInLobby, playerInLobby)
	}

	resp.Header().Set("Content-Type", "application/json")
	resp.WriteHeader(http.StatusOK)

	json.NewEncoder(resp).Encode(activePlayersInLobby)

	fmt.Printf("%v", activePlayersInLobby)
}
