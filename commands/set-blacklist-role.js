/**
 * @file Set Blacklist Role Command
 * @module CommandModules/SetBlacklistRole
 * @description Command that allows the server owner to designate which role can blacklist external servers.
 * This is a critical security feature that restricts who can block external customer servers from using the bot.
 * @version 1.2.3
 * @since 1.2.0
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setBlacklistRole, getBlacklistRoleId } = require('../database/server-config-utils');
const { isDeveloper } = require('../database/dev-utils');

module.exports = {
    /**
     * The slash command definition for the set-blacklist-role command
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('set-blacklist-role')
        .setDescription('Set the role that can blacklist external servers (Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role that will be able to blacklist external servers')
                .setRequired(true)),

    /**
     * Executes the set-blacklist-role command
     * @param {Object} interaction - The Discord.js interaction object
     * @returns {Promise<void>}
     * @example
     * // Command usage:
     * // /set-blacklist-role role:@SecurityManagers
     */
    async execute(interaction) {
        // Check if the user is the server owner or a developer
        if (interaction.user.id !== interaction.guild.ownerId && !isDeveloper(interaction.user.id)) {
            return interaction.reply({
                content: 'Only the server owner can set the blacklist role.',
                ephemeral: true
            });
        }
        
        // Check if we're in the main security company server (bypass for developer)
        const mainGuildId = process.env.GUILD_ID;
        if (interaction.guild.id !== mainGuildId && !isDeveloper(interaction.user.id)) {
            return interaction.reply({
                content: 'This command can only be used in the main security company server.',
                ephemeral: true
            });
        }

        try {
            const role = interaction.options.getRole('role');
            
            // Check if the role is valid
            if (!role) {
                return interaction.reply({
                    content: 'Please provide a valid role.',
                    ephemeral: true
                });
            }
            
            // Set the blacklist role
            await setBlacklistRole(interaction.guild.id, role.id);
            
            return interaction.reply({
                content: `Successfully set ${role.name} as the role that can blacklist external servers. Only the server owner and users with this role can now blacklist external servers.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('[ERROR] Failed to set blacklist role:', error);
            return interaction.reply({
                content: 'An error occurred while setting the blacklist role. Please try again later.',
                ephemeral: true
            });
        }
    },
};