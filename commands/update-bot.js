/**
 * @file Update Bot Command
 * @module CommandModules/UpdateBot
 * @description Command that allows administrators to send update notifications to all configured servers
 * and provides a way to announce system updates.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendSystemNotification } = require('../database/server-utils');

module.exports = {
    /**
     * The slash command definition for the update-bot command
     * @type {import('discord.js').SlashCommandBuilder}
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
                        .setDescription('Brief description of changes in this version')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('external')
                        .setDescription('Whether to notify external servers (default: true)')
                        .setRequired(false))),

    /**
     * Executes the update-bot command
     * @param {import('discord.js').ChatInputCommandInteraction} interaction - The command interaction
     * @returns {Promise<void>}
     * @example
     * // Command usage:
     * // /update-bot notify message:"Bot will be down for maintenance" type:maintenance
     * // /update-bot version version:"1.2.0" changes:"Added new security features"
     */
    async execute(interaction) {
        // Only guild administrators can run this command
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
                const changes = interaction.options.getString('changes');
                const notifyExternal = interaction.options.getBoolean('external') ?? true;
                
                const message = `**Version ${version} Released**\n\n${changes}\n\nThe bot has been updated to version ${version}. You don't need to take any action.`;
                
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
                    content: `Version announcement sent! Main server: ${result.mainSuccess ? '✅' : '❌'}, External servers: ${result.externalCount}, Errors: ${result.errors}`,
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