// Path planning algorithms for the 3D Coverage Path Planning application

// Path planning algorithms namespace
const PathPlanning = {};

// Calculate path orientation based on the longest edge
PathPlanning.calculatePathOrientation = function(cartographicPoints) {
    let maxDistance = 0;
    let orientation = 0;
    
    for (let i = 0; i < cartographicPoints.length; i++) {
        const p1 = cartographicPoints[i];
        const p2 = cartographicPoints[(i + 1) % cartographicPoints.length];
        
        const dx = Cesium.Math.toDegrees(p2.longitude - p1.longitude);
        const dy = Cesium.Math.toDegrees(p2.latitude - p1.latitude);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > maxDistance) {
            maxDistance = distance;
            orientation = Math.atan2(dy, dx) + Math.PI / 2; // Perpendicular to the edge
        }
    }
    
    return orientation;
};

// Generate a lawnmower pattern within the polygon
PathPlanning.generateLawnmowerPattern = function(cartographicPoints, spacing, orientation) {
    // Find the bounding box of the polygon
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    
    cartographicPoints.forEach(point => {
        minLon = Math.min(minLon, point.longitude);
        maxLon = Math.max(maxLon, point.longitude);
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
    });
    
    // Convert spacing from meters to radians (approximate at the polygon's latitude)
    const centerLat = (minLat + maxLat) / 2;
    const metersPerDegree = 111320 * Math.cos(centerLat); // Approximate meters per degree at this latitude
    const spacingRadians = Cesium.Math.toRadians(spacing / metersPerDegree);
    
    // Create a rotation matrix for the specified orientation
    const cosO = Math.cos(orientation);
    const sinO = Math.sin(orientation);
    
    // Calculate the rotated bounding box
    const centerLon = (minLon + maxLon) / 2;
    const centerLatRad = (minLat + maxLat) / 2;
    
    // Calculate the diagonal length of the bounding box
    const diagonalLon = maxLon - minLon;
    const diagonalLat = maxLat - minLat;
    const diagonal = Math.sqrt(diagonalLon * diagonalLon + diagonalLat * diagonalLat);
    
    // Create rotated lines spanning the entire polygon
    const waypoints = [];
    const numLines = Math.ceil(diagonal / spacingRadians) + 2; // Add extra lines to ensure coverage
    
    for (let i = -numLines / 2; i < numLines / 2; i++) {
        const offset = i * spacingRadians;
        
        // Calculate start and end points of this line
        // Create a line perpendicular to our orientation
        const lineLength = diagonal * 1.5; // Make sure the line crosses the entire polygon
        
        // Start point: offset from center in direction of orientation
        const startLon = centerLon + offset * sinO - lineLength * cosO / 2;
        const startLat = centerLatRad + offset * cosO + lineLength * sinO / 2;
        
        // End point: offset from center in direction of orientation 
        const endLon = centerLon + offset * sinO + lineLength * cosO / 2;
        const endLat = centerLatRad + offset * cosO - lineLength * sinO / 2;
        
        // Create line segment
        const line = [
            new Cesium.Cartographic(startLon, startLat, 0),
            new Cesium.Cartographic(endLon, endLat, 0)
        ];
        
        // Clip the line to the polygon
        const clippedLine = clipLineToPolygon(line, cartographicPoints);
        
        // Add the clipped line to waypoints if it exists
        if (clippedLine && clippedLine.length > 0) {
            // If this is an even numbered line, reverse it for a better path
            if (i % 2 === 0 && clippedLine.length > 1) {
                clippedLine.reverse();
            }
            
            // Add the line to our waypoints
            clippedLine.forEach(point => {
                waypoints.push(point);
            });
        }
    }
    
    return waypoints;
};

// Add terrain heights to the waypoints
PathPlanning.addTerrainHeights = async function(waypoints, altitude, terrainProvider) {
    // Ensure we have a valid terrainProvider
    if (!terrainProvider) {
        console.warn('No terrain provider available. Using fixed altitude.');
        waypoints.forEach(waypoint => {
            waypoint.height = altitude;
        });
        return waypoints;
    }
    
    try {
        // Use Cesium's sampleTerrainMostDetailed if available (newer versions)
        if (typeof Cesium.sampleTerrainMostDetailed === 'function') {
            await Cesium.sampleTerrainMostDetailed(terrainProvider, waypoints);
        } 
        // Otherwise use older versions with the maximum available level
        else {
            // Get the max level
            const tilingScheme = terrainProvider.tilingScheme;
            let maxLevel = 0;
            if (terrainProvider.availability) {
                maxLevel = terrainProvider.availability.maximumLevel;
            } else if (terrainProvider.getLevelMaximumGeometricError) {
                // Estimate the max level based on geometric error
                const levelZeroMaxError = terrainProvider.getLevelMaximumGeometricError(0);
                const desiredError = 1.0; // 1 meter error
                maxLevel = Math.ceil(Math.log2(levelZeroMaxError / desiredError));
            }
            
            await Cesium.sampleTerrain(terrainProvider, maxLevel, waypoints);
        }
        
        // Add the desired altitude above the terrain
        waypoints.forEach(waypoint => {
            // If height is NaN or undefined, use 0 as base terrain height
            if (isNaN(waypoint.height) || waypoint.height === undefined) {
                waypoint.height = 0;
            }
            waypoint.height += altitude;
        });
        
    } catch (error) {
        console.error('Error sampling terrain heights:', error);
        // Fallback to fixed altitude
        waypoints.forEach(waypoint => {
            waypoint.height = altitude;
        });
    }
    
    return waypoints;
};

// Clip a line to a polygon using the Sutherland-Hodgman algorithm
function clipLineToPolygon(line, polygon) {
    // For simplicity, we'll use a more basic approach:
    // Check if the line segment intersects with the polygon edges
    // and keep only the parts inside the polygon
    
    // This is a simplified implementation and may not work for all cases
    if (line.length < 2) return null;
    
    // Create a simple point-in-polygon function
    function isPointInPolygon(point, polygon) {
        let inside = false;
        const lon = point.longitude;
        const lat = point.latitude;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].longitude;
            const yi = polygon[i].latitude;
            const xj = polygon[j].longitude;
            const yj = polygon[j].latitude;
            
            const intersect = ((yi > lat) !== (yj > lat)) &&
                (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    // Sample points along the line and keep those inside the polygon
    const clippedLine = [];
    const numSamples = 50; // Number of samples along the line
    
    for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const lon = line[0].longitude * (1 - t) + line[1].longitude * t;
        const lat = line[0].latitude * (1 - t) + line[1].latitude * t;
        const point = new Cesium.Cartographic(lon, lat, 0);
        
        if (isPointInPolygon(point, polygon)) {
            clippedLine.push(point);
        }
    }
    
    return clippedLine;
}

// Smooth the path waypoints to create more gradual turns
PathPlanning.smoothPathWaypoints = function(waypoints, smoothingFactor) {
    if (smoothingFactor === 0 || waypoints.length < 3) {
        return waypoints;
    }
    
    // The larger the factor, the more interpolation points we add
    const interpolationPoints = Math.max(3, smoothingFactor * 2); 
    const smoothedPath = [];
    
    // For each segment between waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
        const startPoint = waypoints[i];
        const endPoint = waypoints[i + 1];
        
        // Add the start point
        smoothedPath.push(startPoint);
        
        // If this is not the first segment, add interpolated points
        // to smooth the transition at the corners
        if (i > 0 && i < waypoints.length - 1) {
            const prevPoint = waypoints[i - 1];
            
            // Get vectors for the incoming and outgoing edges
            const inDirection = {
                lon: startPoint.longitude - prevPoint.longitude,
                lat: startPoint.latitude - prevPoint.latitude
            };
            
            const outDirection = {
                lon: endPoint.longitude - startPoint.longitude,
                lat: endPoint.latitude - startPoint.latitude
            };
            
            // Normalize the direction vectors
            const inMag = Math.sqrt(inDirection.lon * inDirection.lon + inDirection.lat * inDirection.lat);
            const outMag = Math.sqrt(outDirection.lon * outDirection.lon + outDirection.lat * outDirection.lat);
            
            if (inMag > 0 && outMag > 0) {
                inDirection.lon /= inMag;
                inDirection.lat /= inMag;
                outDirection.lon /= outMag;
                outDirection.lat /= outMag;
                
                // Determine angle between vectors (dot product)
                const dotProduct = inDirection.lon * outDirection.lon + inDirection.lat * outDirection.lat;
                
                // If the turn is sharp enough (angle greater than 30 degrees)
                if (dotProduct < 0.866) { // cos(30 degrees) ≈ 0.866
                    // Add a curved path with more detail for sharper turns
                    const numPoints = Math.max(2, Math.floor((1 - dotProduct) * interpolationPoints));
                    
                    // Create control points for bezier curve
                    const distance = Math.sqrt(
                        Math.pow(endPoint.longitude - startPoint.longitude, 2) +
                        Math.pow(endPoint.latitude - startPoint.latitude, 2)
                    ) * 0.5;
                    
                    // Control points are in the direction of the incoming and outgoing edges
                    const cp1 = {
                        longitude: startPoint.longitude + outDirection.lon * distance,
                        latitude: startPoint.latitude + outDirection.lat * distance,
                        height: startPoint.height
                    };
                    
                    const cp2 = {
                        longitude: startPoint.longitude + inDirection.lon * distance,
                        latitude: startPoint.latitude + inDirection.lat * distance,
                        height: startPoint.height
                    };
                    
                    // Generate bezier curve points
                    for (let j = 1; j <= numPoints; j++) {
                        const t = j / (numPoints + 1);
                        const point = cubicBezier(
                            prevPoint,
                            cp2,
                            cp1,
                            endPoint,
                            t
                        );
                        smoothedPath.push(point);
                    }
                }
            }
        }
    }
    
    // Add the last point
    smoothedPath.push(waypoints[waypoints.length - 1]);
    
    return smoothedPath;
};

// Calculate a point on a cubic bezier curve
function cubicBezier(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    
    return {
        longitude: mt3 * p0.longitude + 3 * mt2 * t * p1.longitude + 3 * mt * t2 * p2.longitude + t3 * p3.longitude,
        latitude: mt3 * p0.latitude + 3 * mt2 * t * p1.latitude + 3 * mt * t2 * p2.latitude + t3 * p3.latitude,
        height: mt3 * p0.height + 3 * mt2 * t * p1.height + 3 * mt * t2 * p2.height + t3 * p3.height
    };
} 