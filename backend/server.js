require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());
app.use(cors());

const logDir = path.join(__dirname, 'log');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logFile = path.join(logDir, 'ai_flight_log.jsonl');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/flight-feedback', async (req, res) => {
  const { flightData, mode } = req.body;
  let prompt;
  if (mode === 'control') {
    prompt = `Given this flight data: ${JSON.stringify(flightData)}, what should the next pitch, roll, yaw, and throttle deltas be for smooth, level flight and to maintain an altitude of at least 500 ft? Also, suggest new PID targets for pitch, roll, yaw, and altitude. Respond ONLY with a valid JSON object: {"pitch": ..., "roll": ..., "yaw": ..., "throttle": ..., "targetPitch": ..., "targetRoll": ..., "targetYaw": ..., "targetAltitude": ...}. Do not include any explanation, comments, or extra text. If you cannot determine a value, set it to 0. Return ONLY the JSON object.`;
  } else {
    prompt = `Given this flight data: ${JSON.stringify(flightData)}, what control adjustments would you recommend for smoother flight?`;
  }
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }]
  });
  const aiResponse = response.choices[0].message.content;
  // Append log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    mode,
    flightData,
    aiResponse
  };
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.error('Failed to write log:', err);
  }
  res.json({ aiResponse });
});

app.post('/api/manual-log', (req, res) => {
  const { flightData } = req.body;
  const logEntry = {
    timestamp: new Date().toISOString(),
    mode: 'manual-log',
    flightData
  };
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Failed to write manual log:', err);
    res.status(500).json({ status: 'error' });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));