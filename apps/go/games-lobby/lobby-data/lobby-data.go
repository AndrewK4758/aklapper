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
		println("player doesnt exist")
		newPlayer.InLobby = true
		LobbyMap[newPlayer.Id] = newPlayer

		for key, value := range LobbyMap {
			fmt.Printf("Key: %s\nValue: %v\n\n", key, value)
		}
	}
	return nil
}

func DeletePlayerFromLobby(id string) string {

	player, existsBefore := LobbyMap[id]
	fmt.Printf("\n%v\n\n", player)
	if !existsBefore {
		errMsg := fmt.Sprintf("player %s doesn't exist in lobby map", id)
		return errMsg
	}
	delete(LobbyMap, id)
	player, existsAfter := LobbyMap[id]
	fmt.Printf("\n%v\n\n", player)
	if existsAfter {
		errMsg := fmt.Sprintf("player %s exists after delete in lobby map", id)
		return errMsg
	}

	if existsBefore && !existsAfter {
		return fmt.Sprintf("Player %s deleted", id)
	} else if !existsBefore {
		return fmt.Sprintf("Player %s not in map", id)
	} else {
		return "Unexpected state error"
	}

}
