/**
 * @file Ready event handler
 * @module EventHandlers/Ready
 */

// events/ready.js

const { Events } = require('discord.js');

/**
 * @typedef {Object} Client
 * @description Discord.js Client object
 */

module.exports = {
    name: Events.ClientReady,
    once: true,
    /**
     * Executes when the client is ready.
     * @param {Client} client The Discord client instance.
     * @returns {void}
     */
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
    },
};
