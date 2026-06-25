export const colorMap = {
    "area_rain": [ // %
        { max: 0.1,   color: "" },
        { max: 0.25,   color: "#ffffbf" },
        { max: 0.5, color: "#fdae61" },
        { max: Infinity,          color: "#d7191c" }
    ],
    "mean_rain": [ // mm
        { max: 25,   color: "" },
        { max: 75,   color: "#ffffbf" },
        { max: 150,   color: "#fdae61" },
        { max: Infinity,   color: "#d7191c" }
    ],
    "max_rain": [ // mm
        { max: 50,   color: "" },
        { max: 75,   color: "#ffffbf" },
        { max: 100,  color: "#fdae61" },
        { max: Infinity, color: "#d7191c" }
    ],
    "volume_rain": [ // m³ (displayed as Liters in tooltip)
        { max: 1e11,   color: "" },
        { max: 1e12,   color: "#ffffbf" },
        { max: 1e13,   color: "#fdae61" },
        { max: Infinity, color: "#d7191c" }
    ]
};


const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];
const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export class Calendar {
    constructor(startDate, endDate, currentYear, container, data, variable, colorMap, onDayClick, tzOffset = 0) {
        this.container = container;
        this.monthsEl = this.container.querySelector('#months');

        this.startDate = startDate;
        this.endDate = endDate;
        this.currentYear = currentYear;

        this.data = data;
        this.colorMap = colorMap;

        this.variable = variable;
        this.onDayClick = onDayClick;
        this.tzOffset = tzOffset;

        this.render();
    }

    setTimezoneOffset(tzOffset) {
        this.tzOffset = tzOffset;
    }

    setYear(year) {
        this.currentYear = year;
        this.render();
    }

    updateData(newData) {
        this.data = newData;
        this.render();
    }

    updateVariable(newVariable) {
        this.variable = newVariable;
        this.render();
    }

    render() {
        this.monthsEl.innerHTML = "";
        for (let m = 0; m < 12; m++) {
            this.monthsEl.appendChild(this.#buildMonth(m));
        }
    }

    #buildMonth(month) {
        const wrap = document.createElement("div");
        wrap.className = "month";

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = MONTHS[month] + " " + this.currentYear;
        wrap.appendChild(name);

        const grid = document.createElement("div");
        grid.className = "grid";

        DOW.forEach(d => {
            const el = document.createElement("div");
            el.className = "dow";
            el.textContent = d;
            grid.appendChild(el);
        });

        const firstDay = new Date(this.currentYear, month, 1).getDay();
        const daysInMonth = new Date(this.currentYear, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement("div"));
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const el = document.createElement("div");
            const isToday = d === this.endDate.getDate() &&
                month === this.endDate.getMonth() && this.currentYear === this.endDate.getFullYear();
            el.className = "day" + (isToday ? " today" : "");

            el.classList.add('day');
            if (isToday) el.classList.add("today");

            const currentDate = new Date(this.currentYear, month, d);
            const isOutOfRange = currentDate < this.startDate || currentDate > this.endDate;
            if (isOutOfRange) el.classList.add('disabled');

            // Compute day timestamp adjusted for timezone
            // When using local time, we need the timestamp that represents local midnight
            const utcTimestamp = Date.UTC(this.currentYear, month, d) / 1000;
            const adjustedTimestamp = utcTimestamp - this.tzOffset;
            const DAY = 86400;
            const dayStart = Math.floor(adjustedTimestamp / DAY) * DAY;
            const dataIndex = this.data['timestamps'].indexOf(dayStart);

            if (dataIndex !== -1) {
                const dataVal= this.data[this.variable][dataIndex];
                el.dataset.val = dataVal.toString();
                const colorMap = this.colorMap[this.variable];
                el.style.background = this.#getColor(dataVal, colorMap);


                // Add to element title
                let formattedVal;
                if (this.variable === "max_rain") {
                    formattedVal = dataVal.toFixed(2) + " mm";
                } else if (this.variable === "area_rain") {
                    formattedVal = (dataVal * 100).toFixed(2) + "%";
                } else if (this.variable === "mean_rain") {
                    formattedVal = dataVal.toFixed(2) + " mm";
                } else if (this.variable === "volume_rain") {
                    // Convert mm³ to Liters (1 L = 1,000,000 mm³)
                    const liters = dataVal / 1e6;
                    if (liters >= 1e9) {
                        formattedVal = (liters / 1e9).toFixed(2) + " GL"; // Gigaliters
                    } else if (liters >= 1e6) {
                        formattedVal = (liters / 1e6).toFixed(2) + " ML"; // Megaliters
                    } else if (liters >= 1e3) {
                        formattedVal = (liters / 1e3).toFixed(2) + " kL"; // Kiloliters
                    } else {
                        formattedVal = liters.toFixed(2) + " L";
                    }
                } else {
                    formattedVal = dataVal.toFixed(2);
                }
                el.title = formattedVal;
            } else {
                el.dataset.val = '-1';
                el.title = "No data";
            }

            el.textContent = d;

            if (!isOutOfRange) {
                el.addEventListener('click', () => {
                    this.onDayClick?.(dayStart, currentDate);
                });
            }

            grid.appendChild(el);
        }

        wrap.appendChild(grid);
        return wrap;
    }

    #getColor(value, colorMap) {
        if (value === undefined || isNaN(value)) return "";
        const match = colorMap.find(rule => value <= rule.max);
        return match ? match.color : "";
    }
}