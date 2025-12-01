const {PermissionsBitField, MessageType, DMChannel} = require('discord.js');
const client = require('../client');
const db = require('../db');
const config = require('../../config');

db.exec(`
CREATE TABLE IF NOT EXISTS starboard (
    original_message_id TEXT NOT NULL UNIQUE,
    -- -1 means "not posted"
    -- >0 is a message ID
    starboard_message_id TEXT NOT NULL,
    count INT NOT NULL
);`);
db.exec('CREATE INDEX IF NOT EXISTS starboard_original_message_id_index ON starboard (original_message_id);');

const _addNewMessage = db.prepare(`
INSERT OR IGNORE INTO starboard (
    original_message_id,
    starboard_message_id,
    count
) VALUES (?, -1, 0);`);
const _getMessage = db.prepare('SELECT starboard_message_id, count FROM starboard WHERE original_message_id = ?;');
const _setStarboardMessageId = db.prepare('UPDATE starboard SET starboard_message_id = ? WHERE original_message_id = ?;');
const _setCount = db.prepare('UPDATE starboard SET count = ? WHERE original_message_id = ?');

const EMOJI = '⚡';
const THRESHOLD = 5;
const COLORS = [
    0xfe5726,
    0xffa126,
    0xff2626
];

const isPublicChannel = (channel) => {
    if (channel instanceof DMChannel) {
        return false;
    }

    const DISABLED_CHANNELS = [
        config.starboardChannelId,
        '1202712912783999067', // #updates
        '1202712865887494234', // #readme

        // mod channels; they should already be excluded by below checks but just to be safe...
        '1046570476417323049',
        '1150269777370165310',
        '1349407494501568603',
        '1349407854108479528',
    ];
    if (DISABLED_CHANNELS.includes(channel.id)) {
        return false;
    }

    const guild = channel.guild;
    const everyone = guild.roles.everyone;
    const permissions = channel.permissionsFor(everyone);
    return [
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.AddReactions
    ].every(i => permissions.has(i));
};

/**
 * @param {import('discord.js').Message} message
 * @returns {string|null}
 */
const stringifyMessageContent = (message) => {
    if (message.system) {
        switch (message.type) {
            case MessageType.UserJoin:
                return 'Joined the server';
            case MessageType.GuildBoost:
                return 'Boosted the server';
            case MessageType.GuildBoostTier1:
                return 'Boosted the server and made it reach level 1';
            case MessageType.GuildBoostTier2:
                return 'Boosted the server and made it reach level 2';
            case MessageType.GuildBoostTier3:
                return 'Boosted the server and made it reach level 3';
            case MessageType.PollResult:
                return 'Poll ended';
            case MessageType.ChannelPinnedMessage:
                return 'Pinned a message to this channel';
            case MessageType.ThreadCreated:
                return 'Created a thread';
            case MessageType.RecipientAdd:
                return `Added <@${message.mentions.users.first().id}> to a thread`;   
            case MessageType.RecipientRemove:
                return `Removed <@${message.mentions.users.first().id}> from a thread`;
            default:
                return `!!!!! Unknown message type ${message.type} !!!!!`;
        }
    }

    return message.messageSnapshots.size > 0 ? `-# *↱ Forwarded message:*\n${message.messageSnapshots.first().content}` : message.content;
};

/**
 * @param {import('discord.js').Message} message
 */
const updateMessage = async (message) => {
    await message.fetch();
    const starboardChannel = await client.channels.fetch(config.starboardChannelId);

    const startingMessage = _getMessage.get(message.id);
    const messageContent = stringifyMessageContent(message);
    const embedMessage = {
        allowedMentions: {},
        content: `${EMOJI} **${startingMessage.count}** - ${message.url} (<@${message.author.id}>)`,
        embeds: [
            {
                color: COLORS[BigInt(message.id) % BigInt(COLORS.length)],
                author: {
                    name: message.author.displayName,
                    url: message.url,
                    icon_url: message.author.displayAvatarURL()
                },
                ...(messageContent ? { description: messageContent } : {}),
                timestamp: new Date(message.createdTimestamp).toISOString()
            }
        ]
    };

    const attachments = message.messageSnapshots.size > 0 ? message.messageSnapshots.first().attachments : message.attachments;
    if (BigInt(startingMessage.starboard_message_id) < 0) {
        embedMessage.files = attachments.map(i => ({
            name: i.name,
            attachment: i.url
        }));

        // need to post the message for the first time
        const starboardMessage = await starboardChannel.send(embedMessage);
        _setStarboardMessageId.run(starboardMessage.id, message.id);

        // check for race conditions
        const endingMessage = _getMessage.get(message.id);
        if (BigInt(endingMessage.starboard_message_id) < 0) {
            // got deleted
            await starboardMessage.delete();
        } else if (endingMessage.count !== startingMessage.count) {
            // new count
            await updateMessage(message);
        }
    } else {
        // message was already posted, just need to update it
        const starboardMessage = await starboardChannel.messages.fetch(startingMessage.starboard_message_id);
        // message could have been deleted
        if (starboardMessage) {
            await starboardMessage.edit(embedMessage);
        }
    }
};

const onReaction = async (reaction) => {
    await reaction.fetch();
    if (reaction.emoji.name !== EMOJI) {
        return;
    }

    const message = reaction.message;
    const existingMessage = _getMessage.get(message.id);
    if (existingMessage) {
        // only store the largest count
        if (reaction.count > existingMessage.count) {
            _setCount.run(reaction.count, message.id);

            // if it hasn't been posted yet, don't do anything, the new count will be picked up automatically
            // if the message is still valid
            if (BigInt(existingMessage.starboard_message_id) > 0) {
                await updateMessage(message);
            }
        }
    } else if (reaction.count >= THRESHOLD) {
        _addNewMessage.run(message.id);

        const channel = message.channel;
        await channel.fetch();
        if (!isPublicChannel(channel)) {
            return;
        }

        _setCount.run(reaction.count, message.id);
        await updateMessage(message);
    }
};

const onDeleteMessage = async (message) => {
    // delete the starboard message if the original got deleted
    const existingMessage = _getMessage.get(message.id);

    if (existingMessage) {
        _setStarboardMessageId.run(-1, message.id);

        if (BigInt(existingMessage.starboard_message_id) > 0) {
            const starboardChannel = await client.channels.fetch(config.starboardChannelId);
            const toDelete = await starboardChannel.messages.fetch(existingMessage.starboard_message_id);
            if (toDelete) {
                await toDelete.delete();
            }
        }
    }
};

const onEditMessage = async (message) => {
    const existingMessage = _getMessage.get(message.id);
    if (existingMessage) {
        if (BigInt(existingMessage.starboard_message_id) > 0) {
            await updateMessage(message);
        }
    }
};

module.exports = {
    onReaction,
    onDeleteMessage,
    onEditMessage
};
