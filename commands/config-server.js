/**
 * @file Configure server settings command
 * @module CommandModules/ConfigServer
 * @description Command to configure server-specific settings for the Arcani bot,
 * allowing administrators and managers to set roles and channels for security operations.
 * This command is restricted to the main security company server.
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getServerConfig, updateServerConfig, isServerManager } = require('../database/server-config-utils');
const { isDeveloper } = require('../database/dev-utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config-server')
        .setDescription('Configure server settings for Arcani bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-manager-role')
                .setDescription('Set the role that can manage bot settings')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The manager role')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-customer-role')
                .setDescription('Set the customer role for security requests')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The customer role')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-security-role')
                .setDescription('Set the security personnel role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The security role')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-alert-channel')
                .setDescription('Set the channel for security alerts')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The alert channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view-config')
                .setDescription('View current server configuration')),

    /**
     * Executes the config-server command
     * @param {Object} interaction - The interaction object
     * @returns {Promise<void>}
     * @example
     * // Example usage:
     * // /config-server set-manager-role @Managers
     * // /config-server set-customer-role @Customers
     * // /config-server set-security-role @Security
     * // /config-server set-alert-channel #security-alerts
     * // /config-server view-config
     */
    async execute(interaction) {
        try {
            const mainGuildId = process.env.GUILD_ID;
            
            // Check if this command is being used in a non-main server (bypass for developer)
            if (interaction.guild.id !== mainGuildId && !isDeveloper(interaction.user.id)) {
                return interaction.reply({
                    content: 'This command can only be used in the main security company server.',
                    ephemeral: true
                });
            }
            
            // For all operations except setting the manager role, check if the user is a manager (bypass for developer)
            const subcommand = interaction.options.getSubcommand();
            if (subcommand !== 'set-manager-role' && !isDeveloper(interaction.user.id) && !(await isServerManager(interaction.member))) {
                return interaction.reply({
                    content: 'You do not have permission to use this command. Only server administrators or designated managers can configure server settings.',
                    ephemeral: true
                });
            }

            const serverId = interaction.guild.id;
            let config = await getServerConfig(serverId);

            switch (subcommand) {
                case 'set-manager-role': {
                    // Only server administrators can set the manager role (bypass for developer)
                    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !isDeveloper(interaction.user.id)) {
                        return interaction.reply({
                            content: 'Only server administrators can set the manager role.',
                            ephemeral: true
                        });
                    }

                    const role = interaction.options.getRole('role');
                    config = await updateServerConfig(serverId, { managerRoleId: role.id });

                    return interaction.reply({
                        content: `Successfully set ${role.name} as the manager role. Users with this role can now configure server settings.`,
                        ephemeral: true
                    });
                }

                case 'set-customer-role': {
                    const role = interaction.options.getRole('role');
                    config = await updateServerConfig(serverId, { customerRoleId: role.id });

                    return interaction.reply({
                        content: `Successfully set ${role.name} as the customer role for security requests.`,
                        ephemeral: true
                    });
                }

                case 'set-security-role': {
                    const role = interaction.options.getRole('role');
                    config = await updateServerConfig(serverId, { securityRoleId: role.id });

                    return interaction.reply({
                        content: `Successfully set ${role.name} as the security personnel role.`,
                        ephemeral: true
                    });
                }

                case 'set-alert-channel': {
                    const channel = interaction.options.getChannel('channel');
                    
                    // Log channel type info for debugging
                    console.log(`[DEBUG] Channel type: ${channel.type}, isText: ${channel.isTextBased()}`);
                    
                    // Check if this is a text channel (ChannelType.GuildText is 0)
                    if (!channel.isTextBased()) {
                        return interaction.reply({
                            content: 'You must select a text channel for security alerts.',
                            ephemeral: true
                        });
                    }

                    config = await updateServerConfig(serverId, { alertChannelId: channel.id });

                    return interaction.reply({
                        content: `Successfully set ${channel.name} as the security alert channel.`,
                        ephemeral: true
                    });
                }

                case 'view-config': {
                    config = config || { serverId };
                    
                    // Fetch role and channel names
                    const managerRole = config.managerRoleId ? 
                        interaction.guild.roles.cache.get(config.managerRoleId)?.name || 'Unknown Role' : 'Not Set';
                    const customerRole = config.customerRoleId ? 
                        interaction.guild.roles.cache.get(config.customerRoleId)?.name || 'Unknown Role' : 'Not Set';
                    const securityRole = config.securityRoleId ? 
                        interaction.guild.roles.cache.get(config.securityRoleId)?.name || 'Unknown Role' : 'Not Set';
                    const alertChannel = config.alertChannelId ? 
                        interaction.guild.channels.cache.get(config.alertChannelId)?.name || 'Unknown Channel' : 'Not Set';

                    const configInfo = [
                        `**Manager Role:** ${managerRole} ${config.managerRoleId ? `(<@&${config.managerRoleId}>)` : ''}`,
                        `**Customer Role:** ${customerRole} ${config.customerRoleId ? `(<@&${config.customerRoleId}>)` : ''}`,
                        `**Security Role:** ${securityRole} ${config.securityRoleId ? `(<@&${config.securityRoleId}>)` : ''}`,
                        `**Alert Channel:** ${alertChannel} ${config.alertChannelId ? `(<#${config.alertChannelId}>)` : ''}`
                    ].join('\n');

                    return interaction.reply({
                        content: `**Server Configuration:**\n${configInfo}`,
                        ephemeral: true
                    });
                }
            }
        } catch (error) {
            console.error(`[ERROR] Error in config-server command:`, error);
            // Make sure we always reply to the interaction
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({
                    content: `An error occurred while executing this command: ${error.message}`,
                    ephemeral: true
                });
            }
        }
    }
};