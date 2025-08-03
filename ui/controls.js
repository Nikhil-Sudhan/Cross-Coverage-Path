// UI Controls for the 3D Coverage Path Planning application

// Initialize UI controls when the document is loaded
function initUI(app) {
    // Connect UI elements to the app
    const drawPolygonBtn = document.getElementById('drawPolygon');
    const generatePathBtn = document.getElementById('generatePath');
    const clearAllBtn = document.getElementById('clearAll');
    const altitudeInput = document.getElementById('altitude');
    const lineSpacingInput = document.getElementById('lineSpacing');
    const followTerrainInput = document.getElementById('followTerrain');
    const smoothPathInput = document.getElementById('smoothPath');
    const smoothingFactorInput = document.getElementById('smoothingFactor');
    const visualizeHeightInput = document.getElementById('visualizeHeight');
    const instructionsDiv = document.getElementById('instructions');
    
    // Mission management elements
    const missionNameInput = document.getElementById('missionName');
    const saveMissionBtn = document.getElementById('saveMission');
    const loadMissionBtn = document.getElementById('loadMission');
    const missionSelect = document.getElementById('missionSelect');
    
    // Simulation controls
    const startSimulationBtn = document.getElementById('startSimulation');
    const stopSimulationBtn = document.getElementById('stopSimulation');
    const simulationStatus = document.getElementById('simulationStatus');
    
    // Camera control elements
    const cameraModeSelect = document.getElementById('cameraMode');

    // Set initial UI state
    generatePathBtn.disabled = true;
    instructionsDiv.textContent = 'Click "Draw Polygon" then click on the map to define your area of interest.';

    // Initialize event listeners for basic controls
    drawPolygonBtn.addEventListener('click', () => {
        app.startDrawingMode();
    });
    
    generatePathBtn.addEventListener('click', () => {
        app.generateCoveragePath();
    });
    
    clearAllBtn.addEventListener('click', () => {
        app.clearAll();
    });
    
    // Initialize mission management event listeners
    if (saveMissionBtn) {
        saveMissionBtn.addEventListener('click', () => {
            app.saveMission();
        });
    }
    
    if (missionNameInput) {
        missionNameInput.addEventListener('change', () => {
            app.updateMissionName(missionNameInput.value);
        });
    }
    
    if (loadMissionBtn && missionSelect) {
        loadMissionBtn.addEventListener('click', () => {
            const selectedMission = missionSelect.value;
            if (selectedMission) {
                app.loadMission(selectedMission);
            }
        });
        
        // Load initial mission list
        loadMissionsList();
    }
    
    // Initialize simulation controls
    if (startSimulationBtn) {
        startSimulationBtn.addEventListener('click', () => {
            app.startSimulation();
        });
    }
    
    if (stopSimulationBtn) {
        stopSimulationBtn.addEventListener('click', () => {
            app.stopSimulation();
        });
    }
    
    // Initialize camera controls
    if (cameraModeSelect) {
        cameraModeSelect.addEventListener('change', () => {
            app.setCameraMode(cameraModeSelect.value);
        });
    }
    
    // Load missions from local storage
    function loadMissionsList() {
        if (!missionSelect) return;
        
        const missions = JSON.parse(localStorage.getItem('cppMissions') || '{}');
        missionSelect.innerHTML = '<option value="">Select a mission...</option>';
        
        Object.keys(missions).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            missionSelect.appendChild(option);
        });
    }

    // Return the UI controls for the app to use
    return {
        drawPolygonBtn,
        generatePathBtn,
        clearAllBtn,
        altitudeInput,
        lineSpacingInput,
        followTerrainInput,
        smoothPathInput,
        smoothingFactorInput,
        instructionsDiv,
        
        // UI utility methods
        enableGenerateButton: function() {
            generatePathBtn.disabled = false;
        },
        
        disableGenerateButton: function() {
            generatePathBtn.disabled = true;
        },
        
        enableDrawButton: function() {
            drawPolygonBtn.disabled = false;
        },
        
        disableDrawButton: function() {
            drawPolygonBtn.disabled = true;
        },
        
        setInstructions: function(text) {
            instructionsDiv.textContent = text;
        },
        
        // Get values from UI inputs
        getAltitude: function() {
            return parseFloat(altitudeInput.value);
        },
        
        getLineSpacing: function() {
            return parseFloat(lineSpacingInput.value);
        },
        
        shouldFollowTerrain: function() {
            return followTerrainInput.checked;
        },
        
        shouldSmoothPath: function() {
            return smoothPathInput.checked;
        },
        
        getSmoothingFactor: function() {
            return parseInt(smoothingFactorInput.value);
        },
        
        shouldVisualizeHeight: function() {
            return visualizeHeightInput && visualizeHeightInput.checked;
        },
        
        // Mission management
        setMissionName: function(name) {
            if (missionNameInput) {
                missionNameInput.value = name;
            }
        },
        
        updateMissionsList: function(missionNames) {
            if (!missionSelect) return;
            
            // Clear existing options
            missionSelect.innerHTML = '<option value="">Select a mission...</option>';
            
            // Add mission names
            missionNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                missionSelect.appendChild(option);
            });
        },
        
        // Simulation controls
        setSimulationActive: function(active) {
            if (startSimulationBtn) startSimulationBtn.disabled = active;
            if (stopSimulationBtn) stopSimulationBtn.disabled = !active;
            
            if (simulationStatus) {
                simulationStatus.textContent = active ? 'ACTIVE' : 'INACTIVE';
                simulationStatus.className = active ? 'active' : 'inactive';
            }
        }
    };
} 