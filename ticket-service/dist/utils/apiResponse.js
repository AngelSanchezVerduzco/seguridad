"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function normalizeData(data) {
    if (data === undefined)
        return [];
    if (Array.isArray(data))
        return data;
    return [data];
}
function mergeMessageIntoFirstData(dataArray, message) {
    if (!message || dataArray.length === 0)
        return dataArray;
    const first = dataArray[0];
    if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
        return [{ ...first, message }, ...dataArray.slice(1)];
    }
    return [{ value: first, message }, ...dataArray.slice(1)];
}
function sendSuccess(reply, statusCode, message, data) {
    const dataArr = normalizeData(data);
    const next = mergeMessageIntoFirstData(dataArr, message);
    return reply.code(statusCode).send({
        statusCode,
        intOpCode: 0,
        data: next,
    });
}
function sendError(reply, statusCode, message, errors) {
    return reply.code(statusCode).send({
        statusCode,
        intOpCode: 1,
        data: [{ message, errors }],
    });
}
