/**
 * @file Customer role management command
 * @module CommandModules/ManageCustomer
 * @description Allows security personnel to manage which users have the customer role.
 * This command provides functionality to add or remove the customer role from users
 * in the security server, controlling who can make security requests.
 */

const { SlashCommandBuilder, PermissionFlagsBits, GuildMember } = require('discord.js');
const { getSecurityRoleId, getCustomerRoleId } = require('../database/server-config-utils');

/**
 * @typedef {Object} CommandInteraction
 * @description Discord.js CommandInteraction object
 */

module.exports = {
    /**
     * Command definition for /manage-customer with add and remove subcommands
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('manage-customer')
        .setDescription('Add or remove users from the customer role')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to the customer role')
                .addUserOption(option => 
                    option
                        .setName('user')
                        .setDescription('The user to add to the customer role')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from the customer role')
                .addUserOption(option => 
                    option
                        .setName('user')
                        .setDescription('The user to remove from the customer role')
                        .setRequired(true))),
    /**
     * Executes the manage-customer command.
     * Allows security personnel to add or remove users from the customer role.
     * @param {CommandInteraction} interaction The interaction object.
     * @returns {Promise<void>}
     * @example
     * // Example usage:
     * // /manage-customer add user:@JohnDoe
     * // /manage-customer remove user:@JaneDoe
     * //
     * // This command is restricted to users with the security role.
     * // The customer role must be configured using /config-server before this command can be used.
     * // Users with the customer role gain the ability to create security requests.
     */
    async execute(interaction) {
        try {
            // Defer the reply immediately to prevent timeout issues
            await interaction.deferReply({ ephemeral: true });
            
            const securityRoleId = await getSecurityRoleId(interaction.guild.id);
            const customerRoleId = await getCustomerRoleId(interaction.guild.id);

            if (!securityRoleId || !customerRoleId) {
                console.error(`Error: Missing required configuration for server ${interaction.guild.id}.`);
                return interaction.editReply({ 
                    content: 'This server is not fully configured for role management. An administrator needs to set up the security and customer roles using the /config-server command.'
                });
            }

            // Ensure the member object is fetched
            const member = interaction.member instanceof GuildMember 
                ? interaction.member 
                : await interaction.guild.members.fetch(interaction.user.id);

            // Check if the user has the security role
            if (!member.roles.cache.has(securityRoleId)) {
                return interaction.editReply({ 
                    content: 'You do not have permission to use this command. Only security personnel can manage customer roles.'
                });
            }

            const subcommand = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('user');
            
            // Verify the target user exists
            if (!targetUser) {
                return interaction.editReply({
                    content: 'Could not find the specified user.'
                });
            }
            
            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch (error) {
                return interaction.editReply({
                    content: `Error fetching user: The user may not be in this server. ${error.message}`
                });
            }

            // Fetch the customer role
            let customerRole;
            try {
                customerRole = await interaction.guild.roles.fetch(customerRoleId);
                if (!customerRole) {
                    throw new Error(`Customer role with ID ${customerRoleId} not found`);
                }
            } catch (error) {
                return interaction.editReply({ 
                    content: `Error: Could not find the customer role. ${error.message}`
                });
            }

            // Check bot permissions
            const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.editReply({
                    content: 'The bot does not have permission to manage roles in this server. Please give the bot the "Manage Roles" permission.'
                });
            }

            // Check if the bot's highest role is above the customer role
            if (botMember.roles.highest.position <= customerRole.position) {
                return interaction.editReply({
                    content: `The bot cannot modify the ${customerRole.name} role because it's higher than or equal to the bot's highest role. Please move the bot's role above the customer role in the server settings.`
                });
            }

            try {
                if (subcommand === 'add') {
                    // Check if user already has the role
                    if (targetMember.roles.cache.has(customerRoleId)) {
                        return interaction.editReply({
                            content: `${targetUser} already has the ${customerRole.name} role.`
                        });
                    }

                    // Add the role
                    await targetMember.roles.add(customerRoleId);
                    
                    return interaction.editReply({
                        content: `Successfully added ${targetUser} to the ${customerRole.name} role.`
                    });
                } else if (subcommand === 'remove') {
                    // Check if user has the role
                    if (!targetMember.roles.cache.has(customerRoleId)) {
                        return interaction.editReply({
                            content: `${targetUser} does not have the ${customerRole.name} role.`
                        });
                    }

                    // Remove the role
                    await targetMember.roles.remove(customerRoleId);
                    
                    return interaction.editReply({
                        content: `Successfully removed ${targetUser} from the ${customerRole.name} role.`
                    });
                }
            } catch (error) {
                console.error(`Error managing customer role: ${error}`);
                return interaction.editReply({
                    content: `There was an error managing the role: ${error.message}`
                });
            }
        } catch (error) {
            console.error(`Error executing manage-customer`, error);
            // Try to respond even if there was an error
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: `An error occurred while executing this command: ${error.message}`
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: `An error occurred while executing this command: ${error.message}`,
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Failed to reply with error:', replyError);
            }
        }
    },
};