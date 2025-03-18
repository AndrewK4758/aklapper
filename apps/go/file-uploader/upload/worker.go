package upload

import (
	"bytes"
	"fmt"
	"mime/multipart"
)

func Worker(workerNumber int, fileHeader *multipart.FileHeader, fileBuffer *bytes.Buffer, filePath string, errChan chan error) {
	fmt.Printf("Worker %d started\n", workerNumber)
	var err error

	select {
	case <-errChan:
		fmt.Printf("Worker %d aborted\n", workerNumber)
		return

	default:
		fmt.Printf("File number: %d started upload\n", workerNumber)

		err = UploadFile(filePath, fileHeader, fileBuffer)
		if err != nil {
			errChan <- err
		}

	}
}
