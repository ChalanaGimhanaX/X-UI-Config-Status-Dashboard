"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv = __importStar(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const path = __importStar(require("path"));
// Load environment variables
dotenv.config({
    path: path.resolve(__dirname, '../.env')
});
// Initialize express app
const app = (0, express_1.default)();
const port = process.env.API_PORT || 3000;
// Configure middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path.join(__dirname, '../static')));
// Server configurations
const servers = {
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
const formatBytes = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0)
        return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};
const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
};
// API endpoint for config status
app.get('/api/configstatus/:username_id', async (req, res) => {
    try {
        const username_id = req.params.username_id;
        const results = await Promise.all(Object.entries(servers).map(async ([name, credentials]) => {
            try {
                // Login to get auth cookie/token
                const loginResponse = await axios_1.default.post(`${credentials.url}/login`, {
                    username: credentials.username,
                    password: credentials.password
                }, {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const cookies = loginResponse.headers['set-cookie'];
                // Get list of inbounds
                const inboundsResponse = await axios_1.default.get(`${credentials.url}/panel/api/inbounds/list`, {
                    headers: {
                        Cookie: cookies?.join('; ') || ''
                    },
                    timeout: 10000
                });
                if (!inboundsResponse.data.success) {
                    return {
                        name,
                        status: 'offline',
                        message: 'Failed to fetch inbounds',
                        configs: []
                    };
                }
                const inbounds = inboundsResponse.data.obj || [];
                const configs = [];
                // Process each inbound
                for (const inbound of inbounds) {
                    const inbound_id = inbound.id;
                    const inbound_port = inbound.port;
                    const inbound_remark = inbound.remark;
                    const inbound_expiry_ts = inbound.expiryTime;
                    // Match inbound remark with username_id
                    if (inbound_remark === username_id) {
                        // Get inbound details
                        const detailsResponse = await axios_1.default.get(`${credentials.url}/panel/api/inbounds/get/${inbound_id}`, {
                            headers: {
                                Cookie: cookies?.join('; ') || ''
                            },
                            timeout: 10000
                        });
                        if (detailsResponse.data.success) {
                            const details = detailsResponse.data.obj;
                            configs.push({
                                source: 'inbound',
                                config_name: inbound_remark,
                                status: details.enable ? 'Enabled' : 'Disabled',
                                expiry_date: new Date(inbound_expiry_ts).toISOString(),
                                port: inbound_port,
                                inbound_id: inbound_id
                            });
                        }
                    }
                    // Check for clients matching the username_id
                    try {
                        const settings = JSON.parse(inbound.settings || '{}');
                        const clients = settings.clients || [];
                        for (const client of clients) {
                            if (client.email === username_id) {
                                // Get client traffic
                                const trafficResponse = await axios_1.default.get(`${credentials.url}/panel/api/inbounds/getClientTraffics/${client.email}`, {
                                    headers: {
                                        Cookie: cookies?.join('; ') || ''
                                    },
                                    timeout: 10000
                                });
                                // Get online status
                                const onlineResponse = await axios_1.default.post(`${credentials.url}/panel/api/inbounds/onlines`, {}, {
                                    headers: {
                                        Cookie: cookies?.join('; ') || '',
                                        'Content-Type': 'application/json'
                                    },
                                    timeout: 10000
                                });
                                const traffic = trafficResponse.data.success ? trafficResponse.data.obj : { up: 0, down: 0, total: 0 };
                                const onlineClients = onlineResponse.data.success ? onlineResponse.data.obj : [];
                                configs.push({
                                    source: 'client',
                                    config_name: client.email,
                                    client_id: client.id,
                                    inbound_id: inbound_id,
                                    port: inbound_port,
                                    status: client.enable ? 'Enabled' : 'Disabled',
                                    online: onlineClients.includes(client.email),
                                    expiry_date: new Date(client.expiryTime).toISOString(),
                                    up: formatBytes(traffic.up),
                                    down: formatBytes(traffic.down),
                                    total: formatBytes(traffic.total),
                                    comment: client.comment || '',
                                    vless_url: `vless://${client.id}@${name.toLowerCase()}.netchlk.org:${inbound_port}?type=tcp&security=tls#${client.email.split('_')[0]}`
                                });
                            }
                        }
                    }
                    catch (error) {
                        console.log(`Error processing inbound ${inbound_id} clients: ${error}`);
                    }
                }
                return {
                    name,
                    status: 'online',
                    configs
                };
            }
            catch (error) {
                console.error(`Error processing server ${name}: ${error}`);
                return {
                    name,
                    status: 'offline',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    configs: []
                };
            }
        }));
        // Combine all results
        const allConfigs = results.flatMap(result => result.configs || []);
        if (allConfigs.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No configuration found for user: ${username_id}`,
                data: null
            });
        }
        return res.json({
            success: true,
            message: `Found ${allConfigs.length} configuration(s) for ${username_id}`,
            data: {
                servers: results,
                configs: allConfigs,
                count: allConfigs.length
            }
        });
    }
    catch (error) {
        console.error(`Unexpected error in /api/configstatus/${req.params.username_id}: ${error}`);
        return res.status(500).json({
            success: false,
            message: `An internal server error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
            data: null
        });
    }
});
// Default route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../static', 'index.html'));
});
// Start server
app.listen(port, () => {
    console.log(`⚡️ X-UI Config Status API running on port ${port}`);
});
exports.default = app;
