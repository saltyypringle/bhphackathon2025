document.addEventListener("DOMContentLoaded", function() {
    fetchHighTensionData();
    // Poll every 2 seconds for updated hook state
    setInterval(fetchHighTensionData, 2000);
});

function fetchHighTensionData() {
    fetch('http://127.0.0.1:8000/hooks')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // endpoint returns { hooks: [...] }
            updateSidebar(data.hooks || []);
        })
        .catch(error => {
            console.error('There has been a problem with your fetch operation:', error);
        });
}

function updateSidebar(hooks) {
    const container = document.getElementById('tension-info');
    if (!container) return;
    container.innerHTML = ''; // Clear existing content

    if (!hooks || hooks.length === 0) {
        container.innerHTML = '<p>No hook data available.</p>';
        return;
    }

    hooks.forEach(item => {
        const tensionInfo = document.createElement('div');
        tensionInfo.className = 'tension-info';
        const percent = item.percent !== null && item.percent !== undefined ? `${item.percent}%` : 'N/A';
        const lastTs = (item.history && item.history.length) ? item.history[item.history.length - 1].timestamp : '';
        tensionInfo.innerHTML = `
            <h4>${item.hook_name} <small>(${item.bollard_name})</small></h4>
            <p>Port: ${item.port_name} — Berth: ${item.berth_name}</p>
            <p>Tension: ${item.tension !== null ? item.tension : 'N/A'} / ${item.max_tension} (${percent})</p>
            <p>Status: ${item.faulted ? 'Faulted' : 'Normal'} ${item.attached_line ? '— ' + item.attached_line : ''}</p>
            <p>Rate: ${item.rate}</p>
            ${lastTs ? `<p class="small">Last: ${lastTs}</p>` : ''}
        `;
        container.appendChild(tensionInfo);
    });
}