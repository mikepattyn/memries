package index

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/memries/memries/internal/db"
)

const (
	StatusNotStarted         = "not_started"
	StatusQueued             = "queued"
	StatusRunning            = "running"
	StatusComplete           = "complete"
	StatusCompleteWithErrors = "complete_with_errors"
	StatusFailed             = "failed"

	interruptMessage = "interrupted by restart"
)

type Result struct {
	Discovered int `json:"discovered"`
	Processed  int `json:"processed"`
	Indexed    int `json:"indexed"`
	Skipped    int `json:"skipped"`
	Failed     int `json:"failed"`
}

type JobRunner interface {
	Run(ctx context.Context, opts Options) (Result, error)
}

type RunStore interface {
	GetIndexRun(ctx context.Context, ownerID string) (*db.IndexRun, error)
	UpsertIndexRun(ctx context.Context, run *db.IndexRun) error
	ListIndexRunsByStatus(ctx context.Context, status string) ([]db.IndexRun, error)
}

type OwnerPhotoCounter interface {
	CountOwnerPhotos(ctx context.Context, ownerID string) (int64, error)
}

type PrefixMediaCounter interface {
	CountMediaPrefix(ctx context.Context, prefix string) (int, error)
}

type OriginalsProber interface {
	RecentOriginalsMissing(ctx context.Context, ownerID string) (bool, error)
}

type Status struct {
	Status     string `json:"status"`
	Prefix     string `json:"prefix"`
	Discovered int    `json:"discovered"`
	Processed  int    `json:"processed"`
	Indexed    int    `json:"indexed"`
	Skipped    int    `json:"skipped"`
	Failed     int    `json:"failed"`
	Error      string `json:"error,omitempty"`
}

type Coordinator struct {
	ctx     context.Context
	runner  JobRunner
	store   RunStore
	counter OwnerPhotoCounter
	media   PrefixMediaCounter
	library OriginalsProber
	log     *slog.Logger

	mu   sync.Mutex
	jobs map[string]*job
	slot chan struct{}
}

type job struct {
	ownerID string
	prefix  string
	status  string
	result  Result
	errMsg  string
}

func NewCoordinator(ctx context.Context, runner JobRunner, store RunStore, counter OwnerPhotoCounter, media PrefixMediaCounter, library OriginalsProber, log *slog.Logger) *Coordinator {
	if log == nil {
		log = slog.Default()
	}
	return &Coordinator{
		ctx:     ctx,
		runner:  runner,
		store:   store,
		counter: counter,
		media:   media,
		library: library,
		log:     log,
		jobs:    make(map[string]*job),
		slot:    make(chan struct{}, 1),
	}
}

func (c *Coordinator) Reconcile(ctx context.Context) error {
	for _, st := range []string{StatusQueued, StatusRunning} {
		runs, err := c.store.ListIndexRunsByStatus(ctx, st)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		for i := range runs {
			run := runs[i]
			run.Status = StatusFailed
			run.Error = interruptMessage
			run.FinishedAt = &now
			run.UpdatedAt = now
			if err := c.store.UpsertIndexRun(ctx, &run); err != nil {
				return err
			}
		}
	}
	return nil
}

func (c *Coordinator) Status(ctx context.Context, ownerID, email string) (Status, error) {
	prefix, err := PrefixFromEmail(email)
	if err != nil {
		return Status{}, err
	}
	c.mu.Lock()
	if j, ok := c.jobs[ownerID]; ok {
		s := j.snapshot()
		c.mu.Unlock()
		return s, nil
	}
	c.mu.Unlock()

	run, err := c.store.GetIndexRun(ctx, ownerID)
	if err != nil {
		return Status{}, err
	}
	if run != nil {
		if run.Status == StatusQueued || run.Status == StatusRunning {
			now := time.Now().UTC()
			run.Status = StatusFailed
			run.Error = interruptMessage
			run.FinishedAt = &now
			run.UpdatedAt = now
			if err := c.store.UpsertIndexRun(ctx, run); err != nil {
				return Status{}, err
			}
		}
		if c.shouldRescan(ctx, ownerID, prefix) {
			return Status{Status: StatusNotStarted, Prefix: prefix}, nil
		}
		return statusFromRun(run, prefix), nil
	}

	n, err := c.counter.CountOwnerPhotos(ctx, ownerID)
	if err != nil {
		return Status{}, err
	}
	if n > 0 {
		if c.shouldRescan(ctx, ownerID, prefix) {
			return Status{Status: StatusNotStarted, Prefix: prefix}, nil
		}
		return Status{Status: StatusComplete, Prefix: prefix}, nil
	}
	return Status{Status: StatusNotStarted, Prefix: prefix}, nil
}

func (c *Coordinator) shouldRescan(ctx context.Context, ownerID, prefix string) bool {
	n, err := c.counter.CountOwnerPhotos(ctx, ownerID)
	if err != nil {
		return false
	}
	if c.library != nil && n > 0 {
		missing, err := c.library.RecentOriginalsMissing(ctx, ownerID)
		if err == nil && missing {
			return true
		}
	}
	if c.media != nil {
		disk, err := c.media.CountMediaPrefix(ctx, prefix)
		if err == nil && int64(disk) > n {
			return true
		}
	}
	return false
}

func (c *Coordinator) Start(ctx context.Context, ownerID, email string) (Status, error) {
	prefix, err := PrefixFromEmail(email)
	if err != nil {
		return Status{}, err
	}
	if ownerID == "" {
		return Status{}, errors.New("owner required")
	}

	c.mu.Lock()
	if j, ok := c.jobs[ownerID]; ok && (j.status == StatusQueued || j.status == StatusRunning) {
		s := j.snapshot()
		c.mu.Unlock()
		return s, nil
	}
	j := &job{ownerID: ownerID, prefix: prefix, status: StatusQueued}
	c.jobs[ownerID] = j
	c.mu.Unlock()

	now := time.Now().UTC()
	if err := c.store.UpsertIndexRun(ctx, &db.IndexRun{
		Key:       ownerID,
		OwnerID:   ownerID,
		Prefix:    prefix,
		Status:    StatusQueued,
		UpdatedAt: now,
	}); err != nil {
		c.mu.Lock()
		delete(c.jobs, ownerID)
		c.mu.Unlock()
		return Status{}, err
	}

	go c.execute(ownerID, prefix)
	return j.snapshot(), nil
}

func (c *Coordinator) execute(ownerID, prefix string) {
	select {
	case c.slot <- struct{}{}:
	case <-c.ctx.Done():
		c.finish(ownerID, prefix, StatusFailed, Result{}, interruptMessage)
		return
	}
	defer func() { <-c.slot }()

	if c.ctx.Err() != nil {
		c.finish(ownerID, prefix, StatusFailed, Result{}, interruptMessage)
		return
	}

	c.setRunning(ownerID)
	started := time.Now().UTC()
	_ = c.store.UpsertIndexRun(c.ctx, &db.IndexRun{
		Key:       ownerID,
		OwnerID:   ownerID,
		Prefix:    prefix,
		Status:    StatusRunning,
		StartedAt: &started,
		UpdatedAt: started,
	})

	res, err := c.runner.Run(c.ctx, Options{
		OwnerID:     ownerID,
		Prefix:      prefix,
		Concurrency: 4,
		OnProgress: func(p Result) {
			c.updateProgress(ownerID, p)
		},
	})
	if err != nil {
		msg := err.Error()
		if c.ctx.Err() != nil {
			msg = interruptMessage
		}
		c.finish(ownerID, prefix, StatusFailed, res, msg)
		return
	}
	status := StatusComplete
	if res.Failed > 0 {
		status = StatusCompleteWithErrors
	}
	c.finish(ownerID, prefix, status, res, "")
}

func (c *Coordinator) setRunning(ownerID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if j, ok := c.jobs[ownerID]; ok {
		j.status = StatusRunning
	}
}

func (c *Coordinator) updateProgress(ownerID string, res Result) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if j, ok := c.jobs[ownerID]; ok {
		j.result = res
	}
}

func (c *Coordinator) finish(ownerID, prefix, status string, res Result, errMsg string) {
	c.mu.Lock()
	if j, ok := c.jobs[ownerID]; ok {
		j.status = status
		j.result = res
		j.errMsg = errMsg
	}
	c.mu.Unlock()

	now := time.Now().UTC()
	run := &db.IndexRun{
		Key:        ownerID,
		OwnerID:    ownerID,
		Prefix:     prefix,
		Status:     status,
		Discovered: res.Discovered,
		Processed:  res.Processed,
		Indexed:    res.Indexed,
		Skipped:    res.Skipped,
		Failed:     res.Failed,
		Error:      errMsg,
		FinishedAt: &now,
		UpdatedAt:  now,
	}
	if err := c.store.UpsertIndexRun(c.ctx, run); err != nil {
		c.log.Error("persist index run", "owner", ownerID, "err", err)
	}
}

func (j *job) snapshot() Status {
	return Status{
		Status:     j.status,
		Prefix:     j.prefix,
		Discovered: j.result.Discovered,
		Processed:  j.result.Processed,
		Indexed:    j.result.Indexed,
		Skipped:    j.result.Skipped,
		Failed:     j.result.Failed,
		Error:      j.errMsg,
	}
}

func statusFromRun(run *db.IndexRun, fallbackPrefix string) Status {
	prefix := run.Prefix
	if prefix == "" {
		prefix = fallbackPrefix
	}
	return Status{
		Status:     run.Status,
		Prefix:     prefix,
		Discovered: run.Discovered,
		Processed:  run.Processed,
		Indexed:    run.Indexed,
		Skipped:    run.Skipped,
		Failed:     run.Failed,
		Error:      run.Error,
	}
}
