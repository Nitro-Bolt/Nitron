const { PermissionsBitField } = require('discord.js');
const config = require('../../config');

const slowmode = async (interaction) => {
  const modRole = await interaction.guild.roles.fetch(config.modRoleId);
  let slowmodeTime = interaction.options.getString('time');
  const slowmodeReason = interaction.options.getString('reason');

  if (slowmodeTime === null) {
    slowmodeTime = 30;
  }

  const currentRateLimit = interaction.channel.rateLimitPerUser;

  if (slowmodeTime === 'freeze') {
    await interaction.channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        [PermissionsBitField.Flags.SendMessages]: false,
        [PermissionsBitField.Flags.CreatePublicThreads]: false,
        [PermissionsBitField.Flags.CreatePrivateThreads]: false,
      }
    );

    await interaction.channel.permissionOverwrites.edit(modRole, {
      [PermissionsBitField.Flags.SendMessages]: true,
      [PermissionsBitField.Flags.CreatePublicThreads]: true,
      [PermissionsBitField.Flags.CreatePrivateThreads]: true,
    });

    return await interaction.reply(
      `❄️ Channel has been frozen. Only moderators can send messages or create threads.`
    );
  } else if (slowmodeTime === 'thaw' || slowmodeTime === currentRateLimit) {
    await interaction.channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        [PermissionsBitField.Flags.SendMessages]: null,
        [PermissionsBitField.Flags.CreatePublicThreads]: null,
        [PermissionsBitField.Flags.CreatePrivateThreads]: null,
      }
    );

    await interaction.channel.permissionOverwrites.edit(modRole, {
      [PermissionsBitField.Flags.SendMessages]: null,
      [PermissionsBitField.Flags.CreatePublicThreads]: null,
      [PermissionsBitField.Flags.CreatePrivateThreads]: null,
    });

    await interaction.channel.setRateLimitPerUser(
      0,
      `Slowmode and freeze disabled by ${interaction.user.username} for reason: ` +
        (slowmodeReason ?? 'No reason provided')
    );
    return await interaction.reply(
      `⛅ Slowmode and freeze have been disabled in this channel.`
    );
  } else {
    slowmodeTime = parseInt(slowmodeTime);

    if (currentRateLimit > 0) {
      if (currentRateLimit === slowmodeTime) {
        return await interaction.reply(
          `⏳ Slowmode is already set to **${slowmodeTime} second(s)**.`
        );
      }
      await interaction.channel.setRateLimitPerUser(
        slowmodeTime,
        `Slowmode updated by ${interaction.user.username} for reason: ` +
          (slowmodeReason ?? 'No reason provided')
      );
      return await interaction.reply(
        `🌨️ Slowmode updated to **${slowmodeTime} second(s)**.`
      );
    }

    await interaction.channel.setRateLimitPerUser(
      slowmodeTime,
      `Slowmode set by ${interaction.user.username} for reason: ` +
        (slowmodeReason ?? 'No reason provided')
    );
    return await interaction.reply(
      `🌨️ Slowmode enabled for **${slowmodeTime} second(s)**.`
    );
  }
};

module.exports = {
  slowmode,
};
