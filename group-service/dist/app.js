"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const groups_routes_1 = __importDefault(require("./routes/groups.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'group-service' });
});
app.use('/api/groups', groups_routes_1.default);
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: 'Error interno del servidor' });
});
exports.default = app;
