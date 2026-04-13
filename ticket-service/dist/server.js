"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const app = (0, app_1.buildApp)();
app.listen({ port: env_1.env.port, host: '0.0.0.0' }, (err) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }
    console.log(`ticket-service escuchando en http://localhost:${env_1.env.port}`);
});
