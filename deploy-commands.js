// deploy-commands.js

/**
 * @file Command deployment script
 * @module Utilities/DeployCommands
 */

/**
 * @fileoverview Script to register slash commands with Discord globally and for specific guilds.
 * Reads command files from the 'commands' directory and deploys them using the Discord API.
 * Requires DISCORD_TOKEN and CLIENT_ID environment variables.
 * Optional GUILD_ID environment variable for guild-specific deployment.
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Grab all the command files from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[INFO] Added command ${command.data.name} for deployment.`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

/**
 * Immediately invoked async function (IIFE) to deploy commands.
 */
(async () => {
    if (!process.env.CLIENT_ID) {
        console.error('Error: CLIENT_ID must be set in the .env file.');
        process.exit(1);
    }
    
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Check if we're deploying to a specific guild or globally
        if (process.env.GUILD_ID) {
            // Deploy to specific guild (faster for development)
            const guildData = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`Successfully reloaded ${guildData.length} application (/) commands for guild ${process.env.GUILD_ID}.`);
        }
        
        // Deploy commands globally - these will be available in all guilds
        const globalData = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        
        console.log(`Successfully reloaded ${globalData.length} application (/) commands globally.`);
        console.log(`Global commands may take up to an hour to propagate to all servers.`);
        
    } catch (error) {
        console.error('Error during command deployment:', error);
    }
})();
