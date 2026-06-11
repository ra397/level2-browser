const viewLevel2Btn = document.getElementById("viewLevel2Btn");

const unitMap = {
    "area_rain": "%",
    "mean_rain": "mm",
    "max_rain": "mm",
};

const formatValue = (value, variable) => {
    if (variable === "max_rain") {
        return value.toFixed(2) + " mm";
    } else if (variable === "area_rain") {
        return (value * 100).toFixed(2) + "%";
    } else if (variable === "mean_rain") {
        return value.toFixed(2) + " mm";
    }
    return value.toFixed(2);
};

export function barChart(el, { data, onSelect, labelEvery = 3, variable }) {
    const max = Math.max(...data.map(d => d.value)) || 1;
    el.classList.add("bar-chart");
    el.innerHTML = `
      <div>
        <div class="bars">${data.map(d =>
        `<div class="bar" data-timestamp="${d.timestamp.getTime()}" title="${formatValue(d.value, variable)}" style="height:calc(5px + ${d.value / max * 100}%)"></div>`).join("")}</div>
        <div class="labels">${data.map((d, i) =>
        `<span>${(i + 1) % labelEvery === 0 ? d.label : ""}</span>`).join("")}
        </div>
      </div>`;

    el.querySelectorAll(".bar").forEach((bar, i) => {
        bar.onclick = () => {
            const off = bar.classList.contains("selected");   // click again to deselect
            el.querySelectorAll(".bar").forEach(b => b.classList.remove("selected"));
            if (!off) bar.classList.add("selected");
            onSelect?.(off ? null : data[i], off ? -1 : i);
            viewLevel2Btn.classList.remove('hidden');

            currentFrameTime = new Date(parseInt(bar.dataset.timestamp));
        };
    });
}

let currentFrameTime = null;
export function getCurrentFrameTime() {
    return currentFrameTime;
}