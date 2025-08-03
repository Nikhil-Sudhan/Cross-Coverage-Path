/**
 * Drawing Tools Module for 3D Coverage Path Planning
 * Handles the drawing tools UI and functionality
 */

// Initialize state
let drawingToolsState = {
    activeToolId: null,
    editMode: false,
    selectedWaypoint: null,
    measurePoints: [],
    drawnEntities: [],
    isDrawingToolsCollapsed: false
};

// Initialize the drawing tools functionality
function initDrawingTools(app, viewer) {
    // Get drawing tools elements
    const drawingToolsPanel = document.getElementById('drawingTools');
    const toggleDrawingToolsBtn = document.getElementById('toggleDrawingTools');
    const drawingToolBtns = document.querySelectorAll('.drawing-tool');
    
    // Path editing tools
    const editPathBtn = document.getElementById('editPath');
    const addWaypointBtn = document.getElementById('addWaypoint');
    const removeWaypointBtn = document.getElementById('removeWaypoint');
    
    // Drawing accessory tools
    const addMarkerBtn = document.getElementById('addMarker');
    const addTextBtn = document.getElementById('addText');
    const measureDistanceBtn = document.getElementById('measureDistance');
    const drawRectangleBtn = document.getElementById('drawRectangle');
    const drawCircleBtn = document.getElementById('drawCircle');
    const drawLineBtn = document.getElementById('drawLine');

    // Path editor elements
    const pathEditorPanel = document.getElementById('pathEditor');
    const waypointList = document.getElementById('waypointList');
    const optimizeWaypointsBtn = document.getElementById('optimizeWaypoints');
    const reverseWaypointsBtn = document.getElementById('reverseWaypoints');
    const savePathChangesBtn = document.getElementById('savePathChanges');
    const cancelPathEditBtn = document.getElementById('cancelPathEdit');
    
    // Text editor elements
    const textEditorPanel = document.getElementById('textEditor');
    const labelTextInput = document.getElementById('labelText');
    const labelSizeInput = document.getElementById('labelSize');
    const labelColorInput = document.getElementById('labelColor');
    const applyTextLabelBtn = document.getElementById('applyTextLabel');
    const cancelTextLabelBtn = document.getElementById('cancelTextLabel');
    
    // Event handlers for drawing tools panel
    toggleDrawingToolsBtn.addEventListener('click', () => {
        drawingToolsPanel.classList.toggle('collapsed');
        drawingToolsState.isDrawingToolsCollapsed = drawingToolsPanel.classList.contains('collapsed');
    });
    
    // Event handlers for drawing tool buttons
    drawingToolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // If the same tool is clicked again, deactivate it
            if (btn.id === drawingToolsState.activeToolId) {
                deactivateAllTools();
                return;
            }
            
            // Activate the clicked tool
            activateTool(btn.id);
        });
    });
    
    // Event handlers for path editor
    savePathChangesBtn.addEventListener('click', () => {
        savePathChanges();
    });
    
    cancelPathEditBtn.addEventListener('click', () => {
        cancelPathEdit();
    });
    
    optimizeWaypointsBtn.addEventListener('click', () => {
        optimizeWaypoints();
    });
    
    reverseWaypointsBtn.addEventListener('click', () => {
        reverseWaypoints();
    });
    
    // Event handlers for text editor
    applyTextLabelBtn.addEventListener('click', () => {
        applyTextLabel();
    });
    
    cancelTextLabelBtn.addEventListener('click', () => {
        cancelTextLabel();
    });
    
    // Set up the event handler for the Cesium viewer
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    
    // Handle clicks based on the active tool
    handler.setInputAction((click) => {
        const cartesian = viewer.scene.pickPosition(click.position);
        if (!cartesian) return;
        
        const pickedObject = viewer.scene.pick(click.position);
        
        switch (drawingToolsState.activeToolId) {
            case 'editPath':
                handleEditPathClick(cartesian, pickedObject);
                break;
            case 'addWaypoint':
                handleAddWaypointClick(cartesian);
                break;
            case 'removeWaypoint':
                handleRemoveWaypointClick(pickedObject);
                break;
            case 'addMarker':
                handleAddMarkerClick(cartesian);
                break;
            case 'addText':
                handleAddTextClick(cartesian);
                break;
            case 'measureDistance':
                handleMeasureDistanceClick(cartesian);
                break;
            case 'drawRectangle':
                handleDrawRectangleClick(cartesian);
                break;
            case 'drawCircle':
                handleDrawCircleClick(cartesian);
                break;
            case 'drawLine':
                handleDrawLineClick(cartesian);
                break;
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    // Helpers
    function activateTool(toolId) {
        // Deactivate all tools first
        deactivateAllTools();
        
        // Set the active tool
        drawingToolsState.activeToolId = toolId;
        document.getElementById(toolId).classList.add('active');
        
        // Special handling for certain tools
        if (toolId === 'editPath') {
            startPathEditing();
        } else if (toolId === 'addText') {
            textEditorPanel.classList.remove('hidden');
        }
    }
    
    function deactivateAllTools() {
        // Clear active state from all tools
        drawingToolsState.activeToolId = null;
        drawingToolBtns.forEach(btn => btn.classList.remove('active'));
        
        // Reset any active tool states
        drawingToolsState.measurePoints = [];
        
        // Hide editor panels
        pathEditorPanel.classList.add('hidden');
        textEditorPanel.classList.add('hidden');
    }
    
    // Path editing functions
    function startPathEditing() {
        drawingToolsState.editMode = true;
        pathEditorPanel.classList.remove('hidden');
        
        // Get the current path waypoints
        const waypoints = app.getPathWaypoints();
        
        // Populate the waypoint list
        updateWaypointList(waypoints);
        
        // Make waypoints draggable in 3D space
        makeWaypointsDraggable();
    }
    
    function updateWaypointList(waypoints) {
        // Clear the current list
        waypointList.innerHTML = '';
        
        // Add each waypoint to the list
        waypoints.forEach((waypoint, index) => {
            const waypointItem = document.createElement('div');
            waypointItem.className = 'waypoint-item';
            waypointItem.dataset.index = index;
            
            // Convert cartesian to cartographic for display
            const cartographic = Cesium.Cartographic.fromCartesian(waypoint.position);
            const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
            const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
            const alt = Math.round(cartographic.height);
            
            waypointItem.innerHTML = `
                <div class="waypoint-info">
                    <span class="waypoint-number">${index + 1}</span>
                    <span class="waypoint-coordinates">
                        Lat: ${lat}, Lon: ${lon}, Alt: ${alt}m
                    </span>
                </div>
                <div class="waypoint-actions">
                    <button class="small-button waypoint-up" title="Move Up">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="small-button waypoint-down" title="Move Down">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                </div>
            `;
            
            // Add click handler to select waypoint
            waypointItem.addEventListener('click', () => {
                // Deselect all other waypoints
                document.querySelectorAll('.waypoint-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // Select this waypoint
                waypointItem.classList.add('selected');
                drawingToolsState.selectedWaypoint = index;
                
                // Highlight the waypoint in 3D
                highlightWaypoint(index);
            });
            
            // Add button handlers
            waypointItem.querySelector('.waypoint-up').addEventListener('click', (e) => {
                e.stopPropagation();
                moveWaypointUp(index);
            });
            
            waypointItem.querySelector('.waypoint-down').addEventListener('click', (e) => {
                e.stopPropagation();
                moveWaypointDown(index);
            });
            
            waypointList.appendChild(waypointItem);
        });
    }
    
    function makeWaypointsDraggable() {
        // Implementation depends on Cesium's API for draggable objects
        // This is a simplified version
        app.makeWaypointsDraggable(true);
    }
    
    function highlightWaypoint(index) {
        app.highlightWaypoint(index);
    }
    
    function moveWaypointUp(index) {
        if (index <= 0) return;
        
        app.swapWaypoints(index, index - 1);
        updateWaypointList(app.getPathWaypoints());
    }
    
    function moveWaypointDown(index) {
        const waypoints = app.getPathWaypoints();
        if (index >= waypoints.length - 1) return;
        
        app.swapWaypoints(index, index + 1);
        updateWaypointList(app.getPathWaypoints());
    }
    
    function optimizeWaypoints() {
        app.optimizeWaypoints();
        updateWaypointList(app.getPathWaypoints());
    }
    
    function reverseWaypoints() {
        app.reverseWaypoints();
        updateWaypointList(app.getPathWaypoints());
    }
    
    function savePathChanges() {
        app.saveWaypointChanges();
        drawingToolsState.editMode = false;
        pathEditorPanel.classList.add('hidden');
        deactivateAllTools();
    }
    
    function cancelPathEdit() {
        app.cancelWaypointChanges();
        drawingToolsState.editMode = false;
        pathEditorPanel.classList.add('hidden');
        deactivateAllTools();
    }
    
    // Handle tool clicks
    function handleEditPathClick(cartesian, pickedObject) {
        // If a path entity is clicked, select it for editing
        if (pickedObject && pickedObject.id && 
            (pickedObject.id.polyline || pickedObject.id.point)) {
            
            // Check if it's part of the path
            const index = app.getWaypointIndexFromEntity(pickedObject.id);
            if (index !== -1) {
                drawingToolsState.selectedWaypoint = index;
                highlightWaypoint(index);
                
                // Select in the list
                const waypointItems = document.querySelectorAll('.waypoint-item');
                waypointItems.forEach(item => item.classList.remove('selected'));
                
                if (waypointItems[index]) {
                    waypointItems[index].classList.add('selected');
                    waypointItems[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    }
    
    function handleAddWaypointClick(cartesian) {
        app.addWaypoint(cartesian);
        updateWaypointList(app.getPathWaypoints());
    }
    
    function handleRemoveWaypointClick(pickedObject) {
        if (pickedObject && pickedObject.id) {
            const index = app.getWaypointIndexFromEntity(pickedObject.id);
            if (index !== -1) {
                app.removeWaypoint(index);
                updateWaypointList(app.getPathWaypoints());
            }
        }
    }
    
    function handleAddMarkerClick(cartesian) {
        const entity = viewer.entities.add({
            position: cartesian,
            billboard: {
                image: app.createColoredPin('#00b3ff'), // Neon blue pin
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        });
        
        drawingToolsState.drawnEntities.push(entity);
    }
    
    function handleAddTextClick(cartesian) {
        // Get text from the editor
        const text = labelTextInput.value || 'Label';
        const size = parseInt(labelSizeInput.value) || 20;
        const color = Cesium.Color.fromCssColorString(labelColorInput.value);
        
        const entity = viewer.entities.add({
            position: cartesian,
            label: {
                text: text,
                font: `${size}px sans-serif`,
                fillColor: color,
                outlineWidth: 2,
                outlineColor: Cesium.Color.BLACK,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                pixelOffset: new Cesium.Cartesian2(0, 0)
            }
        });
        
        drawingToolsState.drawnEntities.push(entity);
        
        // Reset and hide the text editor
        labelTextInput.value = '';
        textEditorPanel.classList.add('hidden');
        deactivateAllTools();
    }
    
    function handleMeasureDistanceClick(cartesian) {
        // Add the point to the measurement
        drawingToolsState.measurePoints.push(cartesian);
        
        // Add a point entity at the clicked location
        const pointEntity = viewer.entities.add({
            position: cartesian,
            point: {
                pixelSize: 10,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        });
        
        drawingToolsState.drawnEntities.push(pointEntity);
        
        // If we have 2 points, create a line and measure the distance
        if (drawingToolsState.measurePoints.length === 2) {
            const startPoint = drawingToolsState.measurePoints[0];
            const endPoint = drawingToolsState.measurePoints[1];
            
            // Calculate the distance
            const distance = Cesium.Cartesian3.distance(startPoint, endPoint);
            const distanceKm = (distance / 1000).toFixed(2);
            
            // Create a line between the points
            const lineEntity = viewer.entities.add({
                polyline: {
                    positions: [startPoint, endPoint],
                    width: 2,
                    material: new Cesium.PolylineDashMaterialProperty({
                        color: Cesium.Color.YELLOW
                    }),
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                }
            });
            
            // Add a label with the distance
            const midPoint = Cesium.Cartesian3.midpoint(startPoint, endPoint, new Cesium.Cartesian3());
            const labelEntity = viewer.entities.add({
                position: midPoint,
                label: {
                    text: `${distanceKm} km`,
                    font: '14px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    outlineColor: Cesium.Color.BLACK,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.CENTER,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                    pixelOffset: new Cesium.Cartesian2(0, -20)
                }
            });
            
            drawingToolsState.drawnEntities.push(lineEntity, labelEntity);
            
            // Reset the measurement points for the next measurement
            drawingToolsState.measurePoints = [];
        }
    }
    
    function handleDrawRectangleClick(cartesian) {
        // For rectangles, we need 2 clicks to define diagonal corners
        drawingToolsState.measurePoints.push(cartesian);
        
        if (drawingToolsState.measurePoints.length === 1) {
            // First click - create a marker
            const pointEntity = viewer.entities.add({
                position: cartesian,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.YELLOW,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                }
            });
            
            drawingToolsState.drawnEntities.push(pointEntity);
        } else if (drawingToolsState.measurePoints.length === 2) {
            // Second click - create the rectangle
            const positions = drawingToolsState.measurePoints;
            
            // Convert to cartographic for rectangle definition
            const cartographic1 = Cesium.Cartographic.fromCartesian(positions[0]);
            const cartographic2 = Cesium.Cartographic.fromCartesian(positions[1]);
            
            // Create rectangle coordinates
            const west = Math.min(cartographic1.longitude, cartographic2.longitude);
            const east = Math.max(cartographic1.longitude, cartographic2.longitude);
            const south = Math.min(cartographic1.latitude, cartographic2.latitude);
            const north = Math.max(cartographic1.latitude, cartographic2.latitude);
            
            // Create the rectangle entity
            const rectangleEntity = viewer.entities.add({
                rectangle: {
                    coordinates: new Cesium.Rectangle(west, south, east, north),
                    material: Cesium.Color.YELLOW.withAlpha(0.3),
                    outline: true,
                    outlineColor: Cesium.Color.YELLOW,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                }
            });
            
            drawingToolsState.drawnEntities.push(rectangleEntity);
            
            // Reset for next rectangle
            drawingToolsState.measurePoints = [];
        }
    }
    
    function handleDrawCircleClick(cartesian) {
        // For circles, we need 2 clicks: center and radius
        drawingToolsState.measurePoints.push(cartesian);
        
        if (drawingToolsState.measurePoints.length === 1) {
            // First click - create a marker for the center
            const pointEntity = viewer.entities.add({
                position: cartesian,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.YELLOW,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                }
            });
            
            drawingToolsState.drawnEntities.push(pointEntity);
        } else if (drawingToolsState.measurePoints.length === 2) {
            // Second click - determine radius and create circle
            const center = drawingToolsState.measurePoints[0];
            const radiusPoint = drawingToolsState.measurePoints[1];
            
            // Calculate radius in meters
            const radius = Cesium.Cartesian3.distance(center, radiusPoint);
            
            // Create the circle entity
            const circleEntity = viewer.entities.add({
                position: center,
                ellipse: {
                    semiMinorAxis: radius,
                    semiMajorAxis: radius,
                    material: Cesium.Color.YELLOW.withAlpha(0.3),
                    outline: true,
                    outlineColor: Cesium.Color.YELLOW,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                }
            });
            
            drawingToolsState.drawnEntities.push(circleEntity);
            
            // Reset for next circle
            drawingToolsState.measurePoints = [];
        }
    }
    
    function handleDrawLineClick(cartesian) {
        // Add the point to the line
        drawingToolsState.measurePoints.push(cartesian);
        
        // Add a point entity at the clicked location
        const pointEntity = viewer.entities.add({
            position: cartesian,
            point: {
                pixelSize: 8,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        });
        
        drawingToolsState.drawnEntities.push(pointEntity);
        
        // If we have at least 2 points, update or create the line
        if (drawingToolsState.measurePoints.length >= 2) {
            // Find any existing line entity
            let lineEntity = drawingToolsState.drawnEntities.find(entity => 
                entity.polyline && entity.id.indexOf('line-') === 0);
            
            if (!lineEntity) {
                // Create a new line entity
                lineEntity = viewer.entities.add({
                    id: 'line-' + Date.now(),
                    polyline: {
                        positions: drawingToolsState.measurePoints.slice(),
                        width: 3,
                        material: new Cesium.PolylineGlowMaterialProperty({
                            glowPower: 0.2,
                            color: Cesium.Color.YELLOW
                        }),
                        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                    }
                });
                
                drawingToolsState.drawnEntities.push(lineEntity);
            } else {
                // Update the existing line entity
                lineEntity.polyline.positions = new Cesium.ConstantProperty(
                    drawingToolsState.measurePoints.slice());
            }
        }
    }
    
    function applyTextLabel() {
        // The actual application happens in handleAddTextClick
        // This function just validates the input
        const text = labelTextInput.value.trim();
        if (!text) {
            labelTextInput.focus();
            return;
        }
        
        // Pressing the Apply button doesn't do anything if we're not in add text mode
        if (drawingToolsState.activeToolId !== 'addText') {
            activateTool('addText');
        }
    }
    
    function cancelTextLabel() {
        labelTextInput.value = '';
        textEditorPanel.classList.add('hidden');
        deactivateAllTools();
    }
    
    // Return public API
    return {
        activateTool,
        deactivateAllTools,
        getDrawingToolsState: () => drawingToolsState,
        clearDrawnEntities: () => {
            drawingToolsState.drawnEntities.forEach(entity => {
                viewer.entities.remove(entity);
            });
            drawingToolsState.drawnEntities = [];
        }
    };
}

// Export the module
window.initDrawingTools = initDrawingTools; 