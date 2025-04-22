/**
 * @file External server listing command
 * @module CommandModules/ListExternalServers
 * @description Lists all external servers configured to use the security request system with details 
 * about their status (active/inactive), number of pending requests, and last activity time. Servers are 
 * automatically marked inactive after 30 days of no activity.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ExternalServer, SecurityRequest, sequelize } = require('../database/models');
const { Op } = require('sequelize');
const { INACTIVITY_THRESHOLD_DAYS } = require('../database/server-utils');

module.exports = {
    /**
     * Command definition for /list-external-servers
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('list-external-servers')
        .setDescription('List all external servers using the security request system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(option =>
            option.setName('show-inactive')
                .setDescription('Whether to show inactive servers')
                .setRequired(false)),
    
    /**
     * Executes the list-external-servers command.
     * Shows a list of all external servers that have configured security requests.
     * Servers are considered inactive after ${INACTIVITY_THRESHOLD_DAYS} days without activity.
     * @param {Object} interaction The interaction object.
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        const mainGuildId = process.env.GUILD_ID;
        
        // Check if this command is being used in the main security server
        if (interaction.guildId !== mainGuildId) {
            return interaction.reply({
                content: 'This command can only be used in the main security server.',
                ephemeral: true
            });
        }
        
        const showInactive = interaction.options.getBoolean('show-inactive') || false;
        
        try {
            // Query for servers based on active status
            const whereClause = showInactive ? {} : { isActive: true };
            const externalServers = await ExternalServer.findAll({
                where: whereClause,
                order: [['lastAccessed', 'DESC']]
            });
            
            if (externalServers.length === 0) {
                return interaction.reply({
                    content: 'No external servers have been configured for security requests.',
                    ephemeral: true
                });
            }
            
            // Get counts of active requests for each server
            const serverIds = externalServers.map(server => server.guildId);
            const activeRequestCounts = await SecurityRequest.findAll({
                attributes: ['externalGuildId', [sequelize.fn('COUNT', sequelize.col('requestId')), 'count']],
                where: {
                    externalGuildId: { [Op.in]: serverIds },
                    status: { [Op.ne]: 'concluded' }
                },
                group: ['externalGuildId'],
                raw: true
            });
            
            // Convert to a map for easy lookup
            const requestCountMap = new Map();
            activeRequestCounts.forEach(item => {
                requestCountMap.set(item.externalGuildId, item.count);
            });
            
            // Create an embed to display all servers
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('External Servers')
                .setDescription(`${externalServers.length} external servers${showInactive ? ' (including inactive)' : ''}`)
                .setTimestamp()
                .setFooter({ text: 'VIG Security' });
            
            // Add fields for each server (limit to 25 due to Discord embed limitations)
            const serversToShow = externalServers.slice(0, 25);
            
            for (const server of serversToShow) {
                const activeRequests = requestCountMap.get(server.guildId) || 0;
                const lastAccessedDate = new Date(server.lastAccessed).toLocaleString();
                
                embed.addFields({
                    name: server.guildName,
                    value: `**ID:** ${server.guildId}\n**Channel:** <#${server.channelId}>\n**Status:** ${server.isActive ? '🟢 Active' : '🔴 Inactive'}\n**Active Requests:** ${activeRequests}\n**Last Activity:** ${lastAccessedDate}`
                });
            }
            
            if (externalServers.length > 25) {
                embed.addFields({
                    name: 'More Servers',
                    value: `${externalServers.length - 25} additional servers not shown. Please use filters to narrow down results.`
                });
            }
            
            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
            
        } catch (error) {
            console.error(`Error listing external servers: ${error}`);
            return interaction.reply({
                content: `There was an error retrieving the server list: ${error.message}`,
                ephemeral: true
            });
        }
    },
};