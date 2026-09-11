CREATE TABLE "inventory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(10) DEFAULT '📦',
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" varchar(30) DEFAULT 'pcs',
	"min_stock_alert" integer DEFAULT 0,
	"notes" text,
	"last_updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
