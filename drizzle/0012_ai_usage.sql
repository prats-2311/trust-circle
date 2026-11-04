-- One row per UTC day: how many Groq calls the app has made, so a daily cap can stop a runaway demo.
CREATE TABLE IF NOT EXISTS "ai_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL
);
