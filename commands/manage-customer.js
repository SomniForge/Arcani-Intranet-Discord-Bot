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
        const securityRoleId = await getSecurityRoleId(interaction.guild.id);
        const customerRoleId = await getCustomerRoleId(interaction.guild.id);

        if (!securityRoleId || !customerRoleId) {
            console.error(`Error: Missing required configuration for server ${interaction.guild.id}.`);
            return interaction.reply({ 
                content: 'This server is not fully configured for role management. An administrator needs to set up the security and customer roles using the /config-server command.',
                ephemeral: true 
            });
        }

        // Ensure the member object is fetched
        const member = interaction.member instanceof GuildMember 
            ? interaction.member 
            : await interaction.guild.members.fetch(interaction.user.id);

        // Check if the user has the security role
        if (!member.roles.cache.has(securityRoleId)) {
            return interaction.reply({ 
                content: 'You do not have permission to use this command. Only security personnel can manage customer roles.', 
                ephemeral: true 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        const customerRole = await interaction.guild.roles.fetch(customerRoleId);

        if (!customerRole) {
            return interaction.reply({ 
                content: `Error: Could not find the customer role with ID ${customerRoleId}.`, 
                ephemeral: true 
            });
        }

        try {
            if (subcommand === 'add') {
                // Check if user already has the role
                if (targetMember.roles.cache.has(customerRoleId)) {
                    return interaction.reply({
                        content: `${targetUser} already has the ${customerRole.name} role.`,
                        ephemeral: true
                    });
                }

                // Add the role
                await targetMember.roles.add(customerRoleId);
                
                return interaction.reply({
                    content: `Successfully added ${targetUser} to the ${customerRole.name} role.`,
                    ephemeral: true
                });
            } else if (subcommand === 'remove') {
                // Check if user has the role
                if (!targetMember.roles.cache.has(customerRoleId)) {
                    return interaction.reply({
                        content: `${targetUser} does not have the ${customerRole.name} role.`,
                        ephemeral: true
                    });
                }

                // Remove the role
                await targetMember.roles.remove(customerRoleId);
                
                return interaction.reply({
                    content: `Successfully removed ${targetUser} from the ${customerRole.name} role.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error(`Error managing customer role: ${error}`);
            return interaction.reply({
                content: `There was an error managing the role: ${error.message}`,
                ephemeral: true
            });
        }
    },
};