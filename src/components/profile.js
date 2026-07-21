export class Profile {
    #mode = 'AHI'; // 'AHI', 'RHI', or 'AXS'
    #rangeKm = 230; // For RHI mode
    #sliceWidth = 15; // degrees
    #axsPointA = null; // For AXS mode
    #axsPointB = null; // For AXS mode

    constructor(map, lat, lng, maxDistance_m, radarId = null) {
        this.map = map;
        this.lat = lat;
        this.lng = lng;
        this.maxDistance_m = maxDistance_m;
        this.currentAzimuth = 0;
        this.radarId = radarId;

        this.hoverMarker = null;
        this._hoverListener = (e) => {
            const { t, mode, radarId } = e.detail;
            if (mode !== this.#mode) return;
            if (radarId !== this.radarId) return;
            this._updateHoverMarker(t);
        };
        document.addEventListener('profile-hover-position', this._hoverListener);

        this._setupAHI();
    }

    _setupAHI() {
        this._clearMapObjects();

        this.circle = new google.maps.Circle({
            center: { lat: this.lat, lng: this.lng },
            radius: this.maxDistance_m,
            map: this.map,
            strokeColor: 'orange',
            strokeWeight: 1,
            fillOpacity: 0.0,
            clickable: false
        });

        const edgePoint = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, this.currentAzimuth);

        this.line = new google.maps.Polyline({
            path: [{ lat: this.lat, lng: this.lng }, { lat: edgePoint.lat, lng: edgePoint.lng }],
            strokeColor: "#000",
            strokeWeight: 1,
            strokeOpacity: 1.0,
            map: this.map
        });

        this.dragMarker = new google.maps.Marker({
            position: { lat: edgePoint.lat, lng: edgePoint.lng },
            map: this.map,
            clickable: true,
            icon: this._createMarkerIcon('blue'),
            draggable: true,
        });

        this.dragListener = this.dragMarker.addListener('drag', (event) => {
            const dragPos = event.latLng;
            const constrainedPoint = this._constrainToCircle(dragPos.lat(), dragPos.lng(), this.maxDistance_m);
            this.dragMarker.setPosition(constrainedPoint);
            this.line.setPath([
                { lat: this.lat, lng: this.lng },
                constrainedPoint
            ]);
            const azimuth = google.maps.geometry.spherical.computeHeading(
                { lat: this.lat, lng: this.lng },
                constrainedPoint
            );
            this.currentAzimuth = (azimuth + 360) % 360;
        });

        this.dragEndListener = this.dragMarker.addListener('dragend', (event) => {
            const dragPos = event.latLng;
            const constrainedPoint = this._constrainToCircle(dragPos.lat(), dragPos.lng(), this.maxDistance_m);
            this.dragMarker.setPosition(constrainedPoint);
            this._dispatchAzimuthChanged();
        });

        this._dispatchAzimuthChanged();
    }

    _setupRHI() {
        this._clearMapObjects();

        this.circle = new google.maps.Circle({
            center: { lat: this.lat, lng: this.lng },
            radius: this.maxDistance_m,
            map: this.map,
            strokeColor: 'orange',
            strokeWeight: 1,
            fillOpacity: 0.0,
            clickable: false
        });

        const center = { lat: this.lat, lng: this.lng };
        const startAzimuth = this.currentAzimuth;
        const endAzimuth = (this.currentAzimuth + this.#sliceWidth) % 360;
        const rangeM = this.#rangeKm * 1000;

        // Line 1: start azimuth
        const startEdge = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, startAzimuth);
        this.line1 = new google.maps.Polyline({
            path: [center, startEdge],
            strokeColor: "#000",
            strokeWeight: 1,
            strokeOpacity: 0.5,
            map: this.map
        });

        // Line 2: end azimuth
        const endEdge = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, endAzimuth);
        this.line2 = new google.maps.Polyline({
            path: [center, endEdge],
            strokeColor: "#000",
            strokeWeight: 1,
            strokeOpacity: 0.5,
            map: this.map
        });

        // Arc at current range
        this._createArc(rangeM, startAzimuth, endAzimuth);

        // Drag marker on arc to change range
        const arcMidAzimuth = (startAzimuth + this.#sliceWidth / 2) % 360;
        const arcMidPoint = this._getEdgePoint(this.lat, this.lng, rangeM, arcMidAzimuth);

        this.arcDragMarker = new google.maps.Marker({
            position: arcMidPoint,
            map: this.map,
            clickable: true,
            icon: this._createMarkerIcon('green'),
            draggable: true,
            zIndex: 1000,
        });

        this.arcDragListener = this.arcDragMarker.addListener('drag', (event) => {
            const dragPos = event.latLng;
            const center = { lat: this.lat, lng: this.lng };

            // Calculate distance for range control
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                center, dragPos
            );
            // Snap to 250m increments
            const snappedDistance = Math.round(distance / 250) * 250;
            const clampedDistance = Math.max(250, Math.min(snappedDistance, this.maxDistance_m));
            this.#rangeKm = clampedDistance / 1000;

            // Calculate heading for azimuth control
            const heading = google.maps.geometry.spherical.computeHeading(center, dragPos);
            const midAzimuth = (heading + 360) % 360;
            this.currentAzimuth = (midAzimuth - this.#sliceWidth / 2 + 360) % 360;

            // Update lines and arc
            this._updateRHILines();
            this._updateArc();

            // Update marker position on arc at new azimuth and range
            const newPos = this._getEdgePoint(this.lat, this.lng, clampedDistance, midAzimuth);
            this.arcDragMarker.setPosition(newPos);
        });

        this.arcDragEndListener = this.arcDragMarker.addListener('dragend', (event) => {
            // Snap marker to arc center at current range and azimuth
            const midAzimuth = (this.currentAzimuth + this.#sliceWidth / 2) % 360;
            const rangeM = this.#rangeKm * 1000;
            const newPos = this._getEdgePoint(this.lat, this.lng, rangeM, midAzimuth);
            this.arcDragMarker.setPosition(newPos);
            this._dispatchRHIChanged();
        });

        this._dispatchRHIChanged();
    }

    _setupAXS() {
        this._clearMapObjects();

        // Only set initial points if not already set (preserve state)
        if (!this.#axsPointA || !this.#axsPointB) {
            this.#axsPointA = { lat: this.lat, lng: this.lng };
            this.#axsPointB = this._getEdgePoint(this.lat, this.lng, 230_000, 0);
        }

        const pointA = this.#axsPointA;
        const pointB = this.#axsPointB;

        this.circle = new google.maps.Circle({
            center: { lat: this.lat, lng: this.lng },
            radius: this.maxDistance_m,
            map: this.map,
            strokeColor: 'orange',
            strokeWeight: 1,
            fillOpacity: 0.0,
            clickable: false
        });

        // Line connecting A and B
        this.axsLine = new google.maps.Polyline({
            path: [pointA, pointB],
            strokeColor: "#000",
            strokeWeight: 2,
            strokeOpacity: 1.0,
            map: this.map
        });

        // Marker A (start) - at radar position initially
        this.axsMarkerA = new google.maps.Marker({
            position: pointA,
            map: this.map,
            clickable: true,
            icon: this._createMarkerIcon('#66ff00'),
            draggable: true,
            zIndex: 1000,
        });

        // Marker B (end) - 50km north initially
        this.axsMarkerB = new google.maps.Marker({
            position: pointB,
            map: this.map,
            clickable: true,
            icon: this._createMarkerIcon('#ff000d'),
            draggable: true,
            zIndex: 1001,
        });

        // Drag listener for Marker A - constrain to 50km from point B
        this.axsMarkerADragEndListener = this.axsMarkerA.addListener('dragend', (event) => {
            const dragPos = event.latLng;
            const pointB = new google.maps.LatLng(this.#axsPointB.lat, this.#axsPointB.lng);
            const maxDistanceM = 460_000;

            const distFromB = google.maps.geometry.spherical.computeDistanceBetween(pointB, dragPos);

            let newPos;
            if (distFromB > maxDistanceM) {
                const heading = google.maps.geometry.spherical.computeHeading(pointB, dragPos);
                const constrainedPoint = google.maps.geometry.spherical.computeOffset(pointB, maxDistanceM, heading);
                newPos = { lat: constrainedPoint.lat(), lng: constrainedPoint.lng() };
            } else {
                newPos = { lat: dragPos.lat(), lng: dragPos.lng() };
            }

            this.axsMarkerA.setPosition(newPos);
            this.#axsPointA = newPos;
            this.axsLine.setPath([newPos, this.#axsPointB]);
            this._dispatchAXSLineUpdated();
        });

        this.axsMarkerADragEndListener = this.axsMarkerA.addListener('dragend', () => {
            this._dispatchAXSLineUpdated();
        });

        // Drag listener for Marker B - constrain to 50km from point A
        this.axsMarkerBDragEndListener = this.axsMarkerB.addListener('dragend', (event) => {
            const dragPos = event.latLng;
            const pointA = new google.maps.LatLng(this.#axsPointA.lat, this.#axsPointA.lng);
            const maxDistanceM = 460_000;

            const distFromA = google.maps.geometry.spherical.computeDistanceBetween(pointA, dragPos);

            let newPos;
            if (distFromA > maxDistanceM) {
                const heading = google.maps.geometry.spherical.computeHeading(pointA, dragPos);
                const constrainedPoint = google.maps.geometry.spherical.computeOffset(pointA, maxDistanceM, heading);
                newPos = { lat: constrainedPoint.lat(), lng: constrainedPoint.lng() };
            } else {
                newPos = { lat: dragPos.lat(), lng: dragPos.lng() };
            }

            this.axsMarkerB.setPosition(newPos);
            this.#axsPointB = newPos;
            this.axsLine.setPath([this.#axsPointA, newPos]);
            this._dispatchAXSLineUpdated();
        });

        this.axsMarkerBDragEndListener = this.axsMarkerB.addListener('dragend', () => {
            this._dispatchAXSLineUpdated();
        });
        this._dispatchAXSLineUpdated();
    }

    _createArc(radiusM, startAzimuth, endAzimuth) {
        const points = [];
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
            const az = startAzimuth + (i / steps) * this.#sliceWidth;
            const pt = this._getEdgePoint(this.lat, this.lng, radiusM, az);
            points.push(pt);
        }

        this.arc = new google.maps.Polyline({
            path: points,
            strokeColor: "#000",
            strokeWeight: 2,
            strokeOpacity: 1.0,
            map: this.map
        });
    }

    _updateArc() {
        if (!this.arc) return;
        const rangeM = this.#rangeKm * 1000;
        const points = [];
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
            const az = this.currentAzimuth + (i / steps) * this.#sliceWidth;
            const pt = this._getEdgePoint(this.lat, this.lng, rangeM, az);
            points.push(pt);
        }
        this.arc.setPath(points);
    }

    _updateRHILines() {
        if (!this.line1 || !this.line2) return;
        const center = { lat: this.lat, lng: this.lng };
        const startAzimuth = this.currentAzimuth;
        const endAzimuth = (this.currentAzimuth + this.#sliceWidth) % 360;

        const startEdge = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, startAzimuth);
        const endEdge = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, endAzimuth);

        this.line1.setPath([center, startEdge]);
        this.line2.setPath([center, endEdge]);
    }

    _createMarkerIcon(color) {
        return {
            path: "M0,0 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0",
            fillColor: color,
            fillOpacity: 1,
            strokeColor: color,
            strokeWeight: 0,
            scale: 2.5,
        };
    }

    _updateHoverMarker(t) {
        let position;

        if (this.#mode === 'AHI') {
            const distance = t * this.maxDistance_m;
            position = this._getEdgePoint(this.lat, this.lng, distance, this.currentAzimuth);
        } else if (this.#mode === 'AXS') {
            if (!this.#axsPointA || !this.#axsPointB) return;
            const a = new google.maps.LatLng(this.#axsPointA.lat, this.#axsPointA.lng);
            const b = new google.maps.LatLng(this.#axsPointB.lat, this.#axsPointB.lng);
            const interpolated = google.maps.geometry.spherical.interpolate(a, b, t);
            position = { lat: interpolated.lat(), lng: interpolated.lng() };
        } else if (this.#mode === 'RHI') {
            const azimuth = (this.currentAzimuth + t * this.#sliceWidth) % 360;
            const rangeM = this.#rangeKm * 1000;
            position = this._getEdgePoint(this.lat, this.lng, rangeM, azimuth);
        } else {
            return;
        }

        if (!this.hoverMarker) {
            this.hoverMarker = new google.maps.Marker({
                position,
                map: this.map,
                icon: this._createMarkerIcon('black'),
                clickable: false,
                zIndex: 999,
            });
        } else {
            this.hoverMarker.setPosition(position);
            this.hoverMarker.setMap(this.map);
        }
    }

    _removeHoverListener() {
        if (this._hoverListener) {
            document.removeEventListener('profile-hover-position', this._hoverListener);
            this._hoverListener = null;
        }
    }

    _clearMapObjects() {
        if (this.dragListener) google.maps.event.removeListener(this.dragListener);
        if (this.dragEndListener) google.maps.event.removeListener(this.dragEndListener);
        if (this.arcDragListener) google.maps.event.removeListener(this.arcDragListener);
        if (this.arcDragEndListener) google.maps.event.removeListener(this.arcDragEndListener);
        if (this.rotateDragListener) google.maps.event.removeListener(this.rotateDragListener);
        if (this.rotateDragEndListener) google.maps.event.removeListener(this.rotateDragEndListener);
        if (this.axsMarkerADragListener) google.maps.event.removeListener(this.axsMarkerADragListener);
        if (this.axsMarkerADragEndListener) google.maps.event.removeListener(this.axsMarkerADragEndListener);
        if (this.axsMarkerBDragListener) google.maps.event.removeListener(this.axsMarkerBDragListener);
        if (this.axsMarkerBDragEndListener) google.maps.event.removeListener(this.axsMarkerBDragEndListener);

        if (this.dragMarker) this.dragMarker.setMap(null);
        if (this.arcDragMarker) this.arcDragMarker.setMap(null);
        if (this.line) this.line.setMap(null);
        if (this.line1) this.line1.setMap(null);
        if (this.line2) this.line2.setMap(null);
        if (this.arc) this.arc.setMap(null);
        if (this.circle) this.circle.setMap(null);
        if (this.axsMarkerA) this.axsMarkerA.setMap(null);
        if (this.axsMarkerB) this.axsMarkerB.setMap(null);
        if (this.axsLine) this.axsLine.setMap(null);

        if (this.hoverMarker) this.hoverMarker.setMap(null);
        this.hoverMarker = null;

        this.dragListener = null;
        this.dragEndListener = null;
        this.arcDragListener = null;
        this.arcDragEndListener = null;
        this.rotateDragListener = null;
        this.rotateDragEndListener = null;
        this.dragMarker = null;
        this.arcDragMarker = null;
        this.line = null;
        this.line1 = null;
        this.line2 = null;
        this.arc = null;
        this.circle = null;
        this.axsMarkerADragListener = null;
        this.axsMarkerADragEndListener = null;
        this.axsMarkerBDragListener = null;
        this.axsMarkerBDragEndListener = null;
        this.axsMarkerA = null;
        this.axsMarkerB = null;
        this.axsLine = null;
    }

    setMode(mode) {
        if (mode === this.#mode) return;
        this.#mode = mode;

        if (mode === 'AHI') {
            this._setupAHI();
        } else if (mode === 'RHI') {
            this._setupRHI();
        } else if (mode === 'AXS') {
            this._setupAXS();
        }
    }

    getMode() {
        return this.#mode;
    }

    getAzimuth() {
        return this.currentAzimuth;
    }

    getEndAzimuth() {
        return (this.currentAzimuth + this.#sliceWidth) % 360;
    }

    getRangeKm() {
        return this.#rangeKm;
    }

    getSliceWidth() {
        return this.#sliceWidth;
    }

    getPointA() {
        return this.#axsPointA;
    }

    getPointB() {
        return this.#axsPointB;
    }

    setAzimuth(azimuth) {
        this.currentAzimuth = azimuth;

        const edgePoint = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, this.currentAzimuth);
        if (this.dragMarker) {
            this.dragMarker.setPosition(edgePoint);
        }
        if (this.line) {
            this.line.setPath([
                { lat: this.lat, lng: this.lng },
                edgePoint
            ]);
        }
        this._dispatchAzimuthChanged();
    }

    setRHI(azimuth, rangeKm) {
        this.currentAzimuth = azimuth;

        const snappedRange = Math.round(rangeKm * 4) / 4;
        this.#rangeKm = Math.max(0.25, Math.min(snappedRange, this.maxDistance_m / 1000));

        this._updateRHILines();
        this._updateArc();

        const midAzimuth = (this.currentAzimuth + this.#sliceWidth / 2) % 360;
        const rangeM = this.#rangeKm * 1000;

        if (this.arcDragMarker) {
            const arcMidPos = this._getEdgePoint(this.lat, this.lng, rangeM, midAzimuth);
            this.arcDragMarker.setPosition(arcMidPos);
        }

        this._dispatchRHIChanged();
    }

    setAXS(pointA, pointB) {
        this.#axsPointA = pointA;
        this.#axsPointB = pointB;

        if (this.axsMarkerA) {
            this.axsMarkerA.setPosition(pointA);
        }
        if (this.axsMarkerB) {
            this.axsMarkerB.setPosition(pointB);
        }
        if (this.axsLine) {
            this.axsLine.setPath([pointA, pointB]);
        }

        this._dispatchAXSChanged();
    }

    _dispatchAzimuthChanged() {
        document.dispatchEvent(new CustomEvent('profile-azimuth-changed', {
            detail: {
                azimuth: this.currentAzimuth,
                radarId: this.radarId,
            }
        }));
    }

    _dispatchRHIChanged() {
        document.dispatchEvent(new CustomEvent('profile-rhi-changed', {
            detail: {
                startAzimuth: this.currentAzimuth,
                endAzimuth: this.getEndAzimuth(),
                rangeKm: this.#rangeKm,
                sliceWidth: this.#sliceWidth,
                radarId: this.radarId,
            }
        }));
    }

    _dispatchAXSLineUpdated() {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(this.#axsPointA.lat, this.#axsPointA.lng),
            new google.maps.LatLng(this.#axsPointB.lat, this.#axsPointB.lng)
        );

        document.dispatchEvent(new CustomEvent('profile-axs-line-updated', {
            detail: {
                pointA: this.#axsPointA,
                pointB: this.#axsPointB,
                lineLengthKm: distance / 1000,
                radarId: this.radarId,
            }
        }));
    }

    _dispatchAXSChanged() {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(this.#axsPointA.lat, this.#axsPointA.lng),
            new google.maps.LatLng(this.#axsPointB.lat, this.#axsPointB.lng)
        );

        document.dispatchEvent(new CustomEvent('profile-axs-changed', {
            detail: {
                pointA: this.#axsPointA,
                pointB: this.#axsPointB,
                lineLengthKm: distance / 1000,
                radarId: this.radarId,
            }
        }));
    }

    confirmAXS() {
        this._dispatchAXSChanged();
    }

    _constrainToCircle(lat, lng, radius) {
        const center = { lat: this.lat, lng: this.lng };
        const point = { lat: lat, lng: lng };
        const heading = google.maps.geometry.spherical.computeHeading(center, point);
        const edgePoint = google.maps.geometry.spherical.computeOffset(center, radius, heading);
        return { lat: edgePoint.lat(), lng: edgePoint.lng() };
    }

    _getEdgePoint(lat, lng, distance_m, azimuth) {
        const edgePoint = google.maps.geometry.spherical.computeOffset(
            { lat: lat, lng: lng }, distance_m, azimuth
        );
        return { lat: edgePoint.lat(), lng: edgePoint.lng() };
    }

    destroy() {
        this._clearMapObjects();
        this._removeHoverListener();
    }

    hide() {
        if (this.circle) this.circle.setMap(null);
        if (this.line) this.line.setMap(null);
        if (this.line1) this.line1.setMap(null);
        if (this.line2) this.line2.setMap(null);
        if (this.arc) this.arc.setMap(null);
        if (this.dragMarker) this.dragMarker.setMap(null);
        if (this.arcDragMarker) this.arcDragMarker.setMap(null);
        if (this.axsMarkerA) this.axsMarkerA.setMap(null);
        if (this.axsMarkerB) this.axsMarkerB.setMap(null);
        if (this.axsLine) this.axsLine.setMap(null);
        if (this.hoverMarker) this.hoverMarker.setMap(null);
    }

    show() {
        if (this.circle) this.circle.setMap(this.map);
        if (this.line) this.line.setMap(this.map);
        if (this.line1) this.line1.setMap(this.map);
        if (this.line2) this.line2.setMap(this.map);
        if (this.arc) this.arc.setMap(this.map);
        if (this.dragMarker) this.dragMarker.setMap(this.map);
        if (this.arcDragMarker) this.arcDragMarker.setMap(this.map);
        if (this.axsMarkerA) this.axsMarkerA.setMap(this.map);
        if (this.axsMarkerB) this.axsMarkerB.setMap(this.map);
        if (this.axsLine) this.axsLine.setMap(this.map);
        if (this.hoverMarker) this.hoverMarker.setMap(this.map);
    }
}