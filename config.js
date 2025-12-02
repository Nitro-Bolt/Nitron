// Copy this file as "config.js"

module.exports = {
    // Create an application on https://discord.com/developers/applications then
    // copy and paste the application ID here as a string.
    applicationId: '1234',

    // On https://discord.com/developers/applications enable bot for the application,
    // then copy and paste the bot token here.
    token: 'abc.def.ghi',

    // Create a role for mods (does not need any actual permissions), then
    // copy and paste its ID here as a string.
    modRoleId: 'right click on the role > copy id',

    // Create a channel for mod stuff, then
    // copy and paste its ID here as a string.
    modChannelId: '1336747005027811398',

    // Create a channel for logging, then
    // copy and paste its ID here as a string.
    logChannelId: '1445243462382518456',

    // Create a channel for the mod contact system, then
    // copy and paste its ID here as a string.
    contactChannelId: 'right click on the channel > copy id',

    // Create a channel for the starboard, then
    // copy and paste its ID here as a string.
    starboardChannelId: '1445243068545761403',

    // Create a webhook to post extremely important events, then put the URL here
    majorOffensesSignalingService: 'https://discord.com/api/webhooks/...',

    // Path to folder to save database in. Leave it empty to save it in the same
    // folder as the source code, which is fine for development (it is gitignored).
    // In production we recommend reading mount-encrypted-storage.example.sh.
    dataPath: ''
};
