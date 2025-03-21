package lobbydata

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

func AddPlayerToLobby(newPlayer *ActivePlayer) {
	LobbyMap[newPlayer.Id] = newPlayer
}
