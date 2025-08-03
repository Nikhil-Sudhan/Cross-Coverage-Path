# 3D Coverage Path Planning with CesiumJS & Ion

An interactive 3D coverage path planning application built with CesiumJS and Cesium Ion. This tool allows users to draw polygons on a 3D terrain map and automatically generate optimized coverage paths for drones or other vehicles.

## Features

- Interactive polygon drawing on 3D terrain
- Automatic coverage path generation using a lawnmower pattern
- Terrain-following capability for elevation-aware flight paths
- Path smoothing to create more flyable routes
- Customizable parameters (altitude, line spacing, smoothing)
- Dynamic visualization of the path with start/end points
- Professional UI with sidebars and telemetry information

## Project Structure

```
/
├── index.html            - Main HTML file
├── app.js                - Main application logic
├── ui/                   - UI components
│   ├── controls.js       - User interface controls
│   ├── path-algorithms.js - Path planning algorithms
│   ├── styles.css        - Stylesheet for the application
│   └── icons/            - Icons for the application
└── README.md             - This documentation file
```

## Setup

1. **Get a Cesium Ion Token**:
   - Sign up at [https://cesium.com/ion/](https://cesium.com/ion/)
   - Create an access token
   - Replace the placeholder token in `app.js` with your own token:
   ```javascript
   Cesium.Ion.defaultAccessToken = 'YOUR_TOKEN_HERE';
   ```

2. **Serve the Application**:
   - You need to serve the files through a web server (not directly from the file system)
   - Using Python:
     ```
     python -m http.server
     ```
   - Using Node.js:
     ```
     npx http-server
     ```

3. **Access the Application**:
   - Open your browser and navigate to `http://localhost:8000` (or whatever port your server uses)

## Usage

1. **Draw a Polygon**:
   - Click the "Draw Polygon" button
   - Click multiple points on the map to create your area of interest
   - Double-click to complete the polygon

2. **Generate a Path**:
   - Adjust parameters as needed:
     - **Altitude**: Height above terrain (or fixed altitude if "Follow Terrain" is unchecked)
     - **Line Spacing**: Distance between parallel paths
     - **Follow Terrain**: When checked, the path will follow the terrain at the specified altitude
     - **Smooth Path**: When checked, smooths sharp turns for more flyable paths
     - **Smoothing Intensity**: Controls how aggressively to smooth the path
   - Click "Generate Path" to create the coverage path

3. **View the Results**:
   - The path is displayed as a yellow line over the terrain
   - Green point: Start position
   - Red point: End position
   - Telemetry panel shows path statistics:
     - Number of waypoints
     - Total path length
     - Estimated flight time
     - Area coverage

4. **Clear Everything**:
   - Click "Clear All" to remove the polygon and path

## Technical Implementation

- **Polygon Creation**: Uses Cesium's ScreenSpaceEventHandler for user interactions
- **Path Generation**: Creates a lawnmower pattern perpendicular to the longest edge
- **Path Smoothing**: Uses cubic Bezier curves to smooth sharp turns
- **Terrain Sampling**: Uses sampleTerrainMostDetailed() for elevation data
- **Line Clipping**: Custom implementation to ensure paths stay within the polygon
- **Modular Architecture**: Separates UI, path algorithms, and application logic

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests to improve the functionality or fix bugs.

## License

MIT License 