# Arcani Discord Bot

A modular Discord bot built with Discord.js that serves as an 'intranet' for a security company. It allows customers to request on-site security assistance through Discord, with cross-server functionality.

## Features

- **Security Request System**: Customers with the appropriate role can submit requests for on-site security
- **Alert System**: Security personnel receive alerts when new requests are submitted
- **Response Tracking**: Security team members can mark themselves as responding to a request
- **Request Conclusion**: Requests can be concluded with a reason when they are completed
- **External Server Support**: Customers can add the bot to their own servers to request security
- **Role Management**: Security personnel can manage customer roles
- **Persistent Database**: All configurations and requests are stored in a database for reliability

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory with the following variables:

   ```
   DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
   CLIENT_ID=YOUR_CLIENT_ID_HERE
   GUILD_ID=YOUR_TEST_GUILD_ID_HERE
   CUSTOMER_ROLE_ID=YOUR_CUSTOMER_ROLE_ID_HERE
   SECURITY_ROLE_ID=YOUR_SECURITY_ROLE_ID_HERE
   ALERT_CHANNEL_ID=YOUR_ALERT_CHANNEL_ID_HERE
   NODE_ENV=production
   ```

3. Replace the placeholders with your actual values:
   - `DISCORD_TOKEN`: Your bot token obtained from the Discord Developer Portal
   - `CLIENT_ID`: Your bot's application ID
   - `GUILD_ID`: The ID of your Discord server
   - `CUSTOMER_ROLE_ID`: The role ID for customers who can request security
   - `SECURITY_ROLE_ID`: The role ID for security personnel
   - `ALERT_CHANNEL_ID`: The channel where security alerts will be posted
   - `NODE_ENV`: Set to "development" to enable additional logging

## Commands

### Internal Server Commands

#### /request-security

Allows customers to request security assistance. Requires:

- **location**: Where security assistance is needed
- **details**: (Optional) Additional information about the situation

#### /manage-customer

Allows security personnel to manage customer roles. Subcommands:

- **add**: Add a user to the customer role
  - **user**: The user to add to the customer role
- **remove**: Remove a user from the customer role
  - **user**: The user to remove from the customer role

#### /list-external-servers

Shows administrators a list of all external servers configured to use the bot.

- **show-inactive**: (Optional) Whether to show inactive servers

### External Server Commands

#### /setup-security-channel

Allows administrators in external servers to configure a channel for security requests.

- **channel**: The channel to use for security requests

#### /request-external-security

Allows users in external servers to request security assistance.

- **location**: Where security assistance is needed
- **details**: Details about the situation
- **contact**: Contact information (phone, email, etc.)

## Bot Permissions

The bot requires the following permissions in its OAuth2 invite link:

- Read Messages/View Channels
- Send Messages
- Embed Links
- Read Message History
- Add Reactions
- Use External Emojis
- Mention Everyone, Here, and All Roles
- Manage Roles
- Manage Messages
- Use Application Commands

Permission Integer: `275146623040`

OAuth2 URL Format:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=275146623040&scope=bot%20applications.commands
```

## Running the Bot

1. Deploy commands globally to all Discord servers:

   ```bash
   npm run deploy
   ```

2. Start the bot:
   ```bash
   npm start
   ```

## Database

The bot uses SQLite for persistent storage. The database file is located at:

```
database/arcani_bot.sqlite
```

### Database Models

- **ExternalServer**: Stores external server configurations
- **SecurityRequest**: Tracks all security requests and their status

## Deployment and Updates

### VPS Deployment

The bot includes a comprehensive deployment script for use on VPS servers, making updates simple and safe.

#### Setting Up the Update Script

1. Upload the `vps-update.sh` script to your VPS
2. Make it executable:
   ```bash
   chmod +x vps-update.sh
   ```
3. Configure the script variables at the top:
   ```bash
   BOT_DIR=""  # Update with your bot directory
   WEBHOOK_URL=""  # Optional: Add your Discord webhook URL for notifications
   ```

#### Features

The update script includes:

- **Automatic Database Backup**: Creates backups before each update
- **Discord Webhook Notifications**: Sends update status to a Discord channel (when configured)
- **Automatic Rollback**: Reverts to the previous working state if an update fails
- **Backup Rotation**: Maintains the last 7 backups and automatically removes older ones

#### Using the Update Script

To update your bot with the latest changes from GitHub:

```bash
./vps-update.sh
```

This will:

1. Create a backup of your database and code
2. Pull the latest changes from GitHub
3. Install any new dependencies
4. Restart the bot automatically

#### Manual Rollback

If you need to manually roll back to a previous version:

1. List available backups:

   ```bash
   ls -l /home/austin/arcani-bot/Arcani-Discord-Bot/backups
   ```

2. Edit the script to call the restore function with your desired backup name:

   ```bash
   # Add to the bottom of the script before exit
   restore_from_backup "arcani-bot_20250422_123456"
   ```

3. Run the script:
   ```bash
   ./vps-update.sh
   ```

#### Automating Updates

To automatically check for updates daily, add a cron job:

```bash
# Edit crontab
crontab -e

# Add this line to check for updates at 3:00 AM daily
0 3 * * * /home/austin/arcani-bot/Arcani-Discord-Bot/vps-update.sh
```

## Development

### Project Structure

- `index.js`: Main entry point that loads commands and events
- `deploy-commands.js`: Script to register slash commands with Discord
- `commands/`: Contains command files
- `events/`: Contains event handler files
- `database/`: Contains database configuration and models

### Documentation

Generate documentation:

```bash
npm run docs
```

This creates HTML documentation in the `docs/` directory.

## License

See the [LICENSE](LICENSE) file for details.
