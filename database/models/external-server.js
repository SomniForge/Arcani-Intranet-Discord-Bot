/**
 * @file External server model
 * @module Database/Models/ExternalServer
 * @description Defines the database model for external Discord servers that have configured the bot,
 * including role permission requirements and server activity tracking. This model tracks customer servers
 * that can request security services from the main security server.
 */

const { DataTypes } = require('sequelize');

/**
 * Represents an external server that has configured the bot for security requests.
 * External servers are customer Discord servers that can request security assistance
 * from the main security server. This model maintains the relationship and configuration
 * between the security provider and the customer servers.
 * 
 * @typedef {Object} ExternalServer
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} ExternalServer model
 * @example
 * // Example of creating a new external server record:
 * const newServer = await ExternalServer.create({
 *   guildId: '123456789012345678',        // Discord Guild ID (primary key)
 *   guildName: 'Customer Server',          // Name of the Discord Guild
 *   channelId: '234567890123456789',      // Security channel in external server
 * });
 * 
 * // Example of setting allowed roles:
 * newServer.allowedRoleIds = ['345678901234567890', '456789012345678901'];
 * await newServer.save();
 * 
 * // Example of finding all active external servers:
 * const activeServers = await ExternalServer.findAll({
 *   where: { isActive: true }
 * });
 */
module.exports = (sequelize) => {
    return sequelize.define('ExternalServer', {
        /**
         * Discord Guild ID - This is the unique identifier for the Discord server
         * and serves as the primary key in the database.
         * @type {string}
         */
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true
        },
        /**
         * Name of the Discord Guild - Stored for display purposes
         * so we don't need to fetch it from Discord API every time.
         * @type {string}
         */
        guildName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        /**
         * ID of the channel designated for security requests.
         * This is where security request notifications will be sent in the external server.
         * @type {string}
         */
        channelId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        /**
         * Whether the server is active.
         * Inactive servers won't receive security services.
         * This can be used to temporarily disable service without removing the server.
         * @type {boolean}
         * @default true
         */
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        /**
         * Whether the server is blacklisted.
         * Blacklisted servers will not be able to request security services.
         * Security company can blacklist servers that abuse the system.
         * @type {boolean}
         * @default false
         */
        isBlacklisted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        /**
         * Reason for blacklisting the server, if applicable.
         * @type {string}
         */
        blacklistReason: {
            type: DataTypes.STRING,
            allowNull: true
        },
        /**
         * Date when the server was last accessed.
         * Used for tracking activity and potentially for cleanup of dormant servers.
         * @type {Date}
         * @default Current date/time
         */
        lastAccessed: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        /**
         * Array of role IDs that are allowed to use the bot commands.
         * Stored as JSON string in database but automatically parsed to array when accessed.
         * If empty or null, anyone in the server can use the commands.
         * @type {Array<string>}
         */
        allowedRoleIds: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                const data = this.getDataValue('allowedRoleIds');
                return data ? JSON.parse(data) : [];
            },
            set(value) {
                this.setDataValue('allowedRoleIds', JSON.stringify(value));
            }
        }
    });
};