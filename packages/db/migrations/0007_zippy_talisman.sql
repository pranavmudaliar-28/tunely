CREATE TABLE "guide_sources" (
	"channel_id" text NOT NULL,
	"site" text NOT NULL,
	"site_id" text NOT NULL,
	CONSTRAINT "guide_sources_channel_id_site_site_id_pk" PRIMARY KEY("channel_id","site","site_id")
);
--> statement-breakpoint
CREATE TABLE "programmes" (
	"channel_id" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"stop" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"description" text,
	CONSTRAINT "programmes_channel_id_start_pk" PRIMARY KEY("channel_id","start")
);
