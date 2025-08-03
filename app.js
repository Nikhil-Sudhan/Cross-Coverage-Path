// Replace with your actual Cesium Ion access token
// Get a new token from: https://cesium.com/ion/tokens
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNjFkZDVjMS1iMTEyLTRlN2QtOGUzZC03OGMxNjE2YzRlNzUiLCJpZCI6MjcxMjA5LCJpYXQiOjE3NTQyNDk1ODN9.Yh-Qc2YpqaKzU0y-Lm41fSdiaesXPacG5UQFdh5IWAA';

// App state (global scope)
let drawingMode = false;
let polygonPoints = [];
let polygonEntity = null;
let pathEntities = [];
let viewer;
let handler;
let ui;
let telemetryData = {
    waypointCount: 0,
    pathLength: 0,
    estTime: 0,
    areaCoverage: 0
};
let pathWaypoints = []; // Store generated waypoints
let missionName = "Untitled Mission";
let simulationActive = false;
let simulationInterval = null;

// Initialize the Cesium viewer after the library is loaded
window.addEventListener('load', function() {
    // Update the current date and time
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Initialize the app
    initializeApp();
});

// Update the date and time display
function updateDateTime() {
    const now = new Date();
    const dateTimeStr = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    document.getElementById('current-datetime').textContent = dateTimeStr;
}

// Initialize the application
async function initializeApp() {
    try {
        // First, test if Cesium is loaded properly
        if (typeof Cesium === 'undefined') {
            throw new Error('Cesium library not loaded');
        }
        
        // Test token before proceeding
        console.log('Testing Cesium token...');
        if (!Cesium.Ion.defaultAccessToken) {
            throw new Error('No Cesium Ion access token set');
        }
        
        // Use a fallback if createWorldTerrainAsync is not available
        let terrainProviderPromise = typeof Cesium.createWorldTerrainAsync === 'function' ? 
            Cesium.createWorldTerrainAsync() : 
            Promise.resolve(Cesium.createWorldTerrain());
        
        const terrainProvider = await terrainProviderPromise;
        
        // Initialize the Cesium viewer
        viewer = new Cesium.Viewer('cesiumContainer', {
            terrainProvider: terrainProvider,
            baseLayerPicker: true,
            timeline: false,
            animation: false,
            geocoder: true,
            navigationHelpButton: false,
            sceneModePicker: false
        });
        
        // Enable terrain depth testing to see the true terrain
        viewer.scene.globe.depthTestAgainstTerrain = true;
        
        // Set initial camera position
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(-100, 40, 10000),
            orientation: {
                heading: 0,
                pitch: -Cesium.Math.PI_OVER_TWO / 2,
                roll: 0
            }
        });
        
        // Initialize UI with app methods
        ui = initUI({
            startDrawingMode: startDrawingMode,
            generateCoveragePath: generateCoveragePath,
            clearAll: clearAll,
            saveMission: saveMission,
            loadMission: loadMission,
            startSimulation: startSimulation,
            stopSimulation: stopSimulation,
            setCameraMode: setCameraMode,
            updateMissionName: updateMissionName
        });
        
        // Set up the event handler
        handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        
        // Set up event handlers for polygon drawing
        setupEventHandlers();
        
        // Initialize the telemetry display
        updateTelemetryDisplay();
        
    } catch (error) {
        console.error('Error initializing application:', error);
        
        // Update status display
        document.getElementById('status-text').textContent = 'Error';
        document.querySelector('.status-icon').classList.remove('online');
        document.querySelector('.status-icon').classList.add('offline');
        
        // Show specific error message
        const errorMessage = error.message || 'Unknown error';
        if (errorMessage.includes('INVALID_TOKEN') || errorMessage.includes('Invalid access token')) {
            alert('Cesium token error: ' + errorMessage + '\n\nPlease check your token at https://cesium.com/ion/tokens');
        } else {
            alert('Application error: ' + errorMessage);
        }
    }
}

// Set up event handlers for drawing on the map
function setupEventHandlers() {
    // Event handler for clicks while drawing
    handler.setInputAction((click) => {
        if (!drawingMode) return;
        
        // Get the cartesian position from the click
        const cartesian = viewer.scene.pickPosition(click.position);
        if (!cartesian) return;
        
        // Add the point to our polygon
        polygonPoints.push(cartesian);
        
        // Update the polygon visual
        updatePolygonVisual();
        
        // Enable generate button if we have at least 3 points
        if (polygonPoints.length >= 3) {
            ui.enableGenerateButton();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    // Event handler for double-click to complete the polygon
    handler.setInputAction((click) => {
        if (!drawingMode || polygonPoints.length < 3) return;
        
        drawingMode = false;
        ui.enableDrawButton();
        ui.setInstructions('Click "Generate Path" to create a coverage path.');
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

// Start polygon drawing mode
function startDrawingMode() {
    // Reset existing polygon if any
    if (polygonEntity) {
        viewer.entities.remove(polygonEntity);
        polygonEntity = null;
    }
    
    // Clear existing paths
    clearPaths();
    
    // Reset telemetry
    resetTelemetry();
    
    // Reset points array
    polygonPoints = [];
    
    // Enable drawing mode
    drawingMode = true;
    ui.disableGenerateButton();
    ui.disableDrawButton();
    ui.setInstructions('Click on the map to add points. Double-click to complete the polygon.');
}

// Update the polygon visual
function updatePolygonVisual() {
    if (polygonEntity) {
        viewer.entities.remove(polygonEntity);
    }
    
    if (polygonPoints.length < 2) return;
    
    // Create a polygon entity
    polygonEntity = viewer.entities.add({
        polygon: {
            hierarchy: new Cesium.PolygonHierarchy(polygonPoints),
            material: new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.5)),
            outline: true,
            outlineColor: Cesium.Color.WHITE
        }
    });
    
    // If we have a complete polygon, calculate its area
    if (polygonPoints.length >= 3) {
        calculatePolygonArea();
    }
}

// Calculate and update the polygon area
function calculatePolygonArea() {
    const cartographicPoints = polygonPoints.map(point => {
        return Cesium.Cartographic.fromCartesian(point);
    });
    
    // Calculate area using a simple formula
    // This is a simple approximation for small areas
    let area = 0;
    for (let i = 0; i < cartographicPoints.length; i++) {
        const j = (i + 1) % cartographicPoints.length;
        const p1 = cartographicPoints[i];
        const p2 = cartographicPoints[j];
        
        // Convert to degrees for simpler calculation
        const lon1 = Cesium.Math.toDegrees(p1.longitude);
        const lat1 = Cesium.Math.toDegrees(p1.latitude);
        const lon2 = Cesium.Math.toDegrees(p2.longitude);
        const lat2 = Cesium.Math.toDegrees(p2.latitude);
        
        area += (lon2 - lon1) * (lat2 + lat1);
    }
    
    // Convert to square kilometers (very approximate)
    area = Math.abs(area * 111.32 * 111.32 / 2);
    
    // Update telemetry
    telemetryData.areaCoverage = area;
    updateTelemetryDisplay();
}

// Generate the coverage path
async function generateCoveragePath() {
    if (polygonPoints.length < 3) return;
    
    // Clear existing paths
    clearPaths();
    
    // Get parameters from UI
    const altitude = ui.getAltitude();
    const lineSpacing = ui.getLineSpacing();
    const followTerrain = ui.shouldFollowTerrain();
    const smoothPath = ui.shouldSmoothPath();
    const smoothingFactor = ui.getSmoothingFactor();
    
    // Convert polygon points to cartographic for calculations
    const cartographicPoints = polygonPoints.map(point => {
        return Cesium.Cartographic.fromCartesian(point);
    });
    
    // Determine the orientation of the path (perpendicular to longest edge)
    const orientation = PathPlanning.calculatePathOrientation(cartographicPoints);
    
    // Generate the path waypoints
    pathWaypoints = PathPlanning.generateLawnmowerPattern(cartographicPoints, lineSpacing, orientation);
    
    // Apply path smoothing if enabled
    if (smoothPath && pathWaypoints.length > 2) {
        pathWaypoints = PathPlanning.smoothPathWaypoints(pathWaypoints, smoothingFactor);
    }
    
    // If followTerrain is true, sample the terrain for each waypoint
    if (followTerrain) {
        await PathPlanning.addTerrainHeights(pathWaypoints, altitude, viewer.terrainProvider);
    } else {
        // Add fixed altitude to all waypoints
        pathWaypoints.forEach(point => {
            point.height = altitude;
        });
    }
    
    // Visualize the path
    visualizePath(pathWaypoints);
    
    // Update telemetry
    telemetryData.waypointCount = pathWaypoints.length;
    calculatePathMetrics(pathWaypoints);
    
    ui.setInstructions('Path generated successfully!');
}

// Calculate path length and estimated time
function calculatePathMetrics(waypoints) {
    let totalLength = 0;
    
    // Calculate the path length
    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = Cesium.Cartesian3.fromRadians(waypoints[i].longitude, waypoints[i].latitude, waypoints[i].height);
        const p2 = Cesium.Cartesian3.fromRadians(waypoints[i + 1].longitude, waypoints[i + 1].latitude, waypoints[i + 1].height);
        
        totalLength += Cesium.Cartesian3.distance(p1, p2);
    }
    
    // Convert to kilometers
    telemetryData.pathLength = totalLength / 1000;
    
    // Estimate time based on a drone speed of 10 m/s
    const droneSpeed = 10; // m/s
    telemetryData.estTime = totalLength / droneSpeed / 60; // minutes
    
    updateTelemetryDisplay();
}

// Reset telemetry data
function resetTelemetry() {
    telemetryData = {
        waypointCount: 0,
        pathLength: 0,
        estTime: 0,
        areaCoverage: 0
    };
    updateTelemetryDisplay();
}

// Update the telemetry display
function updateTelemetryDisplay() {
    document.getElementById('waypoint-count').textContent = telemetryData.waypointCount;
    document.getElementById('path-length').textContent = telemetryData.pathLength.toFixed(2) + ' km';
    document.getElementById('est-time').textContent = telemetryData.estTime.toFixed(1) + ' min';
    document.getElementById('area-coverage').textContent = telemetryData.areaCoverage.toFixed(2) + ' km²';
}

// Visualize the path
function visualizePath(waypoints) {
    if (waypoints.length === 0) return;
    
    // Convert cartographic points to cartesian for visualization
    const positions = Cesium.Ellipsoid.WGS84.cartographicArrayToCartesianArray(waypoints);
    
    // Create path as a polyline
    const path = viewer.entities.add({
        polyline: {
            positions: positions,
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: Cesium.Color.YELLOW
            }),
            clampToGround: false
        }
    });
    
    pathEntities.push(path);
    
    // Add points at each waypoint
    waypoints.forEach((waypoint, index) => {
        const point = viewer.entities.add({
            position: Cesium.Ellipsoid.WGS84.cartographicToCartesian(waypoint),
            point: {
                pixelSize: 8,
                color: index === 0 ? Cesium.Color.GREEN : 
                       index === waypoints.length - 1 ? Cesium.Color.RED : 
                       Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2
            },
            label: {
                text: index === 0 ? 'Start' : 
                      index === waypoints.length - 1 ? 'End' : 
                      (index + 1).toString(),
                font: '12px sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
                show: index === 0 || index === waypoints.length - 1 || index % 10 === 0 // Only show some labels
            }
        });
        
        pathEntities.push(point);
    });
    
    // Add height visualization if enabled
    if (ui.shouldVisualizeHeight()) {
        addHeightVisualization(waypoints);
    }
    
    // Fly to the path
    viewer.flyTo(pathEntities);
}

// Add vertical lines for height visualization
function addHeightVisualization(waypoints) {
    waypoints.forEach((waypoint, index) => {
        // Only visualize every 5th point to avoid clutter
        if (index % 5 !== 0) return;
        
        // Create a point on the ground
        const groundPoint = new Cesium.Cartographic(
            waypoint.longitude,
            waypoint.latitude,
            0
        );
        
        // Convert to cartesian
        const cartesianWaypoint = Cesium.Ellipsoid.WGS84.cartographicToCartesian(waypoint);
        const cartesianGround = Cesium.Ellipsoid.WGS84.cartographicToCartesian(groundPoint);
        
        // Add vertical line
        const verticalLine = viewer.entities.add({
            polyline: {
                positions: [cartesianGround, cartesianWaypoint],
                width: 1,
                material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE.withAlpha(0.5)),
                clampToGround: false
            }
        });
        
        pathEntities.push(verticalLine);
    });
}

// Clear existing paths
function clearPaths() {
    pathEntities.forEach(entity => {
        viewer.entities.remove(entity);
    });
    
    pathEntities = [];
    pathWaypoints = [];
}

// Clear everything
function clearAll() {
    // Clear paths
    clearPaths();
    
    // Clear polygon
    if (polygonEntity) {
        viewer.entities.remove(polygonEntity);
        polygonEntity = null;
    }
    
    // Reset telemetry
    resetTelemetry();
    
    // Reset state
    polygonPoints = [];
    drawingMode = false;
    ui.enableDrawButton();
    ui.disableGenerateButton();
    ui.setInstructions('Click "Draw Polygon" then click on the map to define your area of interest.');
    
    // Stop simulation if active
    if (simulationActive) {
        stopSimulation();
    }
}

// Save the current mission to local storage
function saveMission() {
    if (polygonPoints.length < 3 && pathWaypoints.length === 0) {
        ui.setInstructions('Nothing to save. Create a polygon and path first.');
        return;
    }
    
    // Convert Cesium objects to serializable format
    const serializedPolygon = polygonPoints.map(point => {
        const cartographic = Cesium.Cartographic.fromCartesian(point);
        return {
            longitude: cartographic.longitude,
            latitude: cartographic.latitude,
            height: cartographic.height
        };
    });
    
    // Create mission data
    const missionData = {
        name: missionName,
        polygon: serializedPolygon,
        waypoints: pathWaypoints,
        telemetry: telemetryData,
        timestamp: Date.now()
    };
    
    // Save to local storage
    const missions = JSON.parse(localStorage.getItem('cppMissions') || '{}');
    missions[missionName] = missionData;
    localStorage.setItem('cppMissions', JSON.stringify(missions));
    
    ui.setInstructions(`Mission "${missionName}" saved successfully.`);
    ui.updateMissionsList(Object.keys(missions));
}

// Load a mission from local storage
function loadMission(name) {
    // Get missions from local storage
    const missions = JSON.parse(localStorage.getItem('cppMissions') || '{}');
    const mission = missions[name];
    
    if (!mission) {
        ui.setInstructions(`Mission "${name}" not found.`);
        return;
    }
    
    // Clear current state
    clearAll();
    
    // Set mission name
    missionName = mission.name;
    ui.setMissionName(missionName);
    
    // Load polygon
    if (mission.polygon && mission.polygon.length >= 3) {
        polygonPoints = mission.polygon.map(point => {
            return Cesium.Cartesian3.fromRadians(point.longitude, point.latitude, point.height);
        });
        updatePolygonVisual();
    }
    
    // Load waypoints
    if (mission.waypoints && mission.waypoints.length > 0) {
        pathWaypoints = mission.waypoints;
        visualizePath(pathWaypoints);
        
        // Update telemetry
        telemetryData = mission.telemetry;
        updateTelemetryDisplay();
    }
    
    // Update UI
    ui.enableGenerateButton();
    ui.setInstructions(`Mission "${name}" loaded successfully.`);
    
    // Fly to the loaded mission
    if (polygonEntity) {
        viewer.flyTo(polygonEntity);
    } else if (pathEntities.length > 0) {
        viewer.flyTo(pathEntities);
    }
}

// Update mission name
function updateMissionName(name) {
    missionName = name;
}

// Start mission simulation
function startSimulation() {
    if (pathWaypoints.length < 2) {
        ui.setInstructions('No path to simulate. Generate a path first.');
        return;
    }
    
    if (simulationActive) {
        stopSimulation();
    }
    
    simulationActive = true;
    let currentWaypointIndex = 0;
    
    // Create drone entity
    const drone = viewer.entities.add({
        position: Cesium.Ellipsoid.WGS84.cartographicToCartesian(pathWaypoints[0]),
        model: {
            uri: 'https://cesium.com/downloads/models/drone.glb',
            minimumPixelSize: 32,
            maximumScale: 20000,
            scale: 0.5
        },
        path: {
            resolution: 1,
            material: new Cesium.ColorMaterialProperty(Cesium.Color.CYAN),
            width: 2
        },
        name: 'Drone'
    });
    
    pathEntities.push(drone);
    
    // Enable drone tracking
    viewer.trackedEntity = drone;
    
    // Update drone position at regular intervals
    simulationInterval = setInterval(() => {
        currentWaypointIndex++;
        
        if (currentWaypointIndex >= pathWaypoints.length) {
            stopSimulation();
            return;
        }
        
        // Update drone position
        drone.position = Cesium.Ellipsoid.WGS84.cartographicToCartesian(pathWaypoints[currentWaypointIndex]);
        
        // Update telemetry display
        document.getElementById('current-waypoint').textContent = `${currentWaypointIndex + 1}/${pathWaypoints.length}`;
        
        // Calculate completion percentage
        const completionPercent = ((currentWaypointIndex + 1) / pathWaypoints.length * 100).toFixed(1);
        document.getElementById('mission-progress').textContent = completionPercent + '%';
        document.getElementById('progress-bar').style.width = completionPercent + '%';
    }, 500); // Update every 500ms
    
    ui.setSimulationActive(true);
    ui.setInstructions('Simulation started. Tracking drone movement.');
}

// Stop mission simulation
function stopSimulation() {
    if (!simulationActive) return;
    
    clearInterval(simulationInterval);
    simulationActive = false;
    
    // Reset tracking
    viewer.trackedEntity = undefined;
    
    ui.setSimulationActive(false);
    ui.setInstructions('Simulation stopped.');
}

// Set camera modes
function setCameraMode(mode) {
    switch (mode) {
        case 'overview':
            // Top-down view of the entire mission
            if (polygonEntity) {
                viewer.flyTo(polygonEntity);
            } else if (pathEntities.length > 0) {
                viewer.flyTo(pathEntities);
            }
            break;
            
        case 'drone':
            // First-person view from drone
            if (simulationActive && viewer.trackedEntity) {
                viewer.trackedEntity = pathEntities[pathEntities.length - 1]; // Drone is the last entity
                viewer.scene.screenSpaceCameraController.enableRotate = false;
            }
            break;
            
        case 'follow':
            // Third-person follow view
            if (simulationActive && viewer.trackedEntity) {
                viewer.trackedEntity = pathEntities[pathEntities.length - 1]; // Drone is the last entity
                viewer.scene.screenSpaceCameraController.enableRotate = true;
            }
            break;
            
        case 'free':
        default:
            // Free camera movement
            viewer.trackedEntity = undefined;
            viewer.scene.screenSpaceCameraController.enableRotate = true;
            break;
    }
}

// Return path waypoints for external use
function getPathWaypoints() {
    return pathWaypoints;
}

// Export path data as GeoJSON
function exportPathAsGeoJSON() {
    if (pathWaypoints.length === 0) {
        alert('No path data to export. Generate a path first.');
        return null;
    }
    
    // Convert cartographic coordinates to degrees
    const coordinates = pathWaypoints.map(waypoint => [
        Cesium.Math.toDegrees(waypoint.longitude),
        Cesium.Math.toDegrees(waypoint.latitude),
        waypoint.height || 0
    ]);
    
    const geojson = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {
                    name: missionName,
                    waypointCount: pathWaypoints.length,
                    pathLength: telemetryData.pathLength,
                    estimatedTime: telemetryData.estTime,
                    areaCoverage: telemetryData.areaCoverage,
                    altitude: ui ? ui.getAltitude() : 100,
                    lineSpacing: ui ? ui.getLineSpacing() : 50,
                    followTerrain: ui ? ui.shouldFollowTerrain() : true,
                    smoothPath: ui ? ui.shouldSmoothPath() : true,
                    smoothingFactor: ui ? ui.getSmoothingFactor() : 5,
                    exportDate: new Date().toISOString()
                },
                geometry: {
                    type: "LineString",
                    coordinates: coordinates
                }
            }
        ]
    };
    
    return geojson;
}

// Export path data as JSON
function exportPathAsJSON() {
    if (pathWaypoints.length === 0) {
        alert('No path data to export. Generate a path first.');
        return null;
    }
    
    // Convert cartographic coordinates to degrees
    const waypoints = pathWaypoints.map((waypoint, index) => ({
        index: index,
        longitude: Cesium.Math.toDegrees(waypoint.longitude),
        latitude: Cesium.Math.toDegrees(waypoint.latitude),
        altitude: waypoint.height || 0,
        type: index === 0 ? 'start' : 
              index === pathWaypoints.length - 1 ? 'end' : 'waypoint'
    }));
    
    const jsonData = {
        mission: {
            name: missionName,
            metadata: {
                waypointCount: pathWaypoints.length,
                pathLength: telemetryData.pathLength,
                estimatedTime: telemetryData.estTime,
                areaCoverage: telemetryData.areaCoverage,
                exportDate: new Date().toISOString()
            },
            parameters: {
                altitude: ui ? ui.getAltitude() : 100,
                lineSpacing: ui ? ui.getLineSpacing() : 50,
                followTerrain: ui ? ui.shouldFollowTerrain() : true,
                smoothPath: ui ? ui.shouldSmoothPath() : true,
                smoothingFactor: ui ? ui.getSmoothingFactor() : 5
            },
            waypoints: waypoints
        }
    };
    
    return jsonData;
}

// Download data as file
function downloadData(data, filename, contentType) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export functions for UI
function exportPathAsGeoJSONFile() {
    const geojson = exportPathAsGeoJSON();
    if (geojson) {
        const filename = `${missionName.replace(/[^a-z0-9]/gi, '_')}_path.geojson`;
        downloadData(geojson, filename, 'application/geo+json');
    }
}

function exportPathAsJSONFile() {
    const jsonData = exportPathAsJSON();
    if (jsonData) {
        const filename = `${missionName.replace(/[^a-z0-9]/gi, '_')}_path.json`;
        downloadData(jsonData, filename, 'application/json');
    }
}

// Get path data for external use (returns both formats)
function getPathData() {
    return {
        geojson: exportPathAsGeoJSON(),
        json: exportPathAsJSON(),
        raw: pathWaypoints
    };
}

// Handle left sidebar interactions
document.querySelectorAll('#leftSidebar .sidebar-icon').forEach(icon => {
    icon.addEventListener('click', () => {
        // Remove active class from all icons
        document.querySelectorAll('#leftSidebar .sidebar-icon').forEach(i => {
            i.classList.remove('active');
        });
        
        // Add active class to clicked icon
        icon.classList.add('active');
        
        // Hide all panels
        document.querySelectorAll('#rightSidebar .sidebar-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Show the target panel if specified
        const targetId = icon.getAttribute('data-target');
        if (targetId) {
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        }
    });
});

// Initialize the page with the first panel active
window.addEventListener('DOMContentLoaded', () => {
    const firstIcon = document.querySelector('#leftSidebar .sidebar-icon');
    if (firstIcon) {
        firstIcon.classList.add('active');
        const targetId = firstIcon.getAttribute('data-target');
        if (targetId) {
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        }
    }
});

// Collapsible drawing tools
document.getElementById('toggleDrawingTools').addEventListener('click', function() {
    document.getElementById('drawingTools').classList.toggle('collapsed');
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-chevron-left');
    icon.classList.toggle('fa-chevron-right');
}); 