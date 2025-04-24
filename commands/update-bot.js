/**
 * @file Update Bot Command
 * @module CommandModules/UpdateBot
 * @description Command that allows administrators to send update notifications to all configured servers
 * and provides a way to announce system updates with detailed changelogs.
 * @version 1.2.3
 * @since 1.0.0
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendSystemNotification } = require('../database/server-utils');

// Developer ID - only this user can use update commands
const DEV_USER_ID = '175919890589286400';

module.exports = {
    /**
     * The slash command definition for the update-bot command
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('update-bot')
        .setDescription('Send system notifications about bot updates or maintenance')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('notify')
                .setDescription('Send a notification to all configured servers')
                .addStringOption(option => 
                    option.setName('message')
                        .setDescription('The notification message to send')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('The type of notification')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Update', value: 'update' },
                            { name: 'Maintenance', value: 'maintenance' },
                            { name: 'Alert', value: 'alert' },
                            { name: 'Error', value: 'error' }
                        ))
                .addBooleanOption(option =>
                    option.setName('external')
                        .setDescription('Whether to send to external servers (default: true)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('version')
                .setDescription('Announce a new version of the bot')
                .addStringOption(option =>
                    option.setName('version')
                        .setDescription('The new version number (e.g., 1.2.0)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('changes')
                        .setDescription('Comma-separated list of changes in this version')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('external')
                        .setDescription('Whether to notify external servers (default: true)')
                        .setRequired(false))),

    /**
     * Executes the update-bot command
     * @param {Object} interaction - The Discord.js interaction object
     * @returns {Promise<void>}
     * @example
     * // Command usage:
     * // /update-bot notify message:"Bot will be down for maintenance" type:maintenance
     * // /update-bot version version:"1.2.0" changes:"Added security features, Fixed login bug, Updated dependencies"
     */
    async execute(interaction) {
        // Check if the user is the developer
        if (interaction.user.id !== DEV_USER_ID) {
            return interaction.reply({
                content: 'Only the bot developer can use update commands.',
                ephemeral: true
            });
        }
        
        // Also check for administrator permissions as a secondary requirement
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'You need administrator permissions to use this command.',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        const subcommand = interaction.options.getSubcommand();
        
        try {
            if (subcommand === 'notify') {
                const message = interaction.options.getString('message');
                const type = interaction.options.getString('type');
                const notifyExternal = interaction.options.getBoolean('external') ?? true;
                
                let title = '📢 System Notification';
                let isUpdate = false;
                let isError = false;
                
                switch (type) {
                    case 'update':
                        title = '🔄 System Update';
                        isUpdate = true;
                        break;
                    case 'maintenance':
                        title = '🔧 System Maintenance';
                        break;
                    case 'alert':
                        title = '⚠️ System Alert';
                        break;
                    case 'error':
                        title = '❌ System Error';
                        isError = true;
                        break;
                }
                
                const result = await sendSystemNotification(
                    interaction.client,
                    message,
                    { isUpdate, isError, title, notifyExternal }
                );
                
                await interaction.editReply({
                    content: `Notification sent! Main server: ${result.mainSuccess ? '✅' : '❌'}, External servers: ${result.externalCount}, Errors: ${result.errors}`,
                    ephemeral: true
                });
                
            } else if (subcommand === 'version') {
                const version = interaction.options.getString('version');
                const changesRaw = interaction.options.getString('changes');
                const notifyExternal = interaction.options.getBoolean('external') ?? true;
                
                // Parse the changes into a bulleted list
                const changesList = changesRaw.split(',').map(change => change.trim());
                
                // Format the changes as a bulleted list
                const formattedChanges = changesList.map(change => `• ${change}`).join('\n');
                
                const message = `**Version ${version} Released**\n\n**What's New:**\n${formattedChanges}\n\nThe bot has been updated to version ${version}. No action is required.`;
                
                const result = await sendSystemNotification(
                    interaction.client,
                    message,
                    { 
                        isUpdate: true, 
                        title: '🚀 Bot Updated', 
                        notifyExternal 
                    }
                );
                
                await interaction.editReply({
                    content: `Version ${version} announcement sent with ${changesList.length} changes listed! Main server: ${result.mainSuccess ? '✅' : '❌'}, External servers: ${result.externalCount}, Errors: ${result.errors}`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('[ERROR] Failed to send system notification:', error);
            await interaction.editReply({
                content: 'An error occurred while sending the notification. Check the console for details.',
                ephemeral: true
            });
        }
    },
};