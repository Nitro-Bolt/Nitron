const {
    Events,
    ActivityType,
    AuditLogEvent
} = require('discord.js');
const {
    token
} = require('../config');
const cloneDeep = require("lodash.clonedeep");

const client = require('./client');

const tryRequire = (path) => {
    try {
        return require(path);
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            return null;
        } else {
            throw e;
        }
    }
};

const starBoard = require('./modules/star-board');
const contactMods = require('./modules/contact-mods');
const purgeMessages = require('./modules/purge-messages');
const thread = require('./modules/thread');
const logging = require('./modules/logging');
const slowmode = require('./modules/slowmode');
const timeout = require('./modules/timeout');
const dmMail = require('./modules/dm-mail');
const bigBrother = tryRequire('./modules/big-brother');

const activityMessages = [
    'for thoughtcrime comitters',
    'for uncubester behaviour',
    'for evilness'
];

client.once(Events.ClientReady, (client) => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity({
        type: ActivityType.Watching,
        name: activityMessages[Math.floor(Math.random() * activityMessages.length)]
    });
});

let invites;

client.on(Events.ClientReady, async (client) => {
    setInterval(contactMods.ticketActivity, 1 * 60 * 1000);
    invites = await client.guilds.cache.first().invites.fetch();
});

client.on(Events.MessageCreate, async (message) => {
    try {
        if (message.partial) {
            await message.fetch();
        }

        if (message.author.id === client.user.id) {
            return;
        }

        if (bigBrother) await bigBrother.checkThoughtcrime(message);

        await dmMail.handleDirectMessage(message);
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
        if (newMessage.partial) {
            await newMessage.fetch();
        }

        if (newMessage.author.id === client.user.id) {
            return;
        }

        if (bigBrother) await bigBrother.checkThoughtcrime(newMessage);
        await logging.editedMessage(oldMessage, newMessage);
        await starBoard.onEditMessage(newMessage);
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.MessageDelete, async (message) => {
    try {
        await logging.deletedMessage(message);
        await starBoard.onDeleteMessage(message);
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    await logging.voiceChat(oldState, newState);
});

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        switch (interaction.commandName) {
            case 'contactmods':
                await contactMods.contactMods(interaction);
                break;
            case 'purge':
                await purgeMessages.purgeMessages(interaction);
                break;
            case 'closethread':
                await thread.close(interaction);
                break;
            case 'slowmode':
                await slowmode.slowmode(interaction);
                break;
            case 'timeout':
                await timeout.timeout(interaction);
                break;
            case 'botdm':
                await dmMail.handleSendDirectMessage(interaction);
                break;
            case 'mutedm':
                await dmMail.handleMuteDirectMessage(interaction);
                break;
            case 'Report User':
                await contactMods.reportUser(interaction);
                break;
            case 'Report Message':
                await contactMods.reportMessage(interaction);
                break;
            case 'Thread owner: Pin':
                await thread.pin(interaction);
                break;
            case 'Thread owner: Unpin':
                await thread.unpin(interaction);
                break;
        }
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
        await starBoard.onReaction(reaction);
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.GuildMemberAdd, async (member) => {
    await logging.userJoin(member,cloneDeep(invites));
});

client.on(Events.GuildMemberRemove, async (member) => {
    await logging.userLeave(member);
});

client.on(Events.GuildAuditLogEntryCreate, async (auditLog) => {
    await logging.auditLogs(auditLog);
    if (auditLog.action == AuditLogEvent.InviteCreate) {
        invites = await client.guilds.cache.first().invites.fetch();
    };
});

client.login(token);
