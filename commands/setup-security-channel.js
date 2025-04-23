/**
 * @file Setup security channel command
 * @module CommandModules/SetupSecurityChannel
 * @description Allows server administrators to register their server with the Arcani security system
 * and designate a channel for security requests. This is the initial setup command that must be run
 * in external servers before they can use the security request features. It registers the server in
 * the database and configures a dedicated security channel.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { ExternalServer } = require('../database/models');
const { markServerActive } = require('../database/server-utils');

module.exports = {
    /**
     * Command definition for /setup-security-channel
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('setup-security-channel')
        .setDescription('Set up a channel for sending security requests to VIG Security')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to use for security requests')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    /**
     * Executes the setup-security-channel command.
     * Configures a channel in an external server for security requests.
     * @param {Object} interaction The interaction object.
     * @returns {Promise<void>}
     * @example
     * // Example usage:
     * // /setup-security-channel channel:#security-requests
     * //
     * // This command must be used by a server administrator in any server that wishes
     * // to connect with Arcani Security services. Once configured, users in that server
     * // can use the /request-external-security command in the designated channel.
     * //
     * // Follow-up configuration options:
     * // - Use /set-required-roles to restrict who can submit security requests
     */
    async execute(interaction) {
        const mainGuildId = process.env.GUILD_ID;
        
        try {
            // Get the selected channel
            const channel = interaction.options.getChannel('channel');

            // Verify the channel is a text channel
            if (channel.type !== ChannelType.GuildText) {
                return interaction.reply({ 
                    content: 'You must select a text channel for security requests.',
                    ephemeral: true 
                });
            }

            // Ensure bot has permission to send messages in the channel
            try {
                const permissions = channel.permissionsFor(interaction.client.user);
                if (!permissions.has('SendMessages')) {
                    return interaction.reply({ 
                        content: 'I don\'t have permission to send messages in that channel. Please give me the appropriate permissions first.',
                        ephemeral: true 
                    });
                }
            } catch (permError) {
                console.error('Error checking permissions:', permError);
                return interaction.reply({ 
                    content: 'There was an error checking my permissions for that channel. Make sure I have the necessary permissions.',
                    ephemeral: true 
                });
            }

            // If this is the main security guild, don't allow this command
            if (interaction.guild.id === mainGuildId) {
                return interaction.reply({ 
                    content: 'This command cannot be used in the main security server.',
                    ephemeral: true 
                });
            }

            // Check if this server is already registered
            let externalServer = await ExternalServer.findByPk(interaction.guild.id);
            
            if (externalServer) {
                // Update existing server entry
                externalServer.channelId = channel.id;
                externalServer.guildName = interaction.guild.name;
                externalServer.isActive = true;
                externalServer.lastAccessed = new Date();
                await externalServer.save();
                
                return interaction.reply({ 
                    content: `Security request channel updated to ${channel}. This channel will now receive security request confirmations.`,
                    ephemeral: true 
                });
            } else {
                // Create new server entry
                externalServer = await ExternalServer.create({
                    guildId: interaction.guild.id,
                    guildName: interaction.guild.name,
                    channelId: channel.id,
                    isActive: true,
                    lastAccessed: new Date()
                });
                
                return interaction.reply({ 
                    content: `Security request channel set to ${channel}. Your server can now use the \`/request-external-security\` command in this channel to submit security requests to VIG Security.`,
                    ephemeral: true 
                });
            }
            
        } catch (error) {
            console.error(`Error setting up security channel: ${error}`);
            return interaction.reply({ 
                content: `There was an error setting up the security channel: ${error.message}`,
                ephemeral: true 
            });
        }
    },
};