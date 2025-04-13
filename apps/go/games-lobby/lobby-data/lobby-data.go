package lobbydata

import (
	"fmt"
)

type ActivePlayer struct {
	Name               string
	Id                 string
	ActiveGameID       *string
	InLobby            bool
	CurrentTimeEntered string
	Email              string
}

var LobbyMap = map[string]*ActivePlayer{}

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

	_, ok := LobbyMap[newPlayer.Id]

	if ok {
		err = fmt.Errorf("player already exists in game lobby")
		return err
	} else {
		newPlayer.InLobby = true
		LobbyMap[newPlayer.Id] = newPlayer
	}
	return nil
}

func DeletePlayerFromLobby(id string) string {
	_, existsBefore := LobbyMap[id]
	delete(LobbyMap, id)
	_, existsAfter := LobbyMap[id]

	if existsBefore && !existsAfter {
		return fmt.Sprintf("Player %s deleted", id)
	} else if !existsBefore {
		return fmt.Sprintf("Player %s not in map", id)
	} else {
		return "Unexpected state error"
	}

}
