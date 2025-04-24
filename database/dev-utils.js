/**
 * @file Development utility functions
 * @module Database/DevUtils
 * @description Utilities for development purposes, including permission bypasses.
 * @version 1.2.3
 * @since 1.2.0
 */

// Developer user ID with full permissions
const DEV_USER_ID = '175919890589286400';

/**
 * Checks if a user is a developer with full permissions
 * @param {string} userId - Discord user ID to check
 * @returns {boolean} True if the user is a developer
 */
function isDeveloper(userId) {
    return userId === DEV_USER_ID;
}

module.exports = {
    isDeveloper,
    DEV_USER_ID
};