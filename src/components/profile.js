export class Profile {
    #mode = 'AHI'; // 'AHI' or 'RHI'
    #rangeKm = 50; // For RHI mode
    #sliceWidth = 15; // degrees

    constructor(map, lat, lng, maxDistance_m) {
        this.map = map;
        this.lat = lat;
        this.lng = lng;
        this.maxDistance_m = maxDistance_m;
        this.currentAzimuth = 0;

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
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                center, dragPos
            );
            // Snap to 250m increments
            const snappedDistance = Math.round(distance / 250) * 250;
            const clampedDistance = Math.max(250, Math.min(snappedDistance, this.maxDistance_m));

            this.#rangeKm = clampedDistance / 1000;

            // Update arc
            this._updateArc();

            // Update marker position on arc
            const midAzimuth = (this.currentAzimuth + this.#sliceWidth / 2) % 360;
            const newPos = this._getEdgePoint(this.lat, this.lng, clampedDistance, midAzimuth);
            this.arcDragMarker.setPosition(newPos);
        });

        this.arcDragEndListener = this.arcDragMarker.addListener('dragend', (event) => {
            // Snap marker to arc center at current range
            const midAzimuth = (this.currentAzimuth + this.#sliceWidth / 2) % 360;
            const rangeM = this.#rangeKm * 1000;
            const newPos = this._getEdgePoint(this.lat, this.lng, rangeM, midAzimuth);
            this.arcDragMarker.setPosition(newPos);
            this._dispatchRHIChanged();
        });

        // Drag marker to rotate slice
        const rotatePoint = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, arcMidAzimuth);
        this.rotateDragMarker = new google.maps.Marker({
            position: rotatePoint,
            map: this.map,
            clickable: true,
            icon: this._createMarkerIcon('blue'),
            draggable: true,
            zIndex: 999,
        });

        this.rotateDragListener = this.rotateDragMarker.addListener('drag', (event) => {
            const dragPos = event.latLng;
            const heading = google.maps.geometry.spherical.computeHeading(center, dragPos);
            const midAzimuth = (heading + 360) % 360;
            this.currentAzimuth = (midAzimuth - this.#sliceWidth / 2 + 360) % 360;

            this._updateRHILines();
            this._updateArc();

            // Keep marker on circle edge
            const constrainedPoint = this._constrainToCircle(dragPos.lat(), dragPos.lng(), this.maxDistance_m);
            this.rotateDragMarker.setPosition(constrainedPoint);

            // Update arc drag marker position
            const rangeM = this.#rangeKm * 1000;
            const newMidAzimuth = (this.currentAzimuth + this.#sliceWidth / 2) % 360;
            const arcMidPos = this._getEdgePoint(this.lat, this.lng, rangeM, newMidAzimuth);
            this.arcDragMarker.setPosition(arcMidPos);
        });

        this.rotateDragEndListener = this.rotateDragMarker.addListener('dragend', (event) => {
            // Snap marker to circle edge at slice center
            const midAzimuth = (this.currentAzimuth + this.#sliceWidth / 2) % 360;
            const newPos = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, midAzimuth);
            this.rotateDragMarker.setPosition(newPos);
            this._dispatchRHIChanged();
        });

        this._dispatchRHIChanged();
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
            scale: 1.5,
        };
    }

    _clearMapObjects() {
        if (this.dragListener) google.maps.event.removeListener(this.dragListener);
        if (this.dragEndListener) google.maps.event.removeListener(this.dragEndListener);
        if (this.arcDragListener) google.maps.event.removeListener(this.arcDragListener);
        if (this.arcDragEndListener) google.maps.event.removeListener(this.arcDragEndListener);
        if (this.rotateDragListener) google.maps.event.removeListener(this.rotateDragListener);
        if (this.rotateDragEndListener) google.maps.event.removeListener(this.rotateDragEndListener);

        if (this.dragMarker) this.dragMarker.setMap(null);
        if (this.arcDragMarker) this.arcDragMarker.setMap(null);
        if (this.rotateDragMarker) this.rotateDragMarker.setMap(null);
        if (this.line) this.line.setMap(null);
        if (this.line1) this.line1.setMap(null);
        if (this.line2) this.line2.setMap(null);
        if (this.arc) this.arc.setMap(null);
        if (this.circle) this.circle.setMap(null);

        this.dragListener = null;
        this.dragEndListener = null;
        this.arcDragListener = null;
        this.arcDragEndListener = null;
        this.rotateDragListener = null;
        this.rotateDragEndListener = null;
        this.dragMarker = null;
        this.arcDragMarker = null;
        this.rotateDragMarker = null;
        this.line = null;
        this.line1 = null;
        this.line2 = null;
        this.arc = null;
        this.circle = null;
    }

    setMode(mode) {
        if (mode === this.#mode) return;
        this.#mode = mode;

        if (mode === 'AHI') {
            this._setupAHI();
        } else {
            this._setupRHI();
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

        if (this.rotateDragMarker) {
            const rotatePos = this._getEdgePoint(this.lat, this.lng, this.maxDistance_m, midAzimuth);
            this.rotateDragMarker.setPosition(rotatePos);
        }

        if (this.arcDragMarker) {
            const arcMidPos = this._getEdgePoint(this.lat, this.lng, rangeM, midAzimuth);
            this.arcDragMarker.setPosition(arcMidPos);
        }

        this._dispatchRHIChanged();
    }

    _dispatchAzimuthChanged() {
        document.dispatchEvent(new CustomEvent('profile-azimuth-changed', {
            detail: { azimuth: this.currentAzimuth }
        }));
    }

    _dispatchRHIChanged() {
        document.dispatchEvent(new CustomEvent('profile-rhi-changed', {
            detail: {
                startAzimuth: this.currentAzimuth,
                endAzimuth: this.getEndAzimuth(),
                rangeKm: this.#rangeKm,
                sliceWidth: this.#sliceWidth
            }
        }));
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
    }
}