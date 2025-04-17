package lobbydata

import (
	"fmt"
)

type ActivePlayer struct {
	Name               string  `json:"name"`
	Id                 string  `json:"id"`
	ActiveGameID       *string `json:"activeGameId"`
	InLobby            bool    `json:"inLobby"`
	CurrentTimeEntered string  `json:"currentTimeEntered"`
	Email              string  `json:"email"`
}

var LobbyMap = map[string]*ActivePlayer{}

type IncomingWsEvent struct {
	Event string `json:"event"`
	Data  any    `json:"data"`
}

type WsError struct {
	Reason string
	Name   string
}

type WsAck struct {
	Status   string `json:"status"`
	Response any    `json:"response"`
}

type WsEvent struct {
	Event string `json:"event"`
	Data  string `json:"data"`
}

type WsEventJSON struct {
	Event string `json:"event"`
	Data  any    `json:"data,omitempty"`
	Error any    `json:"error,omitempty"`
}

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

	_, exists := LobbyMap[newPlayer.Id]

	if exists {
		err = fmt.Errorf("player already exists in game lobby")
		return err
	} else {

		newPlayer.InLobby = true
		LobbyMap[newPlayer.Id] = newPlayer

		for key, value := range LobbyMap {
			fmt.Printf("Key: %s\nValue: %v\n\n", key, value)
		}
	}
	return nil
}

func DeletePlayerFromLobby(id string) (bool, error) {

	_, existsBefore := LobbyMap[id]

	if !existsBefore {
		return false, fmt.Errorf("player %s doesn't exist in lobby map", id)
	}

	delete(LobbyMap, id)
	_, existsAfter := LobbyMap[id]

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
