package main

import (
	"apps/go/file-parser/routes"
	"fmt"
	"log"
	"net/http"
)

func main() {
	fmt.Println("In main function")

	http.HandleFunc("/", routes.UploadHandler)

	log.Fatal(http.ListenAndServe(":6900", nil))
}
