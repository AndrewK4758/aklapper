package sub

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

func Sub() {
	ctx := context.Background()

	redisDB := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	subscriber := redisDB.Subscribe(ctx, "test")
	defer subscriber.Close()

	fmt.Println("Listening for messages...")

	est, err := time.LoadLocation("America/New_York")
	if err != nil {
		fmt.Println("Error loading IST timezone:", err)
		return
	}

	currentTime := time.Now().In(est).Format("January 2, 2006 03:04:05 PM")

	for {
		msg, err := subscriber.ReceiveMessage(ctx)
		if err != nil {
			fmt.Printf("[%s] - Error receiving message: %s\n", currentTime, err.Error())
			continue
		}

		switch msg.Channel {
		case "test":
			var player Player

			player.name = msg.Payload
			handlePlayerRegistered(player)
		}

		fmt.Printf("[%s] - Received message: %s\n", currentTime, msg.Payload)
	}
}

type Player struct {
	name string
}

func handlePlayerRegistered(player Player) {

	fmt.Printf("\nPlayer Registered: %v\n\n", player.name)
}
