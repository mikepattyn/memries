package db

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	driver "github.com/arangodb/go-driver"
)

func UserKeyFromEmail(email string) string {
	sum := sha1.Sum([]byte(strings.ToLower(email)))
	return hex.EncodeToString(sum[:])
}

func (c *Client) UpsertUserByEmail(ctx context.Context, email, name string) (*User, error) {
	col, err := c.db.Collection(ctx, ColUsers)
	if err != nil {
		return nil, err
	}
	key := UserKeyFromEmail(email)
	u := &User{
		Key:       key,
		Email:     strings.ToLower(email),
		Name:      name,
		Role:      "user",
		CreatedAt: time.Now().UTC(),
	}
	_, err = col.CreateDocument(ctx, u)
	if err == nil {
		return u, nil
	}
	if driver.IsConflict(err) {
		var existing User
		if _, err := col.ReadDocument(ctx, key, &existing); err != nil {
			return nil, err
		}
		if existing.Name != name && name != "" {
			existing.Name = name
			if _, err := col.UpdateDocument(ctx, key, &existing); err != nil {
				return nil, err
			}
		}
		return &existing, nil
	}
	return nil, err
}

func (c *Client) GetUser(ctx context.Context, key string) (*User, error) {
	col, err := c.db.Collection(ctx, ColUsers)
	if err != nil {
		return nil, err
	}
	var u User
	if _, err := col.ReadDocument(ctx, key, &u); err != nil {
		if driver.IsNotFound(err) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &u, nil
}
