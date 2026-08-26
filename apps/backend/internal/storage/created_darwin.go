//go:build darwin

package storage

import (
	"os"
	"syscall"
	"time"
)

func fileCreatedAt(info os.FileInfo) time.Time {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return time.Time{}
	}
	return time.Unix(stat.Birthtimespec.Sec, stat.Birthtimespec.Nsec)
}
