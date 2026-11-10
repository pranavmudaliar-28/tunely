CREATE TABLE "push_follows" (
	"subscription_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_follows_subscription_id_channel_id_pk" PRIMARY KEY("subscription_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "push_reminders" (
	"subscription_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "push_reminders_subscription_id_channel_id_start_pk" PRIMARY KEY("subscription_id","channel_id","start")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_follows" ADD CONSTRAINT "push_follows_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_reminders" ADD CONSTRAINT "push_reminders_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_follows_channel_idx" ON "push_follows" USING btree ("channel_id");