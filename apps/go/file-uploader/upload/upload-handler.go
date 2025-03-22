package upload

import (
	"apps/go/utils"
	"bytes"
	"fmt"
	"net/http"
	"os"
	"sync"
)

func UploadHandler(responseWriter http.ResponseWriter, req *http.Request) {
	utils.EnableCORS(&responseWriter)

	var err error
	errChan := make(chan error)

	curDir, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current working directory: %v", err.Error())
	}

	filePath := curDir + "/files"

	tmpDir, err := os.MkdirTemp(filePath, "")

	println("\n" + tmpDir + "\n")
	if err != nil {
		fmt.Printf("error creating tmp directory: %v", err.Error())
	}

	/* Remove temporary directory for file upload */
	// defer func() {
	// 	err := os.RemoveAll(tmpDir)
	// 	if err != nil {
	// 		fmt.Println("Error removing temporary directory:", err)
	// 	} else {
	// 		fmt.Println("Temporary directory removed successfully")
	// 	}
	// }()

	currentPath := req.URL.Path
	fmt.Printf("Current Path: %s\n", currentPath)

	err = req.ParseMultipartForm(int64(25000))
	if err != nil {
		fmt.Printf("err: %v\n", err)
		http.Error(responseWriter, err.Error(), http.StatusBadRequest)
	}
	formData := req.MultipartForm
	defer formData.RemoveAll()

	var wg sync.WaitGroup
	if formData != nil {
		files := formData.File["files"]

		for fileNum, fileHeader := range files {
			fileBuffer := new(bytes.Buffer)

			wg.Add(1)

			go func() {
				defer wg.Done()
				Worker(fileNum, fileHeader, fileBuffer, tmpDir, errChan)
			}()

		}

		go func() {
			wg.Wait()
			close(errChan)
		}()

		print("errChan length: ", len(errChan), "\n")

		for err := range errChan {
			print("Error: ", err, "\n")
			if err != nil {
				fmt.Printf("error uploading file: %v\n", err.Error())

			}
		}

	}
	print("\nALL FILES UPLOADED\n")
	responseWriter.Header().Add("Content-Type", "text/plain")
	responseWriter.Write([]byte("All Files Uploaded"))

}
