package upload

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"sync"
)

func enableCORS(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, PATCH, HEAD, DELETE")
	(*w).Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
}

func UploadHandler(resp http.ResponseWriter, req *http.Request) {
	var err error
	errChan := make(chan error)
	enableCORS(&resp)

	curDir, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current working directory: %v", err.Error())
	}

	filePath := curDir + "/files"

	tmpDir, err := os.MkdirTemp(filePath, "")
	if err != nil {
		fmt.Printf("error creating tmp directory: %v", err.Error())
	}

	defer os.RemoveAll(tmpDir)

	currentPath := req.URL.Path
	fmt.Printf("Current Path: %s\n", currentPath)

	err = req.ParseMultipartForm(int64(25000))
	if err != nil {
		fmt.Printf("err: %v\n", err)
		http.Error(resp, err.Error(), http.StatusBadRequest)
	}

	formData := req.MultipartForm
	defer formData.RemoveAll()

	if formData != nil {
		var wg sync.WaitGroup
		files := formData.File["files"]

		for fileNum, fileHeader := range files {
			fileBuffer := new(bytes.Buffer)
			fmt.Printf("File number: %d started upload\n", fileNum)

			wg.Add(1)

			Worker(fileNum, &wg, fileHeader, fileBuffer, tmpDir, errChan)

		}

		go func() {
			wg.Wait()
			close(errChan)
		}()

		for err = range errChan {
			if err = <-errChan; err != nil {
				fmt.Printf("error uploading file: %v\n", err.Error())

			}
		}
	}
	print("\nALL FILES UPLOADED\n")
}
