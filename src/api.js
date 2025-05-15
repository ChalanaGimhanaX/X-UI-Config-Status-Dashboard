"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var dotenv_1 = require("dotenv");
var axios_1 = require("axios");
var cors_1 = require("cors");
var path_1 = require("path");
// Load environment variables
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, '../.env')
});
// Initialize express app
var app = (0, express_1.default)();
var port = process.env.API_PORT || 3000;
// Configure middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, '../static')));
// Server configurations
var servers = {
    'SG1': {
        url: process.env.SG1_PANEL_URL || '',
        username: process.env.SG1_USERNAME || '',
        password: process.env.SG1_PASSWORD || ''
    },
    'SG2': {
        url: process.env.SG2_PANEL_URL || '',
        username: process.env.SG2_USERNAME || '',
        password: process.env.SG2_PASSWORD || ''
    },
    'SG-STREAMER': {
        url: process.env.SG_STREAMER_PANEL_URL || '',
        username: process.env.SG_STREAMER_USERNAME || '',
        password: process.env.SG_STREAMER_PASSWORD || ''
    }
};
// Utility functions
var formatBytes = function (bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0)
        return '0 Bytes';
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};
var formatUptime = function (seconds) {
    var days = Math.floor(seconds / (3600 * 24));
    var hours = Math.floor((seconds % (3600 * 24)) / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    return "".concat(days, "d ").concat(hours, "h ").concat(minutes, "m");
};
// API Routes
app.get('/api/status', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var statusPromises, results, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                statusPromises = Object.entries(servers).map(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                    var loginResponse, cookies, statusResponse, data, error_2;
                    var name = _b[0], credentials = _b[1];
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _c.trys.push([0, 3, , 4]);
                                return [4 /*yield*/, axios_1.default.post("".concat(credentials.url, "/login"), {
                                        username: credentials.username,
                                        password: credentials.password
                                    }, {
                                        timeout: 10000,
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    })];
                            case 1:
                                loginResponse = _c.sent();
                                cookies = loginResponse.headers['set-cookie'];
                                return [4 /*yield*/, axios_1.default.get("".concat(credentials.url, "/server/status"), {
                                        headers: {
                                            Cookie: (cookies === null || cookies === void 0 ? void 0 : cookies.join('; ')) || ''
                                        },
                                        timeout: 10000
                                    })];
                            case 2:
                                statusResponse = _c.sent();
                                data = statusResponse.data;
                                return [2 /*return*/, {
                                        name: name,
                                        status: 'online',
                                        cpu: "".concat(data.cpu.toFixed(1), "%"),
                                        memory: "".concat(formatBytes(data.mem.current), " / ").concat(formatBytes(data.mem.total)),
                                        disk: "".concat(formatBytes(data.disk.used), " / ").concat(formatBytes(data.disk.total)),
                                        network: {
                                            up: formatBytes(data.netIO.up),
                                            down: formatBytes(data.netIO.down)
                                        },
                                        uptime: formatUptime(data.uptime)
                                    }];
                            case 3:
                                error_2 = _c.sent();
                                return [2 /*return*/, {
                                        name: name,
                                        status: 'offline',
                                        cpu: 'N/A',
                                        memory: 'N/A',
                                        disk: 'N/A',
                                        network: {
                                            up: 'N/A',
                                            down: 'N/A'
                                        },
                                        uptime: 'N/A',
                                        error: error_2 instanceof Error ? error_2.message : 'Unknown error'
                                    }];
                            case 4: return [2 /*return*/];
                        }
                    });
                }); });
                return [4 /*yield*/, Promise.all(statusPromises)];
            case 1:
                results = _a.sent();
                res.json({
                    success: true,
                    timestamp: new Date().toISOString(),
                    servers: results
                });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                res.status(500).json({
                    success: false,
                    message: error_1 instanceof Error ? error_1.message : 'Unknown error occurred',
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Default route for SPA
app.get('*', function (req, res) {
    res.sendFile(path_1.default.join(__dirname, '../static', 'index.html'));
});
// Start server
app.listen(port, function () {
    console.log("\u26A1\uFE0F X-UI Config Status API running on port ".concat(port));
});
exports.default = app;
