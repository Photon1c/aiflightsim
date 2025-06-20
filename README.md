# ☁️ ✈️ ☁️ AI Flight Simulator Version 1 ☁️ ✈️ ☁️ \

The live demo is now available [here](https://aiflightsim.netlify.app). Note that the AI backend *is not available* for the live demo.  

A modern web-based flight simulator with AI assistance, featuring both airplane and drone modes.

## Features

- **Multiple Vehicle Types**
  - Airplane with realistic flight physics
  - Quadcopter drone with arcade-style controls
  - Auto takeoff and landing capabilities

- **AI Integration**
  - Real-time flight assistance
  - Automated control modes
  - **Drone can now be flown by AI (toggle ON/OFF in overlay)**
  - AI control interval for drone: every 8 seconds
  - Flight data logging and analysis

- **Rich Environment**
  - Procedurally generated terrain
  - Dynamic trees and clouds
  - Infinite ground tiling
  - Chase camera with smooth following

- **Advanced Controls**
  - PID-based flight stabilization
  - Multiple control modes (Manual, Auto, PID)
  - Customizable control parameters
  - Real-time telemetry display

## Controls

### Airplane Mode
- **WASD/Arrows**: Pitch and Roll control
- **+/-**: Throttle control
- **E**: Toggle engine
- **\\**: Toggle AI assistance
- **/**:  Switch to manual mode
- **I**: Show instructions
- **L**: Export flight data
- **J**: Export AI feedback log
- **K**: Request AI feedback
- **H**: Manual log entry
- **C**: Force AI control update

### Drone Mode
- **WASD/Arrows**: Move horizontally
- **Q/E**: Up/Down
- **Z/C**: Yaw Left/Right
- **Shift**: Boost
- **I**: Show instructions
- **AI Button in overlay**: Toggle AI ON/OFF (AI flies the drone every 8 seconds)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## AI Backend Integration

The simulator connects to a local AI backend server for assistance:
- Default endpoint: http://localhost:3001
- Provides real-time flight suggestions
- Logs flight data and AI feedback
- Supports both aircraft and drone modes
- Simple ```node server.js``` command to deploy backend after ensuring .env file with OpenAI API key exists

## Development

- Built with Three.js and Vite
- Uses PID controllers for flight stability
- Implements modular vehicle system
- Features responsive UI with draggable overlays

## Deployment

The project is configured for deployment on Netlify:
- Automatic builds from main branch
- Asset optimization and caching
- Security headers configured
- SPA routing support

## License

MIT License - Feel free to use and modify for your own projects.
