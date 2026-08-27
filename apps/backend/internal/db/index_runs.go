package db

import (
	"context"

	driver "github.com/arangodb/go-driver"
)

func (c *Client) GetIndexRun(ctx context.Context, ownerID string) (*IndexRun, error) {
	col, err := c.db.Collection(ctx, ColIndexRuns)
	if err != nil {
		return nil, err
	}
	var run IndexRun
	if _, err := col.ReadDocument(ctx, ownerID, &run); err != nil {
		if driver.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return &run, nil
}

func (c *Client) UpsertIndexRun(ctx context.Context, run *IndexRun) error {
	col, err := c.db.Collection(ctx, ColIndexRuns)
	if err != nil {
		return err
	}
	_, err = col.CreateDocument(ctx, run)
	if err == nil {
		return nil
	}
	if driver.IsConflict(err) {
		_, err = col.UpdateDocument(ctx, run.Key, run)
		return err
	}
	return err
}

func (c *Client) ListIndexRunsByStatus(ctx context.Context, status string) ([]IndexRun, error) {
	q := `
		FOR r IN index_runs
		  FILTER r.status == @status
		  RETURN r`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{"status": status})
	if err != nil {
		return nil, err
	}
	defer cur.Close()
	var out []IndexRun
	for cur.HasMore() {
		var run IndexRun
		if _, err := cur.ReadDocument(ctx, &run); err != nil {
			return nil, err
		}
		out = append(out, run)
	}
	return out, nil
}
