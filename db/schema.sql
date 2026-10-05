-- market-pulse schema (v1). See ARCHITECTURE.md, "Data model".

CREATE TABLE IF NOT EXISTS articles (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    url          TEXT        NOT NULL UNIQUE,   -- normalised URL, the dedupe key
    title        TEXT        NOT NULL,
    description  TEXT        NOT NULL DEFAULT '',
    published_at TIMESTAMPTZ,
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    feed         TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS articles_fetched_at_idx ON articles (fetched_at DESC);

CREATE TABLE IF NOT EXISTS scores (
    article_id BIGINT PRIMARY KEY REFERENCES articles (id) ON DELETE CASCADE,
    priority   SMALLINT    NOT NULL CHECK (priority BETWEEN 1 AND 5),
    direction  TEXT        NOT NULL CHECK (direction IN ('positive', 'negative', 'neutral', 'unclear')),
    sectors    TEXT[]      NOT NULL DEFAULT '{}',
    reason     TEXT        NOT NULL,
    summary    TEXT        NOT NULL,
    model      TEXT        NOT NULL,
    scored_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_priority_idx ON scores (priority);

CREATE TABLE IF NOT EXISTS deliveries (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at    TIMESTAMPTZ,
    status     TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    recipient  TEXT        NOT NULL
);

-- article_id is UNIQUE: an article can be in at most one email.
CREATE TABLE IF NOT EXISTS delivery_items (
    delivery_id BIGINT NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
    article_id  BIGINT NOT NULL UNIQUE REFERENCES articles (id) ON DELETE CASCADE,
    PRIMARY KEY (delivery_id, article_id)
);
