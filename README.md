# Arcani Discord Bot

A modular Discord bot built with Discord.js that serves as an 'intranet' for a security company. It allows customers to request on-site security assistance through Discord.

## Features

- **Security Request System**: Customers with the appropriate role can submit requests for on-site security
- **Alert System**: Security personnel receive alerts when new requests are submitted
- **Response Tracking**: Security team members can mark themselves as responding to a request
- **Request Conclusion**: Requests can be concluded with a reason when they are completed

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
   ```

3. Replace the placeholders with your actual values:
   - `DISCORD_TOKEN`: Your bot token obtained from the Discord Developer Portal
   - `CLIENT_ID`: Your bot's application ID
   - `GUILD_ID`: The ID of your Discord server
   - `CUSTOMER_ROLE_ID`: The role ID for customers who can request security
   - `SECURITY_ROLE_ID`: The role ID for security personnel
   - `ALERT_CHANNEL_ID`: The channel where security alerts will be posted

## Commands

### /request-security
Allows customers to request security assistance. Requires:
- **location**: Where security assistance is needed
- **details**: (Optional) Additional information about the situation

## Running the Bot

1. Deploy commands to your Discord server:
   ```bash
   npm run deploy
   ```

2. Start the bot:
   ```bash
   npm start
   ```

## Development

### Project Structure
- `index.js`: Main entry point that loads commands and events
- `deploy-commands.js`: Script to register slash commands with Discord
- `commands/`: Contains command files
- `events/`: Contains event handler files

### Documentation
Generate documentation:
```bash
npm run docs
```

This creates HTML documentation in the `docs/` directory.
