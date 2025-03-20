package pub

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

func Pub() {
	ctx := context.Background()

	redisDB := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	scanner := bufio.NewScanner(os.Stdin)
	fmt.Println("Enter messages to send to the subscriber. Type 'exit' to quit.")

	for scanner.Scan() {
		message := scanner.Text()

		if message == "exit" {
			break
		}

		est, err := time.LoadLocation("America/New_York")
		if err != nil {
			fmt.Println("Error loading IST timezone:", err)
			return
		}

		currentTime := time.Now().In(est).Format("January 2, 2006 03:04:05 PM")

		err = redisDB.Publish(ctx, "test", message).Err()
		if err != nil {
			fmt.Printf("[%s] - Error publishing test message:%s\n", currentTime, err.Error())
			continue
		}

		fmt.Printf("[%s] - Message published: [%s]\n", currentTime, message)
	}
}
