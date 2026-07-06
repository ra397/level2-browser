import './draggable.css';

export const draggerClassList = ['drag-cnr tl-cnr', 'drag-cnr tr-cnr', 'drag-cnr bl-cnr', 'drag-cnr br-cnr'];

export class DragContainer {
    constructor(el, className = null) {
        this.controlled = el;
        this.controlled.setAttribute('data-drag-container', '');
        this.pos1 = el.offsetLeft;
        this.pos2 = el.offsetTop;
        this.pos3 = 0;
        this.pos4 = 0;

        this.draggers = [];
        this.titleBar = null;
        this._titleBarHandler = null;

        if (Array.isArray(className)) className.forEach(cl => {
            console.log("Adding dragger: ", cl, " to ", this.controlled, "")
            this.addDragger(cl)
        });
        else if (className) this.addDragger(className);

        if (this.controlled?.id) this.getStoredPosition();
        this.observer = new MutationObserver(() => this.inViewport());
        this.observer.observe(this.controlled, {
            attributes: true,
            attributeFilter: ['class']
        });

        this.animationFrame = null;
    }

    getStoredPosition = () => {
        window.requestAnimationFrame(() => this.inViewport());
    }

    addDragger(className) {
        const dragger = document.createElement("div");
        dragger.className = className;
        this.draggers.push(dragger);
        this.controlled.appendChild(dragger);
        this.setupDrag(dragger);
    }

    startDrag(ev) {
        ev.preventDefault();
        this.reorder();
        this.controlled.style.borderColor = 'green';
        this.pos3 = ev.clientX;
        this.pos4 = ev.clientY;

        document.onpointermove = (e) => {
            this.latestEvent = e;
            if (!this.animationFrame) {
                this.animationFrame = requestAnimationFrame(this.elementDrag.bind(this));
            }
        };
        document.onpointerup = this.closeDragElement.bind(this);
    }

    addTitleBar(elOrSelector) {
        this.removeTitleBar();

        const el = typeof elOrSelector === 'string'
            ? this.controlled.querySelector(elOrSelector) || document.querySelector(elOrSelector)
            : elOrSelector;

        if (!el) {
            console.warn('DragContainer: title bar element not found:', elOrSelector);
            return null;
        }

        this.titleBar = el;
        el.style.cursor = 'move';
        el.style.userSelect = 'none';

        this._titleBarHandler = (ev) => {
            if (ev.target.closest('button, input, select, textarea, a, [contenteditable]')) return;
            this.startDrag(ev);
        };

        el.addEventListener('pointerdown', this._titleBarHandler);
        return el;
    }

    removeTitleBar() {
        if (!this.titleBar) return;
        this.titleBar.removeEventListener('pointerdown', this._titleBarHandler);
        this.titleBar.style.cursor = '';
        this.titleBar.style.userSelect = '';
        this.titleBar = null;
        this._titleBarHandler = null;
    }

    reorder() {
        const selector = this.draggers.length
            ? "." + this.draggers[0].classList[0]
            : '[data-drag-container]';

        const els = [
            ...new Set(
                Array.from(
                    document.querySelectorAll(selector)
                ).map(e => this.draggers.length ? e.parentElement : e)
            )
        ];
        els.sort((a, b) => {
            const _a = parseInt(window.getComputedStyle(a).zIndex, 10);
            const _b = parseInt(window.getComputedStyle(b).zIndex, 10);
            return (isNaN(_a) ? 0 : _a) - (isNaN(_b) ? 0 : _b);
        });

        els.forEach((el, i) => {
            el.style.setProperty('z-index', String(i));
        });
        this.controlled.style.setProperty('z-index', els.length + 1);
    }

    setupDrag(dragger) {
        dragger.onpointerdown = (ev) => this.startDrag(ev);
    }

    elementDrag() {
        const ev = this.latestEvent;
        this.animationFrame = null;

        this.pos1 = this.pos3 - ev.clientX;
        this.pos2 = this.pos4 - ev.clientY;
        this.pos3 = ev.clientX;
        this.pos4 = ev.clientY;

        this.controlled.style.left = (this.controlled.offsetLeft - this.pos1) + "px";
        this.controlled.style.top = (this.controlled.offsetTop - this.pos2) + "px";
    }

    closeDragElement() {
        document.onpointerup = null;
        document.onpointermove = null;
        this.animationFrame = null;
        this.controlled.style.borderColor = '';
    }

    inViewport() {
        const rect = this.controlled.getBoundingClientRect();
        const use_width = window.innerWidth || document.documentElement.clientWidth;
        const use_height = window.innerHeight || document.documentElement.clientHeight;
        const out = {
            top: rect.top < 0,
            left: rect.left < 0,
            bottom: rect.bottom > use_height,
            right: rect.right > use_width
        };

        if (out.left) this.controlled.style.left = '15px';
        else if (out.right) this.controlled.style.left = (use_width - this.controlled.offsetWidth - 15) + 'px';
        if (out.top) this.controlled.style.top = '15px';
        if (out.bottom) this.controlled.style.top = (use_height - this.controlled.offsetHeight - 15) + 'px';
    }
}