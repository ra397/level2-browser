import './loading-screen.css';

const loadingScreen = document.createElement('div');
loadingScreen.className = 'loading-screen hidden';
loadingScreen.innerHTML = '<div class="loading-spinner"></div>';
document.body.appendChild(loadingScreen);

window.showLoadingScreen = function() {
    loadingScreen.classList.remove('hidden');
};

window.hideLoadingScreen = function() {
    loadingScreen.classList.add('hidden');
};