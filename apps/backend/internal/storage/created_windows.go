//go:build windows

package storage

import (
	"os"
	"syscall"
	"time"
)

func fileCreatedAt(info os.FileInfo) time.Time {
	stat, ok := info.Sys().(*syscall.Win32FileAttributeData)
	if !ok {
		return time.Time{}
	}
	ns := stat.CreationTime.Nanoseconds()
	if ns == 0 {
		return time.Time{}
	}
	return time.Unix(0, ns)
}
