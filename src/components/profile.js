export class Profile {
    constructor(map, lat, lng, distance_m) {
        this.map = map;
        this.lat = lat;
        this.lng = lng;
        this.distance_m = distance_m;
        this.currentAzimuth = 0;

        this._setup();
    }

    _setup() {
        this.circle = new google.maps.Circle({
            center: { lat: this.lat, lng: this.lng },
            radius: this.distance_m,
            map: this.map,
            strokeColor: 'orange',
            strokeWeight: 1,
            fillOpacity: 0.0,
            clickable: false
        });

        const edgePoint = this._getEdgePoint(this.lat, this.lng, this.distance_m, this.currentAzimuth);

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
            icon: {
                path: "M0,0 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0",
                fillColor: 'blue',
                fillOpacity: 1,
                strokeColor: 'blue',
                strokeWeight: 0,
                scale: 1.5,
            },
            draggable: true,
        });

        this.dragListener = this.dragMarker.addListener('drag', (event) => {
            const dragPos = event.latLng;
            const constrainedPoint = this._constrainToCircle(dragPos.lat(), dragPos.lng());
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
            const constrainedPoint = this._constrainToCircle(dragPos.lat(), dragPos.lng());
            this.dragMarker.setPosition(constrainedPoint);
            this._dispatchAzimuthChanged();
        });

        // Dispatch initial azimuth
        this._dispatchAzimuthChanged();
    }

    _dispatchAzimuthChanged() {
        document.dispatchEvent(new CustomEvent('profile-azimuth-changed', {
            detail: { azimuth: this.currentAzimuth }
        }));
    }

    getAzimuth() {
        return this.currentAzimuth;
    }

    _constrainToCircle(lat, lng) {
        const center = { lat: this.lat, lng: this.lng };
        const point = { lat: lat, lng: lng };

        const heading = google.maps.geometry.spherical.computeHeading(center, point);

        const edgePoint = google.maps.geometry.spherical.computeOffset(
            center, this.distance_m, heading
        );

        return { lat: edgePoint.lat(), lng: edgePoint.lng() };
    }

    _getEdgePoint(lat, lng, distance_m, azimuth) {
        const edgePoint = google.maps.geometry.spherical.computeOffset(
            { lat: lat, lng: lng }, distance_m, azimuth
        );
        return { lat: edgePoint.lat(), lng: edgePoint.lng() };
    }

    destroy() {
        if (this.dragListener) {
            google.maps.event.removeListener(this.dragListener);
            this.dragListener = null;
        }
        if (this.dragEndListener) {
            google.maps.event.removeListener(this.dragEndListener);
            this.dragEndListener = null;
        }
        if (this.dragMarker) {
            this.dragMarker.setMap(null);
            this.dragMarker = null;
        }
        if (this.line) {
            this.line.setMap(null);
            this.line = null;
        }
        if (this.circle) {
            this.circle.setMap(null);
            this.circle = null;
        }
    }
}