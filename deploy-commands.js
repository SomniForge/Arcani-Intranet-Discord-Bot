// deploy-commands.js

/**
 * @file Command deployment script
 * @module Utilities/DeployCommands
 */

/**
 * @fileoverview Script to register slash commands with Discord for a specific guild.
 * Reads command files from the 'commands' directory and deploys them using the Discord API.
 * Requires DISCORD_TOKEN, CLIENT_ID, and GUILD_ID environment variables.
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Grab all the command files from the commands directory you created earlier
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
    if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
        console.error('Error: CLIENT_ID and GUILD_ID must be set in the .env file.');
        process.exit(1);
    }
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        // Use Routes.applicationCommands(clientId) for global commands later
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${process.env.GUILD_ID}.`);
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();
