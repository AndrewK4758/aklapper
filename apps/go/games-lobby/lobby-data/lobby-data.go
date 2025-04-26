package lobbydata

import (
	"fmt"
)

/*
-----------PLAYERS------------
*/
type ActivePlayer struct {
	Name               string  `json:"name"`
	Id                 string  `json:"id"`
	ActiveGameID       *string `json:"activeGameId"`
	InLobby            bool    `json:"inLobby"`
	CurrentTimeEntered string  `json:"currentTimeEntered"`
	Email              string  `json:"email"`
}

var ActivePlayers = map[string]*ActivePlayer{}

func CreateActivePlayer(name string, id string, email string, activeGameID *string, inLobby bool, currentTimeEntered string) *ActivePlayer {
	return &ActivePlayer{
		Name:               name,
		Id:                 id,
		ActiveGameID:       activeGameID,
		InLobby:            inLobby,
		CurrentTimeEntered: currentTimeEntered,
		Email:              email,
	}

}

func AddPlayerToLobby(newPlayer *ActivePlayer) error {
	var err error

	_, exists := ActivePlayers[newPlayer.Id]

	if exists {
		err = fmt.Errorf("player already exists in game lobby")
		return err
	} else {

		newPlayer.InLobby = true
		ActivePlayers[newPlayer.Id] = newPlayer
		return nil
	}
}

func DeletePlayerFromLobby(id string) (bool, error) {

	_, existsBefore := ActivePlayers[id]

	if !existsBefore {
		return false, fmt.Errorf("player %s doesn't exist in lobby map", id)
	}

	delete(ActivePlayers, id)
	_, existsAfter := ActivePlayers[id]

	if existsAfter {
		return false, fmt.Errorf("player %s exists after delete in lobby map", id)
	}

	if existsBefore && !existsAfter {
		return true, nil
	} else if !existsBefore {
		return false, fmt.Errorf("player %s not in map", id)
	} else {
		return false, fmt.Errorf("unexpected state error")
	}
}

/*
-----------WEBSOCKET------------
*/

type WsError struct {
	Reason string
	Name   string
}

type WsAck struct {
	Event    string `json:"event"`
	Status   string `json:"status"`
	Response any    `json:"response"`
}

type WsMessage struct {
	Event string   `json:"event"`
	Data  any      `json:"data,omitempty"`
	Error *WsError `json:"error,omitzero"`
}

type ClientLobbyData struct {
	ActiveGamesInLobby   []ActiveGame   `json:"activeGamesInLobby"`
	ActivePlayersInlobby []ActivePlayer `json:"activePlayersInLobby"`
}

/*
-----------GAMES------------
*/

type ActiveGame struct {
	GameName       string         `json:"gameName"`
	GameInstanceID string         `json:"gameInstanceID"`
	InLobby        bool           `json:"inLobby"`
	PlayersArray   []ActivePlayer `json:"playersArray"`
}

var GamesMap = map[string]*ActiveGame{}

func AddGameToMap(newGame *ActiveGame) error {
	var err error

	_, exists := GamesMap[newGame.GameInstanceID]

	if exists {
		err = fmt.Errorf("game already exists in gamesmap")
		return err
	} else {

		GamesMap[newGame.GameInstanceID] = newGame
		return nil
	}
}
