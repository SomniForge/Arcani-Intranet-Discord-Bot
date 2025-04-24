/**
 * @file Manage Blacklist Command
 * @module CommandModules/ManageBlacklist
 * @description Allows authorized personnel to blacklist or unblacklist external servers
 * if they are misusing the security request system. Only users with the designated
 * blacklist role (or the server owner) can use this command.
 * @version 1.2.3
 * @since 1.2.0
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { 
    blacklistServer, 
    unblacklistServer, 
    getBlacklistedServers 
} = require('../database/server-utils');
const { canBlacklistServers, getBlacklistRoleId } = require('../database/server-config-utils');
const { ExternalServer } = require('../database/models');
const { isDeveloper } = require('../database/dev-utils');

module.exports = {
    /**
     * The slash command definition for managing blacklisted servers
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('manage-blacklist')
        .setDescription('Manage blacklisted external servers')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('blacklist')
                .setDescription('Blacklist an external server')
                .addStringOption(option =>
                    option.setName('server-id')
                        .setDescription('The ID of the external server to blacklist')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for blacklisting this server')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unblacklist')
                .setDescription('Remove an external server from the blacklist')
                .addStringOption(option =>
                    option.setName('server-id')
                        .setDescription('The ID of the external server to unblacklist')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all blacklisted external servers')),

    /**
     * Executes the manage-blacklist command
     * @param {Object} interaction - The Discord.js interaction object
     * @returns {Promise<void>}
     * @example
     * // Command usage:
     * // /manage-blacklist blacklist server-id:123456789012345678 reason:Spam requests
     * // /manage-blacklist unblacklist server-id:123456789012345678
     * // /manage-blacklist list
     */
    async execute(interaction) {
        // Check if we're in the main security company server (bypass for developer)
        const mainGuildId = process.env.GUILD_ID;
        if (interaction.guild.id !== mainGuildId && !isDeveloper(interaction.user.id)) {
            return interaction.reply({
                content: 'This command can only be used in the main security company server.',
                ephemeral: true
            });
        }

        // Check if the user has permission to blacklist servers (dev always has permission)
        if (!isDeveloper(interaction.user.id)) {
            const hasPermission = await canBlacklistServers(interaction.member);
            if (!hasPermission) {
                const blacklistRoleId = await getBlacklistRoleId(interaction.guild.id);
                let message = 'You do not have permission to manage the server blacklist.';
                
                if (blacklistRoleId) {
                    message += ` Only the server owner and users with the <@&${blacklistRoleId}> role can use this command.`;
                } else {
                    message += ' Only the server owner can use this command.';
                }
                
                return interaction.reply({
                    content: message,
                    ephemeral: true
                });
            }
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'blacklist': {
                    const serverId = interaction.options.getString('server-id');
                    const reason = interaction.options.getString('reason');
                    
                    // Check if server exists in our database
                    const server = await ExternalServer.findByPk(serverId);
                    if (!server) {
                        return interaction.reply({
                            content: 'This server is not registered in our system. Only servers that have already configured the security system can be blacklisted.',
                            ephemeral: true
                        });
                    }
                    
                    // Check if server is already blacklisted
                    if (server.isBlacklisted) {
                        return interaction.reply({
                            content: `The server "${server.guildName}" is already blacklisted. Reason: ${server.blacklistReason || 'None provided'}`,
                            ephemeral: true
                        });
                    }
                    
                    // Blacklist the server
                    const blacklisted = await blacklistServer(serverId, reason);
                    if (!blacklisted) {
                        return interaction.reply({
                            content: 'Failed to blacklist the server. Please try again later.',
                            ephemeral: true
                        });
                    }
                    
                    return interaction.reply({
                        content: `Successfully blacklisted the server "${server.guildName}" (${serverId}). They will no longer be able to request security services.`,
                        ephemeral: true
                    });
                }
                
                case 'unblacklist': {
                    const serverId = interaction.options.getString('server-id');
                    
                    // Check if server exists in our database
                    const server = await ExternalServer.findByPk(serverId);
                    if (!server) {
                        return interaction.reply({
                            content: 'This server is not registered in our system.',
                            ephemeral: true
                        });
                    }
                    
                    // Check if server is actually blacklisted
                    if (!server.isBlacklisted) {
                        return interaction.reply({
                            content: `The server "${server.guildName}" is not currently blacklisted.`,
                            ephemeral: true
                        });
                    }
                    
                    // Unblacklist the server
                    const unblacklisted = await unblacklistServer(serverId);
                    if (!unblacklisted) {
                        return interaction.reply({
                            content: 'Failed to unblacklist the server. Please try again later.',
                            ephemeral: true
                        });
                    }
                    
                    return interaction.reply({
                        content: `Successfully removed "${server.guildName}" (${serverId}) from the blacklist. They can now request security services again.`,
                        ephemeral: true
                    });
                }
                
                case 'list': {
                    // Get all blacklisted servers
                    const blacklistedServers = await getBlacklistedServers();
                    
                    if (blacklistedServers.length === 0) {
                        return interaction.reply({
                            content: 'There are no blacklisted servers.',
                            ephemeral: true
                        });
                    }
                    
                    // Create an embed to display the blacklisted servers
                    const embed = new EmbedBuilder()
                        .setTitle('Blacklisted Servers')
                        .setColor(0xFF0000)
                        .setDescription('These servers are blacklisted and cannot request security services.')
                        .setTimestamp();
                    
                    // Add each blacklisted server to the embed
                    blacklistedServers.forEach((server, index) => {
                        embed.addFields({
                            name: `${index + 1}. ${server.guildName} (${server.guildId})`,
                            value: `**Reason:** ${server.blacklistReason || 'No reason provided'}`
                        });
                    });
                    
                    return interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });
                }
            }
        } catch (error) {
            console.error('[ERROR] Failed to manage blacklist:', error);
            return interaction.reply({
                content: 'An error occurred while managing the blacklist. Please try again later.',
                ephemeral: true
            });
        }
    },
};