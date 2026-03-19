import './settings.css';

let currentTimezone = 'local';

const settingsMenu = document.getElementById('settings-menu');

if (settingsMenu) {
    settingsMenu.addEventListener('change', (e) => {
        if (e.target.name === 'timezone') {
            currentTimezone = e.target.value;
            document.dispatchEvent(new CustomEvent('timezone-change', {
                detail: { timezone: currentTimezone }
            }));
        }
    });
}

export function getTimezone() {
    return currentTimezone;
}