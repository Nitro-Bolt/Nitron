const { DMChannel, MessageFlags } = require('discord.js');
const client = require('../client.js');
const { modChannelId } = require('../../config.js');

/** @type {Map<number, number>} User ID to mute end in unix milliseconds */
const mutes = new Map();

const handleDirectMessage = async (message) => {
  if (message.channel instanceof DMChannel) {
    const author = message.author;

    const muteEnd = mutes.get(author.id) || 0;
    if (Date.now() < muteEnd) {
      return;
    }

    const modMessage = {
      content: `Received a DM from ${author}:\n\`\`\`\n${message.content.replace(/```/g, '[code block]')}\n\`\`\`Use \`/botdm user:${author.id} message:\` to reply, \`/mutedm user:${author.id} time:\` to mute`,
      files: message.attachments.map(i => ({
        name: i.name,
        attachment: i.url
      }))
    };
    const modChannel = await client.channels.fetch(modChannelId);

    try {
      await modChannel.send(modMessage);
    } catch (e1) {
      console.error(e1);

      try {
        // Try without attachments?
        modMessage.content += '\n**[Attachments too large]**';
        modMessage.files = [];
        await modChannel.send(modMessage);
        await message.reply('Your message was sent, but the attachments were too large so they were skipped');
      } catch (e2) {
        // ???
        console.error(e2);
        await message.reply('Something went wrong sending your message to moderators');
      }
    }
  }
};

const handleSendDirectMessage = async (interaction) => {
  if (interaction.channel.id !== modChannelId) {
    interaction.reply({
      content: `/botdm must be used in <#${modChannelId}> to ensure that other moderators can see you sent the message`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const user = interaction.options.getUser('user');
  if (!user) {
    await interaction.reply({
      content: `Couldn't find member`
    });
    return;
  }

  const content = interaction.options.getString('message') ?? '';
  await interaction.deferReply();

  let sentMessage = false;
  try {
    await user.send({
      content: `Message from NitroBolt moderation: ${content}`
    });
    sentMessage = true;
  } catch (error) {
    console.error(error);
  }

  if (sentMessage) {
    await interaction.editReply({
      content: `Sent message to ${user}: ${content}`
    });
  } else {
    await interaction.editReply({
      content: 'Message could not be sent'
    });
  }
};

const handleMuteDirectMessage = async (interaction) => {
  if (interaction.channel.id !== modChannelId) {
    interaction.reply({
      content: `/mutedm must be used in <#${modChannelId}> to ensure that other moderators are aware`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const user = interaction.options.getUser('user');
  if (!user) {
    await interaction.reply({
      content: `Couldn't find member`
    });
    return;
  }

  const timeMinutes = interaction.options.getInteger('time') ?? 1440;
  if (timeMinutes > 0) {
    const endUnixMilliseconds = Date.now() + timeMinutes * 60 * 1000;
    const endUnixSeconds = Math.round(endUnixMilliseconds / 1000);
    mutes.set(user.id, endUnixMilliseconds);
    await interaction.reply({
      content: `Muted DMs from ${user} until <t:${endUnixSeconds}:f> (${timeMinutes} minutes) (also resets upon server restart)`
    });
  } else {
    mutes.delete(user.id);
    await interaction.reply({
      content: `Unmuted DMs from ${user}`
    });
  }
};

module.exports = {
  handleDirectMessage,
  handleSendDirectMessage,
  handleMuteDirectMessage
};
