# Nitron - Open Source

The open source parts of the NitroBolt Discord server's bot.

## Why only "the open source parts"?

Nitron's primary purpose is moderation. We believe that sharing the exact code used to do these moderation checks would severely cripple its moderation abilities as it would be trivial to bypass.

## Scope

Nitron is only intended to be used in the NitroBolt server. It is not a general purpose bot. Parts of the code might be interesting to reference but the bot probably is not useful on its own.

Some other Scratch-related servers have very large bots with a lot of interactive features. We're not interested in that. Our bot just facilitates human-to-human conversations -- it's not something you are supposed to regularly interact directly with.

## How to run it

Copy `config.example.js` as `config.js` and replace the fields appropriately. `config.js` is part of `.gitignore` so it will not be committed.

Install dependencies:

```bash
npm ci
```

Tell Discord about the bot commands:

```bash
node src/register-commands
```

Start the bot:

```bash
node src/index
```

## License

Nitron's open source parts are licensed under Apache 2.0. See [LICENSE](LICENSE) for more information.
