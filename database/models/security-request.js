/**
 * @file Security request model
 * @module Database/Models/SecurityRequest
 * @description Defines the database model for security requests from both internal users and
 * external servers. This tracks all security requests, their status, responding personnel,
 * and conclusion details.
 */

const { DataTypes } = require('sequelize');

/**
 * Represents a security request from an external server or internal user.
 * This model is the core data structure for tracking security incidents, from initial request
 * through response and resolution. It maintains relationships between requesters,
 * security personnel, and affected servers.
 * 
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} SecurityRequest model
 * @example
 * // Example of creating a new security request:
 * const newRequest = await SecurityRequest.create({
 *   requestId: '123456789012345678',      // Discord interaction ID (primary key)
 *   isExternal: true,                      // Whether from external server
 *   requesterId: '234567890123456789',    // User ID of requester
 *   requesterName: 'Customer User',        // Username of requester  
 *   location: 'North Tower',               // Location needing security
 *   details: 'Suspicious activity',        // Request details
 *   contact: 'Voice channel Tower1',       // Contact information
 *   externalGuildId: '567890123456789012', // Guild ID if from external server
 *   securityMessageId: '678901234567890123', // Message ID in security server
 *   externalMessageId: '789012345678901234'  // Message ID in external server
 * });
 * 
 * // Example of updating a request with responding security personnel:
 * const request = await SecurityRequest.findByPk('123456789012345678');
 * request.status = 'responding';
 * request.responders = ['345678901234567890', '456789012345678901'];
 * await request.save();
 * 
 * // Example of concluding a security request:
 * request.status = 'concluded';
 * request.conclusionReason = 'All clear, no security threat identified';
 * request.concludedById = '456789012345678901';
 * request.concludedByName = 'Security Team Lead';
 * request.concludedAt = new Date();
 * await request.save();
 * 
 * // Example of finding all active security requests:
 * const activeRequests = await SecurityRequest.findAll({
 *   where: {
 *     status: {
 *       [Op.ne]: 'concluded'
 *     }
 *   },
 *   order: [['createdAt', 'DESC']]
 * });
 */
module.exports = (sequelize) => {
    const SecurityRequest = sequelize.define('SecurityRequest', {
        /**
         * Unique ID for the request (using Discord's interaction ID).
         * This serves as the primary key and allows correlation with Discord messages.
         * @type {string}
         */
        requestId: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        /**
         * Whether the request is from an external server.
         * True for requests from customer servers, false for internal security requests.
         * @type {boolean}
         * @default false
         */
        isExternal: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        /**
         * The user ID who made the request.
         * This is the Discord user ID of the person who initiated the security request.
         * @type {string}
         */
        requesterId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        /**
         * The username of the requester.
         * Stored for display purposes to avoid unnecessary Discord API calls.
         * @type {string}
         */
        requesterName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        /**
         * Location where security is needed.
         * This might be a physical location or virtual space depending on context.
         * @type {string}
         */
        location: {
            type: DataTypes.STRING,
            allowNull: false
        },
        /**
         * Details about the security request.
         * Contains the description of the situation, potential threats, or concerns.
         * @type {string}
         */
        details: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        /**
         * Contact information for external requests.
         * How security personnel can contact the requester (e.g., voice channel, Discord username).
         * @type {string}
         */
        contact: {
            type: DataTypes.STRING,
            allowNull: true
        },
        /**
         * Security server message ID.
         * The Discord message ID in the security server where this request was posted.
         * Used for updating the message as the request status changes.
         * @type {string}
         */
        securityMessageId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        /**
         * External server message ID (if applicable).
         * The Discord message ID in the external server where request confirmations are posted.
         * Only populated for external requests.
         * @type {string}
         */
        externalMessageId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        /**
         * Current status of the request.
         * - pending: No security personnel have responded yet
         * - responding: At least one security member is responding
         * - concluded: The request has been resolved and closed
         * @type {string}
         * @default 'pending'
         */
        status: {
            type: DataTypes.ENUM('pending', 'responding', 'concluded'),
            defaultValue: 'pending',
            allowNull: false
        },
        /**
         * Array of user IDs who are responding.
         * Stores the Discord user IDs of all security personnel who clicked "Respond".
         * Stored as JSON string in database but automatically parsed to array when accessed.
         * @type {Array<string>}
         */
        responders: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                const data = this.getDataValue('responders');
                return data ? JSON.parse(data) : [];
            },
            set(value) {
                this.setDataValue('responders', JSON.stringify(value));
            }
        },
        /**
         * Conclusion reason, if any.
         * Explanation of how the security request was resolved.
         * Only populated when status is 'concluded'.
         * @type {string}
         */
        conclusionReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        /**
         * ID of user who concluded the request.
         * Discord user ID of the security team member who closed the request.
         * @type {string}
         */
        concludedById: {
            type: DataTypes.STRING,
            allowNull: true
        },
        /**
         * Username of person who concluded the request.
         * Stored for display and logging purposes.
         * @type {string}
         */
        concludedByName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        /**
         * When the request was concluded.
         * Timestamp of when the request was closed.
         * @type {Date}
         */
        concludedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        /**
         * External guild ID if from an external server.
         * The Discord server ID where the request originated.
         * Only populated for external requests (isExternal = true).
         * @type {string}
         */
        externalGuildId: {
            type: DataTypes.STRING,
            allowNull: true
        }
    });

    // Association will be set up in the models/index.js file
    return SecurityRequest;
};