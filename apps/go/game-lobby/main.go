package main

import (
	lobbydata "apps/go/game-lobby/lobby-data"
	pub "apps/go/game-lobby/pub"
	sub "apps/go/game-lobby/sub"
	"fmt"
	"sync"
)

// WHEN PLAYER IS REGISTERED IN EXPRESS API, SEND A WEBSOCKET EVENT TO GO GAME LOBBY WITH PLAYER NAME
// TO UPDATE THE LOBBY WITH THE NEW PLAYER NAME AND FLAGS OF LOOKING FOR GAME OR WAITING TO START

// GROUP PLAYERS WAITING FOR GAME TO START TOGETHER UNDER THE GAME NAME /ID & GROUP PLAYERS WAITING TO SELECT
// OR ENTER A CREATED GAME

// WHEN GAME IS REGISTERED, SEND WEBSOCKET EVENT WITH GAME ID TO GAME LOBBY TO ADVERTISE THE GAME
// AND PLAYER NAME WHO CREATED THE GAME

// WHEN GAME IS STARTED, REMOVE THE GAME ID AND ALL PLAYER NAMES FROM THE LOBBY

func main() {

	p1 := lobbydata.CreateActivePlayer("Player 1 Name", "player-1-id", nil, true, "12:00:00am")

	lobbydata.AddPlayerToLobby(p1)

	for key, values := range lobbydata.LobbyMap {
		fmt.Printf("KEY: %s\nVALUES: %v", key, values)
	}

	var wg sync.WaitGroup

	wg.Add(1)

	go func() {
		pub.Pub()
	}()

	wg.Add(1)

	go func() {
		sub.Sub()
	}()

	wg.Wait()
}
