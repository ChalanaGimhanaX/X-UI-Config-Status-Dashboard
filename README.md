# X-UI Config Status Dashboard

A modern, 3D-animated dashboard to view X-UI V2Ray configuration status across multiple panels.

Features
- Dynamic endpoints loaded from `.env`
- Real-time status, traffic (upload, download, total)
- Copy VLESS URLs & QR code generation
- Responsive, glassmorphic 3D UI with neon effects

Demo  
![Dashboard Demo](docs/demo.gif)

## Installation

1. Clone repo  
   `git clone https://github.com/ChalanaGimhanaX/X-UI-Config-Status-Dashboard.git`  
2. Install dependencies  
   ```bash
   cd X-UI Config Status Dashboard"
   npm install
   ```
3. Copy `.env.example` → `.env` and fill values  
4. Build & start  
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

```properties
# Server endpoints
PANEL1_URL=your_sg1_panel_url
PANEL2_URL=your_sg2_panel_url


# Authentication credentials for panels
PANEL1_USERNAME=your_panel_password
PANEL1_PASSWORD=your_panel_password
PANEL2_USERNAME=your_panel_password
PANEL2_PASSWORD=your_panel_password


# API settings
API_PORT=3000

```

## API Endpoints

- `GET /api/servers`  
  Returns list of panels from `.env`.

- `GET /api/configstatus/:username_id`  
  Fetch status for given `username_id`.

## Contributing

Made by [chAlnA](https://github.com/ChalanaGimhanaX) ❤️  
Feel free to open issues or PRs.

