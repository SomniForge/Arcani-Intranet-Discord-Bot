/**
 * @file Database configuration
 * @module Database/Config
 * @description Configures the database connection settings for the application,
 * setting up the Sequelize instance with SQLite for persistent data storage.
 */

const { Sequelize } = require('sequelize');
const path = require('path');

// Create a SQLite database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'arcani_bot.sqlite'),
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
        // Add created_at and updated_at timestamps to all tables
        timestamps: true,
        // Use underscored style for auto-generated fields
        underscored: true
    }
});

module.exports = { sequelize };