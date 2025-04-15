package sub

import (
	lobbydata "apps/go/games-lobby/lobby-data"
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

	subscriber := redisPubSub.Subscribe(ctx, "lobby:new-player", "lobby:delete-player")
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

		fmt.Printf("\n[%s] - Received message: %s\n\n", currentTime, msg.Payload)

		switch strings.HasPrefix(msg.Channel, "lobby:") {
		case strings.Contains(msg.Channel, "new-player"):

			var newPlayer *lobbydata.ActivePlayer
			err := json.Unmarshal([]byte(msg.Payload), &newPlayer)
			if err != nil {
				fmt.Println(err, "UNMARSHALL ERROR")
				continue
			}

			fmt.Printf("NEW PLAYER FROM REDIS: %v\n\n", newPlayer)

			err = lobbydata.AddPlayerToLobby(newPlayer)

			fmt.Printf("AFTER ADDING PLAYER TO LOBBY CALL: %s\n\n", err)

			if err != nil {
				fmt.Printf("error adding player: %s to lobby\n", newPlayer.Name)
				err := redisPubSub.Publish(ctx, "error", func() string { errMsg := fmt.Sprintf("error adding player %s to lobby", newPlayer.Name); return errMsg }()).Err()
				if err != nil {
					fmt.Println("error sending error message to nodejs")
				}
			}

			jsonResp, err := json.Marshal(lobbydata.LobbyMap[newPlayer.Id])

			if err != nil {
				fmt.Printf("json error: %v\n", err)
			}

			redisPubSub.Publish(ctx, "lobby:player-added", jsonResp).Err()

			if err != nil {
				fmt.Printf("lobby:player-added error: %v\n", err)
			}

		case strings.Contains(msg.Channel, "delete-player"):
			fmt.Println("IN DELETE")
			fmt.Println(msg.Payload)

			var playerID string = msg.Payload
			value := lobbydata.DeletePlayerFromLobby(playerID)

			fmt.Printf("VALUE AFTER DELETE FROM LOBBY CALL: %v\n\n", value)

			if value != fmt.Sprintf("Player %s deleted", playerID) {
				fmt.Printf("error deleting player %s\n", playerID)
			}
			fmt.Println("PLAYER REMOVED")
			fmt.Printf("%v", lobbydata.LobbyMap)
		}

	}
}
