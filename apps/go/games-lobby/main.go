package main

import (
	handler "apps/go/games-lobby/handler"
	"log"
	"net/http"
	// pub "apps/go/game-lobby/pub"
	// "sync"
)

// WHEN PLAYER IS REGISTERED IN EXPRESS API, SEND A WEBSOCKET EVENT TO GO GAME LOBBY WITH PLAYER NAME
// TO UPDATE THE LOBBY WITH THE NEW PLAYER NAME AND FLAGS OF LOOKING FOR GAME OR WAITING TO START

// GROUP PLAYERS WAITING FOR GAME TO START TOGETHER UNDER THE GAME NAME /ID & GROUP PLAYERS WAITING TO SELECT
// OR ENTER A CREATED GAME

// WHEN GAME IS REGISTERED, SEND WEBSOCKET EVENT WITH GAME ID TO GAME LOBBY TO ADVERTISE THE GAME
// AND PLAYER NAME WHO CREATED THE GAME

// WHEN GAME IS STARTED, REMOVE THE GAME ID AND ALL PLAYER NAMES FROM THE LOBBY

func main() {

	// var wg sync.WaitGroup

	// wg.Add(1)

	// go func() {
	// 	sub.Sub()
	// }()

	// wg.Add(1)

	// go func() {
	println("Listening on port 6900")

	http.HandleFunc("/lobby", handler.HandleGetLobbyData)

	http.HandleFunc("/ws/lobby", handler.HandleWebsocketConnections)

	log.Fatal(http.ListenAndServe(":6900", nil))

	// }()

	// wg.Wait()
}
