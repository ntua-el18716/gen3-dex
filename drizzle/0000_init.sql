CREATE TABLE `ability` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ability_key_unique` ON `ability` (`key`);--> statement-breakpoint
CREATE TABLE `base_stat_override` (
	`pokemon_id` integer NOT NULL,
	`game` text NOT NULL,
	`form_name` text NOT NULL,
	`hp` integer NOT NULL,
	`attack` integer NOT NULL,
	`defense` integer NOT NULL,
	`speed` integer NOT NULL,
	`sp_attack` integer NOT NULL,
	`sp_defense` integer NOT NULL,
	PRIMARY KEY(`pokemon_id`, `game`),
	FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`game`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `encounter` (
	`game` text NOT NULL,
	`location_id` integer NOT NULL,
	`method` text NOT NULL,
	`slot` integer NOT NULL,
	`pokemon_id` integer NOT NULL,
	`min_level` integer NOT NULL,
	`max_level` integer NOT NULL,
	`rate` integer NOT NULL,
	PRIMARY KEY(`game`, `location_id`, `method`, `slot`),
	FOREIGN KEY (`game`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `encounter_pokemon_idx` ON `encounter` (`pokemon_id`,`game`);--> statement-breakpoint
CREATE TABLE `evolution` (
	`from_pokemon_id` integer NOT NULL,
	`to_pokemon_id` integer NOT NULL,
	`method` text NOT NULL,
	`level` integer,
	`item_id` integer,
	PRIMARY KEY(`from_pokemon_id`, `to_pokemon_id`, `method`),
	FOREIGN KEY (`from_pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evolution_to_idx` ON `evolution` (`to_pokemon_id`);--> statement-breakpoint
CREATE TABLE `frontier_set` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`pokemon_id` integer NOT NULL,
	`move1_id` integer,
	`move2_id` integer,
	`move3_id` integer,
	`move4_id` integer,
	`item_id` integer,
	`nature_id` integer NOT NULL,
	`ev_hp` integer NOT NULL,
	`ev_attack` integer NOT NULL,
	`ev_defense` integer NOT NULL,
	`ev_speed` integer NOT NULL,
	`ev_sp_attack` integer NOT NULL,
	`ev_sp_defense` integer NOT NULL,
	FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move1_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move2_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move3_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move4_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`nature_id`) REFERENCES `nature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `frontier_set_key_unique` ON `frontier_set` (`key`);--> statement-breakpoint
CREATE INDEX `frontier_set_pokemon_idx` ON `frontier_set` (`pokemon_id`);--> statement-breakpoint
CREATE TABLE `frontier_trainer` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`trainer_class` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `frontier_trainer_key_unique` ON `frontier_trainer` (`key`);--> statement-breakpoint
CREATE TABLE `frontier_trainer_set` (
	`trainer_id` integer NOT NULL,
	`set_id` integer NOT NULL,
	PRIMARY KEY(`trainer_id`, `set_id`),
	FOREIGN KEY (`trainer_id`) REFERENCES `frontier_trainer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`set_id`) REFERENCES `frontier_set`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `frontier_trainer_set_set_idx` ON `frontier_trainer_set` (`set_id`);--> statement-breakpoint
CREATE TABLE `game` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version_group` text NOT NULL,
	`region` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`pocket` text,
	`hold_effect` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_key_unique` ON `item` (`key`);--> statement-breakpoint
CREATE TABLE `learnset` (
	`pokemon_id` integer NOT NULL,
	`game` text NOT NULL,
	`move_id` integer NOT NULL,
	`method` text NOT NULL,
	`level` integer NOT NULL,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`pokemon_id`, `game`, `move_id`, `method`, `level`),
	FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`game`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learnset_move_idx` ON `learnset` (`move_id`,`game`);--> statement-breakpoint
CREATE TABLE `location` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `location_region_key_idx` ON `location` (`region`,`key`);--> statement-breakpoint
CREATE TABLE `machine` (
	`number` integer PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`move_id` integer NOT NULL,
	FOREIGN KEY (`move_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `machine_label_unique` ON `machine` (`label`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `move` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`power` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`pp` integer NOT NULL,
	`priority` integer NOT NULL,
	`effect_chance` integer NOT NULL,
	`effect` text NOT NULL,
	`target` text NOT NULL,
	`makes_contact` integer NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `move_key_unique` ON `move` (`key`);--> statement-breakpoint
CREATE TABLE `nature` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`increased_stat` text,
	`decreased_stat` text
);
--> statement-breakpoint
CREATE TABLE `pokedex_text` (
	`pokemon_id` integer NOT NULL,
	`game` text NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`pokemon_id`, `game`),
	FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`game`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pokemon` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`hoenn_dex_number` integer,
	`type1` text NOT NULL,
	`type2` text,
	`ability1_id` integer NOT NULL,
	`ability2_id` integer,
	`hp` integer NOT NULL,
	`attack` integer NOT NULL,
	`defense` integer NOT NULL,
	`speed` integer NOT NULL,
	`sp_attack` integer NOT NULL,
	`sp_defense` integer NOT NULL,
	`ev_hp` integer NOT NULL,
	`ev_attack` integer NOT NULL,
	`ev_defense` integer NOT NULL,
	`ev_speed` integer NOT NULL,
	`ev_sp_attack` integer NOT NULL,
	`ev_sp_defense` integer NOT NULL,
	`catch_rate` integer NOT NULL,
	`base_experience` integer NOT NULL,
	`gender_ratio` integer NOT NULL,
	`egg_cycles` integer NOT NULL,
	`base_friendship` integer NOT NULL,
	`growth_rate` text NOT NULL,
	`egg_group1` text NOT NULL,
	`egg_group2` text,
	`body_color` text NOT NULL,
	`safari_flee_rate` integer NOT NULL,
	`category` text NOT NULL,
	`height_dm` integer NOT NULL,
	`weight_hg` integer NOT NULL,
	FOREIGN KEY (`ability1_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ability2_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pokemon_key_unique` ON `pokemon` (`key`);--> statement-breakpoint
CREATE TABLE `trainer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`trainer_class` text NOT NULL,
	`is_double` integer NOT NULL,
	`item_ids` text NOT NULL,
	FOREIGN KEY (`game`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trainer_game_key_idx` ON `trainer` (`game`,`key`);--> statement-breakpoint
CREATE TABLE `trainer_mon` (
	`trainer_id` integer NOT NULL,
	`slot` integer NOT NULL,
	`pokemon_id` integer NOT NULL,
	`level` integer NOT NULL,
	`iv` integer NOT NULL,
	`held_item_id` integer,
	`move1_id` integer,
	`move2_id` integer,
	`move3_id` integer,
	`move4_id` integer,
	`moves_computed` integer NOT NULL,
	PRIMARY KEY(`trainer_id`, `slot`),
	FOREIGN KEY (`trainer_id`) REFERENCES `trainer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`held_item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move1_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move2_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move3_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`move4_id`) REFERENCES `move`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trainer_mon_pokemon_idx` ON `trainer_mon` (`pokemon_id`);--> statement-breakpoint
CREATE TABLE `type_chart` (
	`attacking_type` text NOT NULL,
	`defending_type` text NOT NULL,
	`multiplier` real NOT NULL,
	PRIMARY KEY(`attacking_type`, `defending_type`)
);
--> statement-breakpoint
CREATE TABLE `wild_held_item` (
	`pokemon_id` integer NOT NULL,
	`version_group` text NOT NULL,
	`rarity` text NOT NULL,
	`item_id` integer NOT NULL,
	PRIMARY KEY(`pokemon_id`, `version_group`, `rarity`),
	FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action
);
