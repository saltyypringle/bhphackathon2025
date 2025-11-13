// This file is responsible for fetching data from the high_tension.json file and updating the sidebar with information on high tension cables.

document.addEventListener("DOMContentLoaded", function() {
    fetchHighTensionData();
    // poll every 2 seconds for updated hook state
    setInterval(fetchHighTensionData, 2000);
});

// track previous critical count to avoid repeat alerts
let previousCriticalCount = 0;

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
            const hooks = data.hooks || [];
            updateSidebar(hooks);
            updateBerthViews(hooks);
        })
        .catch(error => {
            console.error('There has been a problem with your fetch operation:', error);
            displayFetchError(error);
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

function groupByBerth(hooks) {
    const berths = {};
    hooks.forEach(h => {
        const berth = h.berth_name || 'UNKNOWN_BERTH';
        const bollard = h.bollard_name || 'UNKNOWN_BOLLARD';
        if (!berths[berth]) berths[berth] = {};
        if (!berths[berth][bollard]) berths[berth][bollard] = [];
        berths[berth][bollard].push(h);
    });
    return berths;
}

function tensionColor(tension) {
    // red = tension 20-25 (max tension)
    // yellow = tension 13-20
    // green = tension 0-13
    if (tension === null || tension === undefined || isNaN(Number(tension))) return 'gray';
    const t = Number(tension);
    if (t >= 20) return 'red';
    if (t >= 13) return 'yellow';
    return 'green';
}

function makeToggle(iconEl, bodyEl) {
    iconEl.style.cursor = 'pointer';
    iconEl.onclick = () => {
        bodyEl.classList.toggle('collapsed');
    };
}

function updateBerthViews(hooks) {
    const berths = groupByBerth(hooks);
    // check which berth container r present and render accordingly.
    // if a specific berth page cannot find its berth by exact name, fall back to rendering all berths.
    const b1El = document.getElementById('berth-one-data');
    const b2El = document.getElementById('berth-two-data');

    if (b1El) {
        const pageName = getPageBerthName() || extractBerthFromTitle();
        if (pageName && berths[pageName]) {
            renderBerth(b1El, berths[pageName], pageName);
        } else {
            renderAllBerths(b1El, berths);
        }
    }

    if (b2El) {
        const pageName = getPageBerthName() || extractBerthFromTitle();
        if (pageName && berths[pageName]) {
            renderBerth(b2El, berths[pageName], pageName);
        } else {
            renderAllBerths(b2El, berths);
        }
    }

    // If the index page has a berth list container, populate links to each berth
    const indexList = document.getElementById('berths-list');
    if (indexList) {
        renderIndexBerths(indexList, berths);
    }

    // If a dynamic berth page is present, render that berth based on ?berth= query param
    const berthDataEl = document.getElementById('berth-data');
    const berthTitleEl = document.getElementById('berth-title');
    if (berthDataEl) {
        const qName = getQueryParam('berth') || getPageBerthName() || extractBerthFromTitle();
        if (qName && berths[qName]) {
            if (berthTitleEl) berthTitleEl.textContent = qName;
            renderBerth(berthDataEl, berths[qName], qName);
        } else {
            // show all berths if the specific one isn't available yet
            if (berthTitleEl) berthTitleEl.textContent = qName || 'Berths';
            renderAllBerths(berthDataEl, berths);
        }
    }
}

function getQueryParam(name) {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    } catch (e) {
        return null;
    }
}

function renderIndexBerths(container, berths) {
    container.innerHTML = '';
    const keys = Object.keys(berths).sort();
    if (keys.length === 0) {
        container.innerHTML = '<p>No berths available.</p>';
        return;
    }

    // Build an accessible vertical nav for berths
    const nav = document.createElement('nav');
    nav.className = 'berth-nav';
    nav.setAttribute('aria-label', 'Berths Navigation');

    const ul = document.createElement('ul');
    ul.className = 'berth-nav-list';

    const currentQ = getQueryParam('berth');
    keys.forEach(bname => {
        const li = document.createElement('li');
        li.className = 'berth-nav-item';
        const link = document.createElement('a');
        link.className = 'nav-link';
        link.textContent = bname;
        link.href = `berth.html?berth=${encodeURIComponent(bname)}`;
        link.setAttribute('role', 'link');
        // mark active if it matches current query param
        try {
            if (currentQ && decodeURIComponent(currentQ) === bname) {
                link.classList.add('active');
            }
        } catch (e) {}
        li.appendChild(link);
        ul.appendChild(li);
    });

    nav.appendChild(ul);
    container.appendChild(nav);
}

function renderAllBerths(container, berths) {
    container.innerHTML = '';
    const title = document.createElement('h2');
    title.textContent = 'All Berths';
    container.appendChild(title);

    const keys = Object.keys(berths).sort();
    if (keys.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No berth data available yet.';
        container.appendChild(p);
        return;
    }

    keys.forEach(bname => {
        const wrapper = document.createElement('div');
        wrapper.className = 'berth-summary';
        const header = document.createElement('h3');
        header.textContent = bname;
        wrapper.appendChild(header);
        renderBerth(wrapper, berths[bname], bname);
        container.appendChild(wrapper);
    });
}

function getPageBerthName() {
    const p = location.pathname || '';
    if (p.includes('berth-one')) return 'Berth One';
    if (p.includes('berth-two')) return 'Berth Two';
    const h1 = document.querySelector('main h1');
    if (h1 && h1.textContent.match(/Berth/i)) return h1.textContent.trim();
    return null;
}

function extractBerthFromTitle() {
    const title = document.title || '';
    if (title.toLowerCase().includes('berth two')) return 'Berth Two';
    if (title.toLowerCase().includes('berth one')) return 'Berth One';
    return getPageBerthName();
}

function renderBerth(container, bollardsObj, berthName) {
    if (!container) return;
    container.innerHTML = '';
    const header = document.createElement('h2');
    header.textContent = berthName;

    // compute summary counts
    let critical = 0, attention = 0, normal = 0, total = 0;
    Object.values(bollardsObj).forEach(hooks => {
        hooks.forEach(h => {
            total++;
            if (h.status === 'critical') critical++;
            else if (h.status === 'attention') attention++;
            else normal++;
        });
    });

    const banner = document.createElement('div');
    banner.className = 'summary-banner';
    banner.innerHTML = `<div class="summary-left"><strong>Hooks:</strong> ${total}</div><div class="summary-right"><span class="crit">Critical: ${critical}</span> <span class="att">Attention: ${attention}</span> <span class="norm">Normal: ${normal}</span></div>`;
    if (critical > 0) banner.classList.add('has-critical');

    container.appendChild(header);
    container.appendChild(banner);

    // play alert tone only on 0 -> >0 transition
    if (critical > 0 && previousCriticalCount === 0) {
        playAlertTone();
    }
    previousCriticalCount = critical;

    const tree = document.createElement('div');
    tree.className = 'berth-tree';

    const bollardNames = Object.keys(bollardsObj).sort();
    if (bollardNames.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No bollards detected for this berth.';
        container.appendChild(p);
        return;
    }

    bollardNames.forEach(bName => {
        const hooks = bollardsObj[bName];
        const bollardEl = document.createElement('div');
        bollardEl.className = 'bollard';

        const bollardHeader = document.createElement('div');
        bollardHeader.className = 'bollard-header';
        bollardHeader.innerHTML = `<strong>${bName}</strong> <span class="count">(${hooks.length} hooks)</span>`;

        const hookList = document.createElement('div');
        hookList.className = 'hook-list';

        hooks.forEach(h => {
            const hookEl = document.createElement('div');
            hookEl.className = 'hook-item';
            // prefer server status color, fall back to tension ranges
            const color = h.status ? statusColor(h.status) : tensionColor(h.tension);
            const dot = document.createElement('span');
            dot.className = 'status-dot ' + color;
            const txt = document.createElement('span');
            txt.className = 'hook-text';
            const last = h.last_timestamp ? ` (last: ${h.last_timestamp})` : '';
            txt.textContent = `${h.hook_name} — ${h.tension !== null ? h.tension : 'N/A'}${last}`;
            hookEl.appendChild(dot);
            hookEl.appendChild(txt);
            hookList.appendChild(hookEl);
        });

        bollardEl.appendChild(bollardHeader);
        bollardEl.appendChild(hookList);
        tree.appendChild(bollardEl);

        makeToggle(bollardHeader, hookList);
    });

    container.appendChild(tree);
}

function displayFetchError(err) {
    const side = document.getElementById('tension-info');
    if (side) {
        side.innerHTML = `<p style="color: #ffdddd;">Error fetching data: ${err.message || err}</p>`;
    }
    const b1 = document.getElementById('berth-one-data');
    if (b1) {
        b1.innerHTML = `<p style="color: #ffdddd;">Error fetching data: ${err.message || err}</p>`;
    }
    const b2 = document.getElementById('berth-two-data');
    if (b2) {
        b2.innerHTML = `<p style="color: #ffdddd;">Error fetching data: ${err.message || err}</p>`;
    }
}

function playAlertTone() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        o.connect(g);
        g.connect(ctx.destination);
        // ramp up/down
        g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01);
        o.start();
        setTimeout(() => {
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
            o.stop(ctx.currentTime + 0.06);
            try { ctx.close(); } catch (e) {}
        }, 120);
    } catch (e) {
        console.warn('Audio alert failed', e);
    }
}

function statusColor(status) {
    if (!status) return 'gray';
    if (status === 'critical') return 'red';
    if (status === 'attention') return 'yellow';
    if (status === 'normal') return 'green';
    return 'gray';
}