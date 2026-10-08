const http = require('node:http');
const promClient = require('@prometheus-io/client');
const client = require('./client');

const ready = new promClient.Gauge({
    name: 'turbo_robot_ready',
    help: 'Connected to Discord',
    collect() {
        this.set(client.isReady() ? 1 : 0);
    }
});

const ping = new promClient.Gauge({
    name: 'turbo_robot_ping_seconds',
    help: 'Discord ping',
    collect() {
        if (client.ws.ping >= 0) {
            this.set(client.ws.ping / 1000);
        }
    }
});

const handlerDuration = new promClient.Histogram({
    name: 'turbo_robot_handler_duration_seconds',
    help: 'Event handler duration',
    labelNames: ['event']
});

/**
 * client.on wrapper that records time.
 * @template {keyof import('discord.js').ClientEvents} Event
 * @param {Event} event
 * @param {(...args: import('discord.js').ClientEvents[Event]) => unknown} handler
 */
const on = (event, handler) => {
    handlerDuration.zero({
        event
    });

    client.on(event, async (...args) => {
        const end = handlerDuration.startTimer({
            event
        });
        try {
            await handler(...args);
        } finally {
            end();
        }
    });
};

const listen = () => {
    if (!process.env.METRICS_PORT) {
        return;
    }

    const port = +process.env.METRICS_PORT;
    promClient.collectDefaultMetrics();

    const metricsServer = http.createServer((req, res) => {
        promClient.register.metrics()
            .then((body) => {
                res.setHeader('Content-Type', promClient.register.contentType);
                res.end(body);
            })
            .catch((error) => {
                console.error(error);
                res.statusCode = 500;
                res.end();
            });
    });

    metricsServer.listen(port, '127.0.0.1', () => {
        console.log(`Metrics on port ${port}`);
    });
};

module.exports = {
    on,
    listen
};
