/**
 * @file Server configuration utilities
 * @module Database/ServerConfigUtils
 * @description Utility functions for handling server configuration operations, including 
 * retrieving and updating role and channel settings for each server. These functions
 * support the dynamic configuration of the bot across multiple servers.
 */

const { ServerConfig, sequelize } = require('./models');

/**
 * Get the configuration for a specific server
 * @param {string} serverId - The Discord server/guild ID
 * @returns {Promise<ServerConfig>} The server configuration or null if not found
 * @example
 * // Get the configuration for a server
 * const config = await getServerConfig('123456789012345678');
 * if (config) {
 *   console.log(`Server has security role: ${config.securityRoleId}`);
 * }
 */
async function getServerConfig(serverId) {
    try {
        return await ServerConfig.findByPk(serverId);
    } catch (error) {
        console.error(`[ERROR] Failed to get server config for ${serverId}:`, error);
        return null;
    }
}

/**
 * Create or update a server configuration
 * @param {string} serverId - The Discord server/guild ID
 * @param {Object} configData - The configuration data to update
 * @param {string} [configData.managerRoleId] - The role ID for server managers
 * @param {string} [configData.customerRoleId] - The role ID for customers
 * @param {string} [configData.securityRoleId] - The role ID for security personnel
 * @param {string} [configData.alertChannelId] - The channel ID for security alerts
 * @returns {Promise<ServerConfig>} The updated server configuration
 * @example
 * // Update the security role for a server
 * const updatedConfig = await updateServerConfig('123456789012345678', { 
 *   securityRoleId: '876543210987654321' 
 * });
 */
async function updateServerConfig(serverId, configData) {
    try {
        const [config, created] = await ServerConfig.findOrCreate({
            where: { serverId },
            defaults: { serverId, ...configData }
        });
        
        if (!created) {
            // Update existing config
            await config.update(configData);
        }
        
        return config;
    } catch (error) {
        console.error(`[ERROR] Failed to update server config for ${serverId}:`, error);
        throw error;
    }
}

/**
 * Check if a user has the manager role in a server
 * @param {import('discord.js').GuildMember} member - The guild member to check
 * @returns {Promise<boolean>} True if the user has the manager role or Administrator permissions
 * @example
 * // Check if a user can manage bot settings
 * const canManage = await isServerManager(interaction.member);
 * if (!canManage) {
 *   return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
 * }
 */
async function isServerManager(member) {
    try {
        // If the user is an administrator, they always have permission
        if (member.permissions.has('Administrator')) {
            return true;
        }
        
        const config = await getServerConfig(member.guild.id);
        
        // If no manager role is set, only server administrators can manage
        if (!config || !config.managerRoleId) {
            return false; // Already checked for Administrator above
        }
        
        // Check if the member has the manager role
        return member.roles.cache.has(config.managerRoleId);
    } catch (error) {
        console.error(`[ERROR] Error checking manager role:`, error);
        // Default to admin-only on error
        return member.permissions.has('Administrator');
    }
}

/**
 * Get the customer role ID for a server
 * @param {string} serverId - The Discord server/guild ID
 * @returns {Promise<string|null>} The customer role ID or null if not set
 * @example
 * // Get the customer role ID for permission checking
 * const customerRoleId = await getCustomerRoleId(interaction.guild.id);
 * if (member.roles.cache.has(customerRoleId)) {
 *   // This is a customer
 * }
 */
async function getCustomerRoleId(serverId) {
    const config = await getServerConfig(serverId);
    return config?.customerRoleId || process.env.CUSTOMER_ROLE_ID || null;
}

/**
 * Get the security role ID for a server
 * @param {string} serverId - The Discord server/guild ID
 * @returns {Promise<string|null>} The security role ID or null if not set
 * @example
 * // Get the security personnel role ID
 * const securityRoleId = await getSecurityRoleId(interaction.guild.id);
 * if (!member.roles.cache.has(securityRoleId)) {
 *   return interaction.reply({ content: 'Only security personnel can use this command.', ephemeral: true });
 * }
 */
async function getSecurityRoleId(serverId) {
    const config = await getServerConfig(serverId);
    return config?.securityRoleId || process.env.SECURITY_ROLE_ID || null;
}

/**
 * Get the alert channel ID for a server
 * @param {string} serverId - The Discord server/guild ID
 * @returns {Promise<string|null>} The alert channel ID or null if not set
 * @example
 * // Get the alert channel ID to send notifications
 * const alertChannelId = await getAlertChannelId(interaction.guild.id);
 * const alertChannel = await interaction.guild.channels.fetch(alertChannelId);
 * await alertChannel.send('This is an important security alert!');
 */
async function getAlertChannelId(serverId) {
    const config = await getServerConfig(serverId);
    return config?.alertChannelId || process.env.ALERT_CHANNEL_ID || null;
}

/**
 * Check if a server has all required configuration
 * @param {string} serverId - The Discord server/guild ID
 * @returns {Promise<boolean>} True if the server has all required configuration
 * @example
 * // Check if the server is fully configured
 * const isConfigured = await hasRequiredConfig(interaction.guild.id);
 * if (!isConfigured) {
 *   return interaction.reply({ 
 *     content: 'This server is not fully configured. Please use /config-server to set up the bot.',
 *     ephemeral: true 
 *   });
 * }
 */
async function hasRequiredConfig(serverId) {
    const customerRoleId = await getCustomerRoleId(serverId);
    const securityRoleId = await getSecurityRoleId(serverId);
    const alertChannelId = await getAlertChannelId(serverId);
    
    return Boolean(customerRoleId && securityRoleId && alertChannelId);
}

/**
 * Initialize configuration for a server using default values
 * @param {string} serverId - The Discord server/guild ID
 * @param {string} managerRoleId - Initial manager role ID (typically set by bot owner)
 * @returns {Promise<ServerConfig>} The created server configuration
 * @example
 * // Initialize a new server configuration
 * const config = await initializeServerConfig(guild.id, guild.ownerId);
 * console.log(`Created initial configuration for ${guild.name}`);
 */
async function initializeServerConfig(serverId, managerRoleId) {
    return await updateServerConfig(serverId, {
        managerRoleId,
        customerRoleId: null,
        securityRoleId: null,
        alertChannelId: null
    });
}

module.exports = {
    getServerConfig,
    updateServerConfig,
    isServerManager,
    getCustomerRoleId,
    getSecurityRoleId,
    getAlertChannelId,
    hasRequiredConfig,
    initializeServerConfig
};