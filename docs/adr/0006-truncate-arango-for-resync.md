# Truncate Arango for resync (keep volumes)

`make db-clear` truncates every non-system collection in the running `memries` database and restarts the API so the in-memory index job is dropped. It does not delete `./data/photos`, the thumb cache, or Compose volumes — `make down-wipe` stays the path for a changed `ARANGO_PASSWORD` after first init. Refresh after a clear: the splash re-indexes from disk and capture time is resolved again from EXIF DateTimeOriginal, then file created, then last modified.
