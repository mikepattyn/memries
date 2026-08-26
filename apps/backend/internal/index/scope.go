package index

import (
	"errors"
	"strings"
)

var ErrInvalidEmail = errors.New("invalid email")

// PrefixFromEmail returns the storage prefix for an authenticated owner.
// The client never supplies this path; it is always the lowercased email.
func PrefixFromEmail(email string) (string, error) {
	e := strings.TrimSpace(strings.ToLower(email))
	if e == "" || e == "." || e == ".." || strings.ContainsAny(e, `/\:`) {
		return "", ErrInvalidEmail
	}
	return e, nil
}
