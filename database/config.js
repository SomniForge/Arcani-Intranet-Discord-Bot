/**
 * @file Database configuration
 * @module Database/Config
 */

const { Sequelize } = require('sequelize');
const path = require('path');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'arcani_bot.sqlite'),
    logging: (process.env.NODE_ENV === 'development') ? console.log : false
});

/**
 * Tests the database connection
 * @returns {Promise<void>}
 */
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('[DATABASE] Connection established successfully.');
    } catch (error) {
        console.error('[DATABASE] Unable to connect to the database:', error);
        throw error;
    }
}

module.exports = {
    sequelize,
    testConnection
};