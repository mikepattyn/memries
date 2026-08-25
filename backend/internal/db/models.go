package db

import "time"

type Dims struct {
	W int `json:"w"`
	H int `json:"h"`
}

type GPS struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type EXIF struct {
	Camera string  `json:"camera,omitempty"`
	Lens   string  `json:"lens,omitempty"`
	ISO    int     `json:"iso,omitempty"`
	FNum   float64 `json:"f_number,omitempty"`
	Shutter string `json:"shutter,omitempty"`
	GPS    *GPS    `json:"gps,omitempty"`
}

type StoragePtr struct {
	Backend string `json:"backend"`
	Path    string `json:"path"`
	Bucket  string `json:"bucket,omitempty"`
}

type Thumbs struct {
	S256  string `json:"256,omitempty"`
	S512  string `json:"512,omitempty"`
	S1024 string `json:"1024,omitempty"`
}

type Photo struct {
	Key           string     `json:"_key"`
	Kind          string     `json:"kind"` // photo|video
	OwnerID       string     `json:"owner_id"`
	TakenAt       time.Time  `json:"taken_at"`
	TakenAtLocal  string     `json:"taken_at_local,omitempty"`
	TZOffset      int        `json:"tz_offset"`
	Storage       StoragePtr `json:"storage"`
	Hash          string     `json:"hash"`
	SizeBytes     int64      `json:"size_bytes"`
	MIME          string     `json:"mime"`
	Dims          Dims       `json:"dims"`
	Orientation   int        `json:"orientation"`
	EXIF          EXIF       `json:"exif"`
	Thumbs        Thumbs     `json:"thumbs"`
	ImportedAt    time.Time  `json:"imported_at"`
	DeletedAt     *time.Time `json:"deleted_at"`
}

type User struct {
	Key       string    `json:"_key"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Album struct {
	Key        string    `json:"_key"`
	Name       string    `json:"name"`
	OwnerID    string    `json:"owner_id"`
	Visibility string    `json:"visibility"`
	CreatedAt  time.Time `json:"created_at"`
}

type ShareEdge struct {
	From string `json:"_from"`
	To   string `json:"_to"`
	Role string `json:"role"`
}
