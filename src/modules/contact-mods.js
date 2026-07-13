const {
  ChannelType,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const client = require('../client');
const config = require('../../config');

const doesTicketExist = (tickets, userId) => {
  return tickets.threads.some(thread => thread.name.endsWith(userId));
};

const findTicket = (tickets, userId) => {
  return tickets.threads.find(thread => thread.name.endsWith(userId));
};

const ticketActivity = async () => {
  const contactChannel = await client.channels.fetch(config.contactChannelId);
  const activeThreads = await contactChannel.threads.fetchActive();

  const currentTime = Date.now();
  for (const thread of activeThreads.threads) {
    const lastActivityTimestamp = thread.lastMessage?.createdTimestamp || thread.createdAt;
    const inactiveDuration = currentTime - lastActivityTimestamp;

    if (inactiveDuration >= 86400000) {
      await thread.send('Ticket auto-closed due to no activity for 24 hours.');
      await thread.setLocked(true);
      await thread.setArchived(true);
    }
  }
};

const contactMods = async (interaction) => {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  const topic = interaction.options.getString('topic');
  const reason = interaction.options.getString('information');
  const modRole = await interaction.guild.roles.fetch(config.modRoleId);
  const contactChannel = await client.channels.fetch(config.contactChannelId);

  const recentMessages = await interaction.channel.messages.fetch({
    limit: 1
  });
  const mostRecentMessage = recentMessages.first();

  const username = interaction.member.nickname ?? interaction.user.displayName;
  if (!doesTicketExist(await contactChannel.threads.fetchActive(), interaction.user.id)) {
    const thread = await contactChannel.threads.create({
      name: `${username} - ${interaction.user.id}`,
      type: ChannelType.PrivateThread
    });

    await thread.send({
      content: `<@&${modRole.id}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4C4C)
          .setAuthor({
            name: `${username}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTitle(`${topic}`)
          .addFields({
            name: 'Reason for contacting:',
            value: `${reason}`
          })
          .addFields({
            name: 'Recent Context:',
            value: mostRecentMessage ? `${mostRecentMessage.url}` : 'None :('
          })
      ]
    });
    thread.members.add(interaction.user.id);

    await interaction.editReply({
      content: `Ticket created successfully! ${thread.url}`
    });
  } else {
    const thread = findTicket(await contactChannel.threads.fetchActive(), interaction.user.id);

    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4C4C)
          .setAuthor({
            name: `${username}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTitle(`${topic}`)
          .addFields({
            name: 'Reason for contacting:',
            value: `${reason}`
          })
          .addFields({
            name: 'Recent Context:',
            value: mostRecentMessage ? `${mostRecentMessage.url}` : 'None :('
          })
      ]
    });

    await interaction.editReply({
      content: `Ticket updated successfully! ${thread.url}`
    });
  }
};

const reportMessage = async (interaction) => {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  const modRole = await interaction.guild.roles.fetch(config.modRoleId);
  const contactChannel = await client.channels.fetch(config.contactChannelId);

  const username = interaction.member.nickname ?? interaction.user.displayName;
  if (!doesTicketExist(await contactChannel.threads.fetchActive(), interaction.user.id)) {
    const thread = await contactChannel.threads.create({
      name: `${username} - ${interaction.user.id}`,
      type: ChannelType.PrivateThread
    });

    await thread.send({
      content: `<@&${modRole.id}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4C4C)
          .setAuthor({
            name: `${username}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTitle('Reported Message')
          .addFields({
            name: 'Link:',
            value: `${interaction.targetMessage.url}`
          })
      ]
    });
    thread.members.add(interaction.user.id);

    await interaction.editReply({
      content: `Reported message successfully! ${thread.url}`
    });
  } else {
    const thread = findTicket(await contactChannel.threads.fetchActive(), interaction.user.id);

    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4C4C)
          .setAuthor({
            name: `${username}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTitle('Reported Message')
          .addFields({
            name: 'Link:',
            value: `${interaction.targetMessage.url}`
          })
      ]
    });

    await interaction.editReply({
      content: `Reported message successfully! ${thread.url}`
    });
  }
};

const reportUser = async (interaction) => {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  const modRole = await interaction.guild.roles.fetch(config.modRoleId);
  const contactChannel = await client.channels.fetch(config.contactChannelId);

  const username = interaction.member.nickname ?? interaction.user.displayName;
  if (!doesTicketExist(await contactChannel.threads.fetchActive(), interaction.user.id)) {
    const thread = await contactChannel.threads.create({
      name: `${username} - ${interaction.user.id}`,
      type: ChannelType.PrivateThread
    });

    await thread.send({
      content: `<@&${modRole.id}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4C4C)
          .setAuthor({
            name: `${username}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTitle('Reported User')
          .addFields({
            name: 'User:',
            value: `<@${interaction.targetUser.id}>`
          })
      ]
    });
    thread.members.add(interaction.user.id);

    await interaction.editReply({
      content: `Reported user successfully! ${thread.url}`
    });
  } else {
    const thread = findTicket(await contactChannel.threads.fetchActive(), interaction.user.id);

    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4C4C)
          .setAuthor({
            name: `${username}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTitle('Reported User')
          .addFields({
            name: 'User:',
            value: `<@${interaction.targetUser.id}>`
          })
      ]
    });

    await interaction.editReply({
      content: `Reported user successfully! ${thread.url}`
    });
  }
};

module.exports = {
  ticketActivity,
  contactMods,
  reportMessage,
  reportUser
};
