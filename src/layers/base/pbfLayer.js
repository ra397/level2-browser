import Pbf from "pbf";
import geobuf from "geobuf";

Function.prototype.clone = function() {
    var cloneObj = this;
    if(this.__isClone) {
        cloneObj = this.__clonedFrom;
    }

    var temp = function() { return cloneObj.apply(this, arguments); };
    for(var key in this) {
        temp[key] = this[key];
    }

    temp.__isClone = true;
    temp.__clonedFrom = cloneObj;

    return temp;
};

export class pbfLayer {
    constructor (conf, map) {
        this.map = map;
        this.tiles = [];
        this.loaded = [];
        this.TILE_SIZE = 256;
        this._timer = 0;
        this.zoom_changed_delay = 175
        this.hidden = false;
        this.tileStyle = this.defaultStyle.clone();

        this.check_exists = false;
        for (const [key, value] of Object.entries(conf)) {
            this[key] = value;
        }
    }

    deactivateEL = () => {
        google.maps.event.clearListeners(
            this.map,
            "zoom_changed"
        );
        google.maps.event.clearListeners(
            this.map,
            'dragend'
        );
    }

    activateEL = () => {
        google.maps.event.addListener(
            this.map,
            "zoom_changed",
            ()=> {
                if (this.hidden) return;
                this._timer =  setTimeout(
                    this.updatePbfLayer(true),
                    this.zoom_changed_delay
                );
            }
        );

        google.maps.event.addListener(
            this.map,
            'dragend',
            ()=> {
                if (this.hidden) return;
                this.updatePbfLayer(false);
            }
        );
    }

    defaultStyle(foo) {
        return {
            zIndex: 100,
            clickable: 0,
            fillOpacity: 1,
            fillColor: 'rgb(50, 104, 168)',
            strokeOpacity:1,
            strokeColor: 'rgb(50, 104, 168)',
            strokeWeight: 1
        };
    }

    async addPBF(url) {
        return new Promise(resolve => {
            if (this.check_exists && !ifExist(url)) {
                resolve(false);
            } else {
                let oReq = new XMLHttpRequest();
                oReq.open("GET", url, true);
                oReq.responseType = "arraybuffer";
                if (oReq.status === "404") resolve (false);
                let use_style = this.tileStyle;
                let use_data = this.data;
                let use_event = typeof(this.clickEvnt) == "function" ? this.clickEvnt : false;
                oReq.onload = function (oEvent) {
                    let buffer = new Uint8Array(oReq.response);
                    if (buffer.byteLength > 0) {
                        const pbf = new Pbf(buffer);
                        const geojson = geobuf.decode(pbf);
                        const lyr = new google.maps.Data();
                        lyr.addGeoJson(
                            geojson
                        );
                        lyr.setStyle(
                            function (feature) {
                                return use_style(feature, use_data);
                            }
                        );
                        if (use_event) {
                            lyr.addListener("click",
                                (event) => {
                                    use_event(event, use_data);
                                }
                            );
                        }
                        resolve(lyr)
                    } else {
                        resolve(false);
                    }
                }
                oReq.send(null);
            }
        })
    }

    project(latLng, tile_size=256) {
        let sinY = Math.sin((latLng.lat()* Math.PI) / 180);
        sinY = Math.min(Math.max(sinY, -0.9999), 0.9999);

        return new google.maps.Point(
            tile_size * (0.5 + latLng.lng() / 360),
            tile_size * (0.5 - Math.log((1 + sinY) / (1 - sinY)) / (4 * Math.PI))
        );
    }

    report(latLng, zoom) {
        const scale = 1 << zoom;
        const worldCoordinate = this.project(latLng);
        return new google.maps.Point(
            Math.floor((worldCoordinate.x * scale) / this.TILE_SIZE),
            Math.floor((worldCoordinate.y * scale) / this.TILE_SIZE)
        );
    }

    getPbfLyrBounds() {
        const _view = this.map.getBounds();
        const _lyr = new google.maps.LatLngBounds(
            {
                lat: this.extent.south,
                lng: this.extent.west
            }, {
                lat: this.extent.north,
                lng: this.extent.east
            }
        );

        const z = this.map.getZoom();
        let l_ne = this.report(_lyr.getNorthEast(), z);
        let l_sw = this.report(_lyr.getSouthWest(), z);

        let v_ne = this.report(_view.getNorthEast(), z);
        let v_sw = this.report(_view.getSouthWest(), z);
        let x0 = l_sw.x
        let x1 = l_ne.x
        let X0 = v_sw.x
        let X1 = v_ne.x

        let y1 = l_sw.y
        let y0 = l_ne.y
        let Y1 = v_sw.y
        let Y0 = v_ne.y


        const _s = y1 >= Y1 ? Y1 : y1;
        const _n = y0 <= Y0 ? Y0 : y0;

        const _e = x0 >= X0 ? x0 : X0;
        const _w = x1 <= X1 ? x1 : X1;

        return {
            ne: new google.maps.Point(
                _w, _n
            ),
            sw: new google.maps.Point(
                _e, _s
            )
        }
    }

    updatePbfLayer(reload) {
        let z = this.map.getZoom();
        if (z < this.z_min || z > this.z_max)  return;
        if (!this.map.getBounds().intersects(this.extent)) return;
        let use_bounds = this.getPbfLyrBounds();
        let ne = use_bounds.ne;
        let sw = use_bounds.sw;
        let _tiles = [];
        let _loaded = [];
        if (reload) this.loaded = [];
        let ct = 0
        for (let x=sw.x; x < ne.x + 1; x++){
            for (let y=ne.y; y < sw.y + 1; y++){
                ct += 1;
                let _zxy = `${z}/${x}/${y}`;
                let use_url = this.tileURL(_zxy);
                if (this.loaded.indexOf(_zxy) === -1) {
                    _loaded.push(_zxy);
                    _tiles.push(
                        this.addPBF(use_url,_zxy)
                    );
                }
            }
        }
        Promise.all(_tiles).then(
            (values) => {
                if (reload) {
                    this.tiles.forEach(
                        v=> {
                            if (v) v.setMap(null);
                            v = null;
                        }
                    );
                    this.tiles = [];
                    this.loaded = [];
                } else {
                    this.loaded.forEach(
                        (v,i)=> {
                            let t;
                            if (parseInt(v.split("/")[0]) !== this.map.getZoom()){
                                t = this.tiles[i]
                                if (t) t.setMap(null)
                                t = null;
                                this.loaded.splice(i, 1);
                                this.tile.splice(i, 1);
                            }
                        }

                    )
                }
                values.forEach(
                    v=> {
                        if (v) v.setMap(this.map);
                        this.tiles.push(v);
                    }
                );
                _loaded.forEach(v=> this.loaded.push(v));
                clearTimeout(this._timer)
                google.maps.event.trigger(this.map,'resize')
            }
        );
    }

    setMap (opt) {
        if (!opt)
            this.hide();
        else
            this.show();
    }

    hide () {
        this.tiles.forEach(
            v=> {
                if (v) v.setMap(null);
            }
        )
        this.hidden = true;
        this.deactivateEL();
    }

    show () {
        this.hidden = false;
        this.updatePbfLayer(1);
        this.activateEL();
    }

    remove () {
        this.tiles.forEach(
            v=> {
                if (v) v.setMap(null);
                v = null;
            }
        );
        this.deactivateEL();
    }
}