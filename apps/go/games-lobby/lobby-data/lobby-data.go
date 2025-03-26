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
}

var LobbyMap = map[string]*ActivePlayer{}

func CreateActivePlayer(name string, id string, activeGameID *string, inLobby bool, currentTimeEntered string) *ActivePlayer {
	return &ActivePlayer{
		Name:               name,
		Id:                 id,
		ActiveGameID:       activeGameID,
		InLobby:            inLobby,
		CurrentTimeEntered: currentTimeEntered,
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

func RemovePlayerFromLobby(playerToRemove *ActivePlayer) error {
	var err error

	_, ok := LobbyMap[playerToRemove.Id]

	if ok {
		LobbyMap[playerToRemove.Id] = nil

	} else {
		err = fmt.Errorf("player does not exist in lobby map")
		return err
	}
	return nil
}
