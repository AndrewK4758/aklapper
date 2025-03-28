package handler

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"apps/go/utils"
	"encoding/json"
	"fmt"
	"net/http"
)

type ActivePlayerInLobby struct {
	Id      string
	Name    string
	InLobby bool
}

func HandleGetLobbyData(resp http.ResponseWriter, req *http.Request) {
	utils.EnableCORS(&resp)

	var activePlayersInLobby []ActivePlayerInLobby

	for playerID, playerData := range lobbydata.LobbyMap {

		playerInLobby := ActivePlayerInLobby{
			Id:      playerID,
			Name:    playerData.Name,
			InLobby: playerData.InLobby,
		}
		activePlayersInLobby = append(activePlayersInLobby, playerInLobby)
	}

	resp.Header().Set("Content-Type", "application/json")
	resp.WriteHeader(http.StatusOK)

	json.NewEncoder(resp).Encode(activePlayersInLobby)

	fmt.Printf("\nPLAYERS IN LOBBY: %v\n", activePlayersInLobby)
}
