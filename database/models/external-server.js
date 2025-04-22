/**
 * @file External server model
 * @module Database/Models/ExternalServer
 * @description Defines the database model for external Discord servers that have configured the bot,
 * including role permission requirements and server activity tracking.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');

/**
 * Represents an external server that has configured the bot for security requests
 * @typedef {Object} ExternalServer
 */
const ExternalServer = sequelize.define('ExternalServer', {
    /**
     * Discord Guild ID
     * @type {string}
     */
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        primaryKey: true
    },
    /**
     * Name of the Discord Guild
     * @type {string}
     */
    guildName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    /**
     * ID of the channel designated for security requests
     * @type {string}
     */
    channelId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    /**
     * Whether the server is active
     * @type {boolean}
     */
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    /**
     * Date when the server was last accessed
     * @type {Date}
     */
    lastAccessed: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    /**
     * Array of role IDs that are allowed to use the bot commands
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

module.exports = ExternalServer;