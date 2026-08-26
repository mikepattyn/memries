//go:build !windows && !darwin

package storage

import (
	"os"
	"time"
)

func fileCreatedAt(info os.FileInfo) time.Time {
	return time.Time{}
}
