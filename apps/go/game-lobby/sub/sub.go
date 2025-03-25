package sub

import (
	lobbydata "apps/go/game-lobby/lobby-data"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

func Sub() {
	ctx := context.Background()

	redisPubSub := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	subscriber := redisPubSub.Subscribe(ctx, "lobby:new-player", "lobby:remove-player")
	defer subscriber.Close()
	ch := subscriber.Channel()

	fmt.Println("Listening for 'lobby:*' messages")

	est, err := time.LoadLocation("America/New_York")
	if err != nil {
		fmt.Println("Error loading IST timezone:", err)
		return
	}

	currentTime := time.Now().In(est).Format("January 2, 2006 03:04:05 PM")

	for msg := range ch {
		fmt.Printf("[%s] - Received message: %s\n", currentTime, msg.Payload)

		// if err != nil {
		// 	fmt.Printf("[%s] - Error receiving message: %s\n", currentTime, err.Error())
		// 	continue
		// }

		switch strings.HasPrefix(msg.Channel, "lobby:") {
		case strings.Contains(msg.Channel, "new-player"):

			var newPlayer *lobbydata.ActivePlayer
			err := json.Unmarshal([]byte(msg.Payload), &newPlayer)
			if err != nil {
				fmt.Println(err, "UNMARSHALL ERROR")
				continue
			}

			err = lobbydata.AddPlayerToLobby(newPlayer)

			if err != nil {
				fmt.Println("error adding player to lobby")
				err := redisPubSub.Publish(ctx, "error", "error adding player to lobby").Err()
				if err != nil {
					fmt.Println("error sending error message to nodejs")
				}
			}

			var lobbyMapObjects []lobbydata.ActivePlayer

			for _, Player := range lobbydata.LobbyMap {
				lobbyMapObjects = append(lobbyMapObjects, *Player)
			}

			jsonResp, err := json.Marshal(lobbyMapObjects)
			fmt.Println("LOBBY MAP: ", string(jsonResp))
			println("\n")

			if err != nil {
				fmt.Printf("json error: %v\n", err)
			}

			redisPubSub.Publish(ctx, "lobby:player-added", jsonResp).Err()

			if err != nil {
				fmt.Printf("lobby:player-added error: %v\n", err)
			}

		case strings.Contains(msg.Channel, "remove-player"):
			fmt.Println("PLAYER REMOVED")
		}

	}
}
