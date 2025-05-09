/**
 * @file Database migrations
 * @module Database/Migrations
 * @description Handles all database migrations for the application, including adding new columns
 * and initializing default configurations. This ensures database schema stays up-to-date
 * with code changes without requiring manual database manipulation.
 */

const { sequelize, ExternalServer, ServerConfig } = require('./models');
const { QueryTypes, DataTypes } = require('sequelize');

/**
 * Runs all database migrations
 * @returns {Promise<void>}
 * @example
 * // Execute all migrations during startup
 * await runMigrations();
 * console.log('All migrations completed successfully');
 */
async function runMigrations() {
    const migrations = [
        migrateLastAccessed,
        migrateServerConfigs,
        migrateBlacklistColumns
    ];
    
    for (const migration of migrations) {
        try {
            await migration();
        } catch (error) {
            console.error(`[ERROR] Migration failed: ${error.message}`, error);
            throw error;
        }
    }
    
    console.log('[INFO] All migrations completed successfully.');
}

/**
 * Migration to add lastAccessed column to ExternalServer table
 * @returns {Promise<void>}
 * @example
 * // Check and add lastAccessed column if needed
 * await migrateLastAccessed();
 */
async function migrateLastAccessed() {
    try {
        console.log('[INFO] Running migration: Adding lastAccessed column to ExternalServers');
        
        // First check if the ExternalServers table exists
        const tableListQuery = await sequelize.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ExternalServers';",
            { type: QueryTypes.SELECT }
        );
        
        // If table doesn't exist, we'll create it during model sync
        if (tableListQuery.length === 0) {
            console.log('[INFO] ExternalServers table does not exist yet. It will be created during model sync.');
            
            // Ensure the ExternalServer model is defined with the lastAccessed column
            if (!ExternalServer) {
                console.log('[WARN] ExternalServer model not loaded properly.');
                return;
            }
            
            // Force sync just this model to create the table with the column already
            await ExternalServer.sync();
            console.log('[INFO] ExternalServers table created with lastAccessed column.');
            return;
        }
        
        // If table exists, check if the column exists
        const tableInfo = await sequelize.query(
            "PRAGMA table_info(ExternalServers);",
            { type: QueryTypes.SELECT }
        );
        
        const hasLastAccessed = tableInfo.some(column => column.name === 'lastAccessed');
        
        if (!hasLastAccessed) {
            // Add the column
            await sequelize.query(
                "ALTER TABLE ExternalServers ADD COLUMN lastAccessed DATETIME;"
            );
            
            // Set default value for existing records
            await sequelize.query(
                "UPDATE ExternalServers SET lastAccessed = CURRENT_TIMESTAMP;"
            );
            
            console.log('[INFO] Migration completed: Added lastAccessed column to ExternalServers');
        } else {
            console.log('[INFO] Migration skipped: lastAccessed column already exists');
        }
    } catch (error) {
        console.error('[ERROR] Migration failed:', error);
        throw error;
    }
}

/**
 * Migration to create initial server configs from environment variables
 * @returns {Promise<void>}
 * @example
 * // Initialize server configs with environment variables
 * await migrateServerConfigs();
 */
async function migrateServerConfigs() {
    try {
        // First check if the ServerConfig table exists
        const tableListQuery = await sequelize.query(
            "SELECT name FROM sqlite_master WHERE type='table';",
            { type: QueryTypes.SELECT }
        );
        
        const tableNames = tableListQuery.map(result => result.name);
        console.log('[INFO] Found database tables:', tableNames);
        
        // Look for a table that might be our ServerConfig table (with various possible naming conventions)
        const possibleTableNames = ['ServerConfigs', 'serverconfigs', 'server_configs', 'ServerConfig'];
        const serverConfigTable = possibleTableNames.find(name => tableNames.includes(name));
        
        if (!serverConfigTable) {
            console.log('[INFO] ServerConfig table does not exist yet, will be created during sync');
            return;
        }
        
        // Check if we already have any server configs
        const configsResult = await sequelize.query(
            `SELECT COUNT(*) as count FROM ${serverConfigTable};`,
            { type: QueryTypes.SELECT }
        );
        
        const configCount = configsResult[0]?.count || 0;
        
        if (configCount === 0) {
            console.log('[INFO] Running migration: Creating initial server configuration');
            
            const mainGuildId = process.env.GUILD_ID;
            if (mainGuildId) {
                // Create config using model to ensure proper table name
                console.log('[INFO] Creating initial server config for guild ID:', mainGuildId);
                try {
                    await ServerConfig.create({
                        serverId: mainGuildId,
                        securityRoleId: null, // Removed process.env fallback
                        customerRoleId: null, // Removed process.env fallback
                        alertChannelId: null  // Removed process.env fallback
                    });
                    console.log('[INFO] Migration completed: Created initial server configuration');
                } catch (createError) {
                    // If direct model creation fails, log but don't throw error
                    console.error('[WARN] Could not create config using model, will create on first use:', createError.message);
                }
            } else {
                console.log('[INFO] Migration skipped: No GUILD_ID in environment variables');
            }
        } else {
            console.log(`[INFO] Migration skipped: Server configurations already exist (${configCount} found)`);
        }
    } catch (error) {
        // Log error but don't fail startup - we'll create configs when needed
        console.error('[ERROR] Migration warning (non-fatal):', error.message);
        console.log('[INFO] Will create server configs as needed during operation');
    }
}

/**
 * Migration to add blacklist columns to tables
 * @returns {Promise<void>}
 * @example
 * // Add blacklist columns to tables
 * await migrateBlacklistColumns();
 */
async function migrateBlacklistColumns() {
    try {
        console.log('[INFO] Running migration: Adding blacklist columns');
        
        // Get list of tables
        const tableListQuery = await sequelize.query(
            "SELECT name FROM sqlite_master WHERE type='table';",
            { type: QueryTypes.SELECT }
        );
        
        const tableNames = tableListQuery.map(result => result.name);
        
        // Step 1: Add blacklist_role_id to ServerConfigs
        const serverConfigsTable = ['ServerConfigs', 'serverconfigs', 'server_configs', 'ServerConfig']
            .find(name => tableNames.includes(name));
            
        if (serverConfigsTable) {
            // Check if column exists
            const serverConfigColumns = await sequelize.query(
                `PRAGMA table_info(${serverConfigsTable});`,
                { type: QueryTypes.SELECT }
            );
            
            const hasBlacklistRoleId = serverConfigColumns.some(column => 
                column.name === 'blacklistRoleId' || column.name === 'blacklist_role_id');
                
            if (!hasBlacklistRoleId) {
                console.log(`[INFO] Adding blacklist_role_id column to ${serverConfigsTable}`);
                await sequelize.query(
                    `ALTER TABLE ${serverConfigsTable} ADD COLUMN blacklist_role_id TEXT;`
                );
                console.log('[INFO] Added blacklist_role_id column to ServerConfigs table');
            } else {
                console.log('[INFO] blacklist_role_id column already exists in ServerConfigs');
            }
        }
        
        // Step 2: Add blacklist columns to ExternalServers
        const externalServersTable = ['ExternalServers', 'externalservers', 'external_servers', 'ExternalServer']
            .find(name => tableNames.includes(name));
            
        if (externalServersTable) {
            // Check if columns exist
            const externalServerColumns = await sequelize.query(
                `PRAGMA table_info(${externalServersTable});`,
                { type: QueryTypes.SELECT }
            );
            
            const hasIsBlacklisted = externalServerColumns.some(column => 
                column.name === 'isBlacklisted' || column.name === 'is_blacklisted');
                
            if (!hasIsBlacklisted) {
                console.log(`[INFO] Adding is_blacklisted column to ${externalServersTable}`);
                await sequelize.query(
                    `ALTER TABLE ${externalServersTable} ADD COLUMN is_blacklisted BOOLEAN DEFAULT 0;`
                );
                console.log('[INFO] Added is_blacklisted column to ExternalServers table');
            } else {
                console.log('[INFO] is_blacklisted column already exists in ExternalServers');
            }
            
            const hasBlacklistReason = externalServerColumns.some(column => 
                column.name === 'blacklistReason' || column.name === 'blacklist_reason');
                
            if (!hasBlacklistReason) {
                console.log(`[INFO] Adding blacklist_reason column to ${externalServersTable}`);
                await sequelize.query(
                    `ALTER TABLE ${externalServersTable} ADD COLUMN blacklist_reason TEXT;`
                );
                console.log('[INFO] Added blacklist_reason column to ExternalServers table');
            } else {
                console.log('[INFO] blacklist_reason column already exists in ExternalServers');
            }
        }
        
        console.log('[INFO] Migration completed: Added blacklist columns');
    } catch (error) {
        console.error('[ERROR] Migration failed (blacklist columns):', error);
        throw error;
    }
}

module.exports = {
    runMigrations
};