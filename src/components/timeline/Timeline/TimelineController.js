class TimelineController {
    constructor(timelineInstance, timelineEl) {
        this.timeline = timelineInstance;
        this.timelineElement = timelineEl;

        this.dragThreshold = 15;
        this.isDragging = false;
        this.lastX = 0;
        this.accumulatedDelta = 0;

        this._rangeSelectedCallback = null; // callback when a user has selected date range

        this._bindEvents();

        this.activePointerId = null;

        this.lastValidZoomTime = 0;
        this.wheelZoomDebounceMs = 200;
    }

    onRangeSelected(callback) {
        this._rangeSelectedCallback = callback;
    }

    _bindEvents() {
        this.clickTimeout = null;
        this._selectRangeEvents();
        this._zoomInEvent();
        this._timelineResizeEvent();
        this._panEvent();
        this._zoomOutEvent();
    }

    _selectRangeEvents() {
        // Select start and end time with single-click
        this.timelineElement.addEventListener('click', (e) => {
            if (e.detail > 1) return; // ignore if dblclick

            const unitElem = e.target.closest('.timeline-unit');
            if (!unitElem || !this.timelineElement.contains(unitElem)) return;


            this.clickTimeout = setTimeout(() => {
                const clickedDate = new Date(unitElem.getAttribute('date'));

                // Case 1: No dates selected
                if (!this.timeline.getStartDate() && !this.timeline.getEndDate()) {
                    this.timeline.setStartDate(clickedDate);
                    this.endDate = null;
                }
                // Case 2: Only a start date is selected
                else if (this.timeline.getStartDate() && !this.timeline.getEndDate()) {
                    if (clickedDate.getTime() === this.timeline.getStartDate().getTime()) {
                        this.timeline.clearStartDate();
                    } else {
                        if (clickedDate.getTime() < this.timeline.getStartDate().getTime()) {
                            this.timeline.setEndDate(this.timeline.getStartDate());
                            this.timeline.setStartDate(clickedDate);
                        } else {
                            this.timeline.setEndDate(clickedDate);
                        }
                        if (this._rangeSelectedCallback) {
                            this._rangeSelectedCallback({ startDate: this.timeline.getStartDate(), endDate: this.timeline.getEndDate() });
                        }
                    }
                }
                // Case 3: A start date and end date are selected
                else if (this.timeline.getStartDate() && this.timeline.getEndDate()) {
                    if (clickedDate.getTime() === this.timeline.getStartDate().getTime()) {
                        this.timeline.clearStartDate();
                        this.timeline.setStartDate(this.timeline.getEndDate());
                        this.timeline.clearEndDate();
                    }  else if (clickedDate.getTime() === this.timeline.getEndDate().getTime()) {
                        this.timeline.clearEndDate();
                    }
                }
                // Case 4: Only an end date is selected
                else if (this.timeline.getEndDate() && !this.timeline.getStartDate()) {
                    if (clickedDate.getTime() > this.timeline.getEndDate().getTime()) {
                        this.timeline.setEndDate(this.timeline.getStartDate());
                        this.timeline.setStartDate(clickedDate);
                    } else if (clickedDate.getTime() < this.timeline.getEndDate().getTime()) {
                        this.timeline.setStartDate(clickedDate);
                    } else {
                        this.timeline.clearEndDate();
                    }
                }
                this.clickTimeout = null;
            }, 333);
        });
    }

    _timelineResizeEvent() {
        // Listen to timeline resizing and adjust re-render
        const resizeObserver = new ResizeObserver(() => {
            this.timeline.render();
        });
        resizeObserver.observe(this.timelineElement);
    }

    _zoomInEvent() {
        // Double-click zoom in
        this.timelineElement.addEventListener('dblclick', (e) => {
            if (this.clickTimeout) {
                clearTimeout(this.clickTimeout); // Cancel pending click action
                this.clickTimeout = null;
            }

            const zoomToDate = this._getZoomDate(e);
            if (!zoomToDate) return;

            this.timeline.zoom('in', zoomToDate);
        });

        // Scroll to zoom in
        this.timelineElement.addEventListener('wheel', (e) => {
            if (e.deltaY < 0) {
                const now = Date.now();
                if (now - this.lastWheelZoomTime < this.wheelZoomDebounceMs) {
                    return;
                }
                this.lastWheelZoomTime = now;

                e.preventDefault();

                // find center
                const timelineSpans = this.timelineElement.children;
                if (timelineSpans.length === 0) return;

                const middleTimeSpan = timelineSpans[ Math.floor((timelineSpans.length - 1) / 2)];
                const isoDate = middleTimeSpan.getAttribute('date');
                const zoomToDate = new Date(isoDate);

                this.timeline.zoom('in', zoomToDate);
            }
        }, { passive: false });
    }

    _zoomOutEvent() {
        this.timelineElement.addEventListener('wheel', (e) => {
            if (e.deltaY > 0) {
                const now = Date.now();
                if (now - this.lastWheelZoomTime < this.wheelZoomDebounceMs) {
                    return;
                }
                this.lastWheelZoomTime = now;

                e.preventDefault();
                this.timeline.zoom('out');
            }
        }, { passive: false });
    }


    _panEvent() {
        this.timelineElement.style.touchAction = 'none';

        this.timelineElement.addEventListener('pointerdown', this._onPointerDown.bind(this));
        this.timelineElement.addEventListener('pointermove', this._onPointerMove.bind(this));
        this.timelineElement.addEventListener('pointerup', this._onPointerUp.bind(this));
        this.timelineElement.addEventListener('pointercancel', this._onPointerUp.bind(this));
        this.timelineElement.addEventListener('lostpointercapture', this._onPointerUp.bind(this));
    }

    _onPointerDown(e) {
        if (this.activePointerId !== null) return;

        this.activePointerId = e.pointerId;
        this.lastX = e.clientX;
        this.accumulatedDelta = 0;
    }

    _onPointerMove(e) {
        if (this.activePointerId === null || e.pointerId !== this.activePointerId) return;

        const deltaX = e.clientX - this.lastX;
        this.accumulatedDelta += deltaX;
        this.lastX = e.clientX;

        // Start dragging only after threshold is reached
        if (!this.isDragging && Math.abs(this.accumulatedDelta) >= this.dragThreshold) {
            this.isDragging = true;
            this.timelineElement.classList.add('dragging');
            this.timelineElement.setPointerCapture(e.pointerId);
        }

        if (this.isDragging && Math.abs(this.accumulatedDelta) >= this.dragThreshold) {
            const direction = this.accumulatedDelta > 0 ? 'left' : 'right';
            this.timeline.pan(direction);
            this.accumulatedDelta = 0;
        }
    }

    _onPointerUp(e) {
        if (e && e.pointerId !== this.activePointerId) return;

        if (this.isDragging) {
            this.isDragging = false;
            this.timelineElement.classList.remove('dragging');

            try {
                this.timelineElement.releasePointerCapture(this.activePointerId);
            } catch (err) {}
        }
        this.activePointerId = null;
    }

    _getZoomDate(event) {
        const unitElem = event.target.closest('.timeline-unit');
        if (!unitElem) return null;
        const isoDate = unitElem.getAttribute('date');
        return new Date(isoDate);
    }
}
window.TimelineController = TimelineController;