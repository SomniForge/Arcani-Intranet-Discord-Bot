/**
 * @file Configure required roles command for external servers
 * @module CommandModules/SetRequiredRoles
 * @description Allows external server admins to configure which roles can use security request commands.
 * This command restricts which users can submit security requests from external servers,
 * providing an additional layer of control for server administrators.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { ExternalServer } = require('../database/models');

module.exports = {
    /**
     * Command definition for /set-required-roles
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('set-required-roles')
        .setDescription('Set which roles are allowed to use security request commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a role that can use security request commands')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a role from using security request commands')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all roles that can use security request commands'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Remove all role requirements (allow everyone to use commands)')),
    
    /**
     * Executes the set-required-roles command.
     * Allows server admins to configure which roles can use security request commands.
     * @param {Object} interaction The interaction object.
     * @returns {Promise<void>}
     * @example
     * // Example usage:
     * // /set-required-roles add role:@Moderator
     * // /set-required-roles remove role:@Moderator
     * // /set-required-roles list
     * // /set-required-roles clear
     * //
     * // This command must be used by a server administrator.
     * // The server must be set up first with /setup-security-channel.
     * // If no roles are specified, anyone in the server can use security request commands.
     * // When roles are added, only members with those roles can request security assistance.
     */
    async execute(interaction) {
        try {
            // Check if this server is registered in our database
            const externalServer = await ExternalServer.findByPk(interaction.guild.id);
            if (!externalServer) {
                return interaction.reply({
                    content: 'This server has not been set up for security requests. Please use the `/setup-security-channel` command first.',
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();
            
            // Get current allowed roles
            const allowedRoleIds = externalServer.allowedRoleIds || [];
            
            switch (subcommand) {
                case 'add': {
                    const role = interaction.options.getRole('role');
                    
                    // Check if role is already added
                    if (allowedRoleIds.includes(role.id)) {
                        return interaction.reply({
                            content: `The role ${role.name} is already authorized to use security request commands.`,
                            ephemeral: true
                        });
                    }
                    
                    // Add the role ID to allowed roles
                    allowedRoleIds.push(role.id);
                    externalServer.allowedRoleIds = allowedRoleIds;
                    await externalServer.save();
                    
                    return interaction.reply({
                        content: `Added ${role.name} to the roles that can use security request commands.`,
                        ephemeral: true
                    });
                }
                
                case 'remove': {
                    const role = interaction.options.getRole('role');
                    
                    // Check if role is in the list
                    if (!allowedRoleIds.includes(role.id)) {
                        return interaction.reply({
                            content: `The role ${role.name} is not in the list of authorized roles.`,
                            ephemeral: true
                        });
                    }
                    
                    // Remove the role
                    const updatedRoles = allowedRoleIds.filter(id => id !== role.id);
                    externalServer.allowedRoleIds = updatedRoles;
                    await externalServer.save();
                    
                    return interaction.reply({
                        content: `Removed ${role.name} from the roles that can use security request commands.`,
                        ephemeral: true
                    });
                }
                
                case 'list': {
                    if (allowedRoleIds.length === 0) {
                        // If no roles are set up, respond appropriately
                        if (externalServer.allowedRoleIds === null || externalServer.allowedRoleIds.length === 0) {
                            return interaction.reply({
                                content: 'No role restrictions have been set up. Anyone in the server can use security request commands.',
                                ephemeral: true
                            });
                        }
                    }
                    
                    // Create an embed to display the roles
                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('Authorized Security Request Roles')
                        .setDescription('The following roles can use security request commands:')
                        .setTimestamp()
                        .setFooter({ text: 'VIG SecurityS' });
                    
                    // Add fields for each role
                    let roleListText = '';
                    for (const roleId of allowedRoleIds) {
                        const role = interaction.guild.roles.cache.get(roleId);
                        if (role) {
                            roleListText += `<@&${roleId}> (${role.name})\n`;
                        } else {
                            roleListText += `Unknown Role (ID: ${roleId})\n`;
                        }
                    }
                    
                    if (roleListText === '') {
                        roleListText = 'No roles configured. Anyone in the server can use security request commands.';
                    }
                    
                    embed.addFields({ name: 'Authorized Roles', value: roleListText });
                    
                    return interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });
                }
                
                case 'clear': {
                    // Clear the allowed roles
                    externalServer.allowedRoleIds = [];
                    await externalServer.save();
                    
                    return interaction.reply({
                        content: 'All role restrictions have been cleared. Anyone in the server can now use security request commands.',
                        ephemeral: true
                    });
                }
            }
            
        } catch (error) {
            console.error(`Error configuring required roles: ${error}`);
            return interaction.reply({
                content: `There was an error processing your request: ${error.message}`,
                ephemeral: true
            });
        }
    },
};