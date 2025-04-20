package handler

import (
	lobbydata "apps/go/games-lobby/lobby-data"
	"apps/go/utils"
	"encoding/json"

	"net/http"
)

func HandleGetLobbyData(resp http.ResponseWriter, req *http.Request) {
	utils.EnableCORS(&resp)

	var activePlayersInLobby []lobbydata.ActivePlayer

	for _, playerData := range lobbydata.ActivePlayers {

		playerInLobby := lobbydata.ActivePlayer{
			Id:                 playerData.Id,
			Name:               playerData.Name,
			InLobby:            playerData.InLobby,
			Email:              playerData.Email,
			CurrentTimeEntered: playerData.CurrentTimeEntered,
			ActiveGameID:       playerData.ActiveGameID,
		}
		activePlayersInLobby = append(activePlayersInLobby, playerInLobby)
	}

	resp.Header().Set("Content-Type", "application/json")
	resp.WriteHeader(http.StatusOK)

	json.NewEncoder(resp).Encode(activePlayersInLobby)

}
