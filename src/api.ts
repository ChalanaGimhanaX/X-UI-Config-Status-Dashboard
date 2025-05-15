import express from 'express';
import * as dotenv from 'dotenv';
import axios from 'axios';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

// Initialize express app
const app = express();
const port = process.env.API_PORT || 3000;

// Configure middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../static')));

// Types definitions
interface ServerCredentials {
  url: string;
  username: string;
  password: string;
}

interface ServerStatus {
  name: string;
  status: 'online' | 'offline';
  cpu: string;
  memory: string;
  disk: string;
  network: {
    up: string;
    down: string;
  };
  uptime: string;
  error?: string;
}

// Server configurations
const servers: Record<string, ServerCredentials> = {
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
const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  return `${days}d ${hours}h ${minutes}m`;
};

// API endpoint: list available panels
app.get('/api/servers', (req, res) => {
  const list = Object.entries(servers).map(([name, creds]) => ({
    name,
    url: creds.url
  }));
  res.json({ success: true, servers: list });
});

// API endpoint for config status
app.get('/api/configstatus/:username_id', async (req: express.Request, res: express.Response) => {
  try {
    const username_id = req.params.username_id;
    const results = await Promise.all(
      Object.entries(servers).map(async ([name, credentials]) => {
        try {
          // Login to get auth cookie/token
          const loginResponse = await axios.post(`${credentials.url}/login`, {
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
          const inboundsResponse = await axios.get(`${credentials.url}/panel/api/inbounds/list`, {
            headers: {
              Cookie: cookies?.join('; ') || ''
            },
            timeout: 10000
          });
          
          if (!inboundsResponse.data.success) {
            return {
              name,
              status: 'offline' as const,
              message: 'Failed to fetch inbounds',
              configs: []
            };
          }
          
          const inbounds = inboundsResponse.data.obj || [];
          const configs: any[] = [];
          
          // Process each inbound
          for (const inbound of inbounds) {
            const inbound_id = inbound.id;
            const inbound_port = inbound.port;
            const inbound_remark = inbound.remark;
            const inbound_expiry_ts = inbound.expiryTime;
            
            // Match inbound remark with username_id
            if (inbound_remark === username_id) {
              // Get inbound details
              const detailsResponse = await axios.get(`${credentials.url}/panel/api/inbounds/get/${inbound_id}`, {
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
                  const trafficResponse = await axios.get(
                    `${credentials.url}/panel/api/inbounds/getClientTraffics/${client.email}`, {
                      headers: {
                        Cookie: cookies?.join('; ') || ''
                      },
                      timeout: 10000
                    }
                  );
                  
                  // Get online status
                  const onlineResponse = await axios.post(
                    `${credentials.url}/panel/api/inbounds/onlines`, {}, {
                      headers: {
                        Cookie: cookies?.join('; ') || '',
                        'Content-Type': 'application/json'
                      },
                      timeout: 10000
                    }
                  );
                  
                  const traffic = trafficResponse.data.success ? trafficResponse.data.obj : { up: 0, down: 0, total: 0 };
                  const onlineClients = onlineResponse.data.success ? onlineResponse.data.obj : [];
                  
                  // Ensure we properly handle timestamp formats for expiry dates
                  // Timestamp values might be in milliseconds or seconds, normalize to milliseconds
                  let expiryTimestamp = client.expiryTime;
                  if (expiryTimestamp && typeof expiryTimestamp === 'number') {
                    // If timestamp is in seconds (timestamps before year 2001), convert to milliseconds
                    if (expiryTimestamp < 32503680000) { // Jan 1, 2001 in seconds
                      expiryTimestamp = expiryTimestamp * 1000;
                    }
                  }
                  
                  configs.push({
                    source: 'client',
                    config_name: client.email,
                    client_id: client.id,
                    inbound_id: inbound_id,
                    port: inbound_port,
                    status: client.enable ? 'Enabled' : 'Disabled',
                    online: onlineClients.includes(client.email),
                    expiry_date: expiryTimestamp,  // Pass the timestamp directly
                    up: formatBytes(traffic.up),
                    down: formatBytes(traffic.down),
                    total: formatBytes(traffic.total),
                    comment: client.comment || '',
                    vless_url: `vless://${client.id}@${name.toLowerCase()}.netchlk.org:${inbound_port}?type=tcp&security=tls#${client.email.split('_')[0]}`
                  });
                }
              }
            } catch (error) {
              console.log(`Error processing inbound ${inbound_id} clients: ${error}`);
            }
          }
          
          return {
            name,
            status: 'online' as const,
            configs
          };
        } catch (error) {
          console.error(`Error processing server ${name}: ${error}`);
          return {
            name,
            status: 'offline' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
            configs: []
          };
        }
      })
    );
    
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
  } catch (error) {
    console.error(`Unexpected error in /api/configstatus/${req.params.username_id}: ${error}`);
    return res.status(500).json({
      success: false,
      message: `An internal server error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null
    });
  }
});

// Default route for SPA
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../static', 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`⚡️ X-UI Config Status API running on port ${port}`);
});

export default app;
