/**
 * @file Server configuration utilities
 * @module Database/ServerConfigUtils
 * @description Utility functions for handling server configuration operations, including 
 * retrieving and updating role and channel settings for each server. These functions
 * support the dynamic configuration of the bot across multiple servers.
 * @version 1.2.3
 * @since 1.0.0
 */

const { ServerConfig, sequelize } = require('./models');
const { isDeveloper } = require('./dev-utils');

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
        // Developer bypass - always return true for the developer
        if (isDeveloper(member.user.id)) {
            return true;
        }

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
 * Retrieves the customer role ID for a given guild.
 * @param {string} guildId - The ID of the guild.
 * @returns {Promise<string|null>} The customer role ID, or null if not configured.
 */
async function getCustomerRoleId(guildId) {
    const config = await ServerConfig.findOne({ where: { serverId: guildId } });
    return config?.customerRoleId || null;
}

/**
 * Retrieves the security role ID for a given guild.
 * @param {string} guildId - The ID of the guild.
 * @returns {Promise<string|null>} The security role ID, or null if not configured.
 */
async function getSecurityRoleId(guildId) {
    const config = await ServerConfig.findOne({ where: { serverId: guildId } });
    return config?.securityRoleId || null;
}

/**
 * Retrieves the alert channel ID for a given guild.
 * @param {string} guildId - The ID of the guild.
 * @returns {Promise<string|null>} The alert channel ID, or null if not configured.
 */
async function getAlertChannelId(guildId) {
    const config = await ServerConfig.findOne({ where: { serverId: guildId } });
    return config?.alertChannelId || null;
}

/**
 * Retrieves the blacklist role ID for a given guild.
 * @param {string} guildId - The ID of the guild.
 * @returns {Promise<string|null>} The blacklist role ID, or null if not configured.
 */
async function getBlacklistRoleId(guildId) {
    const config = await ServerConfig.findOne({ where: { serverId: guildId } });
    return config?.blacklistRoleId || null;
}

/**
 * Set the blacklist role ID for a guild - only to be used by the server owner
 * @param {string} guildId - The ID of the guild
 * @param {string} roleId - The ID of the role that can blacklist servers
 * @returns {Promise<ServerConfig>} The updated server configuration
 */
async function setBlacklistRole(guildId, roleId) {
    return await updateServerConfig(guildId, { blacklistRoleId: roleId });
}

/**
 * Check if a user has the blacklist role in a server
 * @param {import('discord.js').GuildMember} member - The guild member to check
 * @returns {Promise<boolean>} True if the user has the blacklist role or is the server owner
 */
async function canBlacklistServers(member) {
    try {
        // Developer bypass - always return true for the developer
        if (isDeveloper(member.user.id)) {
            return true;
        }
        
        // If the user is the server owner, they always have permission
        if (member.id === member.guild.ownerId) {
            return true;
        }
        
        const config = await getServerConfig(member.guild.id);
        
        // If no blacklist role is set, only the server owner can blacklist
        if (!config || !config.blacklistRoleId) {
            return false; // Already checked for owner above
        }
        
        // Check if the member has the blacklist role
        return member.roles.cache.has(config.blacklistRoleId);
    } catch (error) {
        console.error(`[ERROR] Error checking blacklist role:`, error);
        // Default to owner-only on error
        return member.id === member.guild.ownerId;
    }
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
    initializeServerConfig,
    getBlacklistRoleId,
    setBlacklistRole,
    canBlacklistServers
};