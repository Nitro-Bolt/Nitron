const {
    Events,
    ActivityType,
    AuditLogEvent
} = require('discord.js');

const { token } = require('../config');
const cloneDeep = require("lodash.clonedeep");
const client = require('./client');
const dbBots = require('./db-bots');
const fs = require('fs');

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

const mods = {};
fs.readdirSync('src/modules').forEach(fname => {
    let fkey = fname
            .replace(/[-_]+(\w)/g, (match, c) => c.toUpperCase()) // file-name_here => fileNameHere so you can do mods.blahBlahBlah
            .slice(0, fname.indexOf('.'));
    fkey = fkey.replaceAll('.', '');

    mods[fkey] = require(`./modules/${fname}`);
});

const activityMessages = [
    'for thoughtcrime committers',
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
    setInterval(mods.contactMods.ticketActivity, 1 * 60 * 1000);
    setInterval(() => {
        dbBots.prepare(`
            DELETE FROM tracked_ids WHERE created < ?
        `).run(Date.now());
    }, 60 * 60 * 1000);
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

        if (mods.bigBrother) await mods.bigBrother.checkThoughtcrime(message);
        mods.scanMessages.checkMessage(message);

        await mods.dmMail.handleDirectMessage(message);
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

        if (mods.bigBrother) await mods.bigBrother.checkThoughtcrime(newMessage);
        await mods.logging.editedMessage(oldMessage, newMessage);
        await mods.starBoard.onEditMessage(newMessage);
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.MessageDelete, async (message) => {
    try {
        await mods.logging.deletedMessage(message);
        await mods.starBoard.onDeleteMessage(message);
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    await mods.logging.voiceChat(oldState, newState);
});

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        switch (interaction.commandName) {
            case 'contactmods':
                await mods.contactMods.contactMods(interaction);
                break;
            case 'purge':
                await mods.purgeMessages.purgeMessages(interaction);
                break;
            case 'closethread':
                await mods.thread.close(interaction);
                break;
            case 'slowmode':
                await mods.slowmode.slowmode(interaction);
                break;
            case 'timeout':
                await mods.timeout.timeout(interaction);
                break;
            case 'botdm':
                await mods.dmMail.handleSendDirectMessage(interaction);
                break;
            case 'mutedm':
                await mods.dmMail.handleMuteDirectMessage(interaction);
                break;
            case 'unblock':
                await mods.unblock.unblock(interaction);
                break;
            case 'hashes':
                await mods.hashes.hash(interaction);
                break;
            case 'Report User':
                await mods.contactMods.reportUser(interaction);
                break;
            case 'Report Message':
                await mods.contactMods.reportMessage(interaction);
                break;
            case 'Thread owner: Pin':
                await mods.thread.pin(interaction);
                break;
            case 'Thread owner: Unpin':
                await mods.thread.unpin(interaction);
                break;
        }
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
        await mods.starBoard.onReaction(reaction);
    } catch (e) {
        console.error(e);
    }
});

client.on(Events.GuildMemberAdd, async (member) => {
    await mods.logging.userJoin(member,cloneDeep(invites));
});

client.on(Events.GuildMemberRemove, async (member) => {
    await mods.logging.userLeave(member);
});

client.on(Events.GuildAuditLogEntryCreate, async (auditLog) => {
    await mods.logging.auditLogs(auditLog);
    if (auditLog.action == AuditLogEvent.InviteCreate) {
        invites = await client.guilds.cache.first().invites.fetch();
    };
});

client.login(token);
