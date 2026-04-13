"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileSchema = compileSchema;
exports.validateBodyOrReply = validateBodyOrReply;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const apiResponse_1 = require("../utils/apiResponse");
const ajv = new ajv_1.default({ allErrors: true, strict: false });
(0, ajv_formats_1.default)(ajv);
function formatErrors(errors) {
    if (!errors)
        return [];
    return errors.map((error) => {
        const path = error.instancePath || '/';
        return `${path} ${error.message ?? 'valor inválido'}`.trim();
    });
}
function compileSchema(schema) {
    return ajv.compile(schema);
}
function validateBodyOrReply(reply, validate, body) {
    const ok = validate(body);
    if (!ok) {
        const errors = formatErrors(validate.errors);
        (0, apiResponse_1.sendError)(reply, 400, 'Body inválido según JSON Schema', errors);
        return false;
    }
    return true;
}
