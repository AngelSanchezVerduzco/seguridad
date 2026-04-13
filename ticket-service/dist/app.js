"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const tickets_routes_1 = require("./routes/tickets.routes");
function buildApp() {
    const app = (0, fastify_1.default)({ logger: true });
    app.register(cors_1.default, { origin: true });
    app.get('/health', async (_req, reply) => {
        return reply.status(200).send({ ok: true, service: 'ticket-service' });
    });
    app.register(tickets_routes_1.ticketsRoutes);
    return app;
}
