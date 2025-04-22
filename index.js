/**
 * @file Bot entry point
 * @module ArcaniBot/Core
 */

// index.js

// Load environment variables from .env file
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

// Import necessary discord.js classes
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');

// Import database
const { initializeDatabase } = require('./database/models');

/**
 * Represents the main Discord client.
 * @type {Client}
 */
const clientIntents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages, // Keep this for now
    GatewayIntentBits.GuildMembers   // Keep this for now
];
console.log('[INFO] Creating client with intents:', clientIntents.map(intent => GatewayIntentBits[intent] || intent)); // Log intent names
const client = new Client({ intents: clientIntents });

// Add a collection to store commands
client.commands = new Collection();

// --- Command Handling ---
/**
 * Loads command files from the commands directory.
 * Each command file must export an object with 'data' (SlashCommandBuilder) and 'execute' (function) properties.
 */
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
        console.log(`[INFO] Loaded command ${command.data.name}`);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

// --- Event Handling ---
/**
 * Loads event handler files from the events directory.
 * Each event file must export an object with 'name' (Events enum), 'once' (boolean, optional), and 'execute' (function) properties.
 */
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    // Simplify the listener attachment - remove inner try/catch
    if (event.once) {
        client.once(event.name, (...args) => {
            // Log before executing the handler from the file
            if (event.name === Events.InteractionCreate) {
                 console.log(`[index.js] Received event: ${event.name}. Triggering execute...`);
            }
            // Directly call execute - rely on handler's own try/catch
            event.execute(...args);
        });
    } else {
        client.on(event.name, (...args) => {
             // Log before executing the handler from the file
             if (event.name === Events.InteractionCreate) {
                 console.log(`[index.js] Received event: ${event.name}. Triggering execute...`);
             }
             // Directly call execute - rely on handler's own try/catch
             event.execute(...args);
        });
    }
    console.log(`[INFO] Loaded event ${event.name}`);
}

// Initialize the database before logging in
(async () => {
    try {
        await initializeDatabase();
        
        // Use the token from environment variables
        const token = process.env.DISCORD_TOKEN;

        // Log in to Discord with your client's token
        client.login(token);
    } catch (error) {
        console.error('[FATAL] Failed to initialize the bot:', error);
        process.exit(1);
    }
})();
