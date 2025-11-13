// This file is responsible for fetching data from the high_tension.json file and updating the sidebar with information on high tension cables.

document.addEventListener("DOMContentLoaded", function() {
    fetchHighTensionData();
});

function fetchHighTensionData() {
    fetch('../data/high_tension.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            updateSidebar(data);
        })
        .catch(error => {
            console.error('There has been a problem with your fetch operation:', error);
        });
}

function updateSidebar(data) {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = ''; // Clear existing content

    data.forEach(item => {
        const tensionInfo = document.createElement('div');
        tensionInfo.className = 'tension-info';
        tensionInfo.innerHTML = `
            <h4>${item.hook_name}</h4>
            <p>Tension: ${item.tension} (Max: ${item.max_tension})</p>
            <p>Status: ${item.faulted ? 'Faulted' : 'Normal'}</p>
        `;
        sidebar.appendChild(tensionInfo);
    });
}