// Instructions for AI Flight Simulator

export const instructions = {
  plane: `
    <h2>Aircraft Controls</h2>
    <ul>
      <li><b>WASD/Arrows</b>: Pitch and Roll</li>
      <li><b>+/-</b>: Throttle</li>
      <li><b>E</b>: Toggle engine</li>
      <li><b>\\</b>: Toggle AI assistance</li>
      <li><b>/</b>: Switch to manual mode</li>
      <li><b>I</b>: Show instructions</li>
      <li><b>L</b>: Export flight data</li>
      <li><b>J</b>: Export AI feedback log</li>
      <li><b>K</b>: Request AI feedback</li>
      <li><b>H</b>: Manual log entry</li>
      <li><b>C</b>: Force AI control update</li>
    </ul>
  `,
  drone: `
    <h2>Drone Controls</h2>
    <ul>
      <li><b>WASD/Arrows</b>: Move horizontally</li>
      <li><b>Q/E</b>: Up/Down</li>
      <li><b>Z/C</b>: Yaw Left/Right</li>
      <li><b>Shift</b>: Boost</li>
      <li><b>I</b>: Show instructions</li>
      <li><b>AI Button in overlay</b>: Toggle AI ON/OFF (AI flies the drone every 8 seconds)</li>
    </ul>
    <div style="margin-top:10px;color:#8f8;">
      <b>New:</b> The drone can now be flown by AI! Toggle the AI ON/OFF using the overlay button. When ON, the AI will control the drone every 8 seconds.
    </div>
  `
}; 