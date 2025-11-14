// This file is responsible for fetching data from the high_tension.json file and updating the sidebar with information on high tension cables.

document.addEventListener("DOMContentLoaded", function () {
    fetchHighTensionData();
    // poll every 2 seconds for updated hook state
    setInterval(fetchHighTensionData, 2000);
});

// track previous critical count to avoid repeat alerts
let previousCriticalCount = 0;
// debounce buffers to avoid rapid status flicker
// lower threshold to 2 so UI updates faster (about 4s at 2s poll)
const STATUS_BUFFER_THRESHOLD = 2; // number of consecutive polls required
const statusBuffers = {};

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
            const debounced = applyDebounceToHooks(hooks);
            updateSidebar(debounced);
            updateBerthViews(debounced);
            // update summary chart on index page (no-op elsewhere)
            try { renderSummaryChart(debounced); } catch (e) { /* ignore if chart not present */ }
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

    // Build a list of hooks whose computed color is red, compute a numeric
    // tension value (measured or estimated), sort descending, then render.
    const redList = [];
    hooks.forEach(item => {
        try {
            const c = normalizeColorName(getHookColor(item));
            if (c !== 'red') return;

            const rawT = (item.tension === null || item.tension === undefined || isNaN(Number(item.tension))) ? null : Number(item.tension);
            const providedMax = (item.max_tension === undefined || item.max_tension === null || isNaN(Number(item.max_tension))) ? null : Number(item.max_tension);
            // Estimate numeric tension for sorting: prefer rawT, otherwise estimate from percent using same default (100)
            let numeric = 0;
            if (rawT !== null) {
                numeric = rawT;
            } else if (item.percent !== null && item.percent !== undefined && !isNaN(Number(item.percent))) {
                const pct = Number(item.percent);
                const maxT = (providedMax === null) ? 100 : providedMax;
                numeric = (pct / 100) * maxT;
            }

            redList.push({ item, rawT, providedMax, numeric });
        } catch (e) {
            // skip items that error during color computation
        }
    });

    // sort by numeric tension descending
    redList.sort((a, b) => (b.numeric || 0) - (a.numeric || 0));

    // render sorted red items
    redList.forEach(({ item, rawT, providedMax }) => {
        const tensionInfo = document.createElement('div');
        tensionInfo.className = 'tension-info';
        if (item.high_tension > 0) {
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
        }
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

function tensionColor(tension, maxTension) {
    if (tension === null || tension === undefined || isNaN(Number(tension))) return 'gray';
    if (maxTension !== undefined && maxTension !== null && !isNaN(Number(maxTension))) {
        const t = Number(tension);
        const maxT = Number(maxTension) || 10;
        const pct = (maxT > 0) ? (t / maxT) * 100 : 0;
        if (pct >= 80) return 'red';
        if (pct >= 50) return 'yellow';
        return 'green';
    }
    return tensionLevelColor(tension);
}

function tensionLevelColor(tension) {
    // Map absolute tension levels to colors:
    // 0-2 : yellow
    // 2-4 : green
    // 4-6 : yellow
    // 6-9 : red
    // N/A  : grey
    if (tension === null || tension === undefined || isNaN(Number(tension))) return 'gray';
    const t = Number(tension);
    if (t >= 6 && t < 9) return 'red';
    if (t >= 4 && t < 6) return 'yellow';
    if (t >= 2 && t < 4) return 'green';
    if (t >= 0 && t < 2) return 'yellow';
    // Anything >=9 treat as red (very high tension)
    if (t >= 9) return 'red';
    return 'gray';

}

function normalizeColorName(c) {
    if (!c || typeof c !== 'string') return 'gray';
    const s = c.trim().toLowerCase();
    if (s === 'grey') return 'gray';
    if (s === 'red' || s === 'yellow' || s === 'green' || s === 'gray') return s;
    return 'gray';
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
        } catch (e) { }
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
    // If we're on a dedicated berth page the page already has an H1 with the
    // berth name (id="berth-title"). In that case show the port name here
    // instead of repeating the berth name. Otherwise show the berth name.
    const pageTitleEl = document.getElementById('berth-title');
    const portName = (function extractPortName(bollards) {
        for (const bollard of Object.keys(bollards)) {
            const hooks = bollards[bollard] || [];
            for (const h of hooks) {
                if (h && h.port_name) return h.port_name;
            }
        }
        return '';
    })(bollardsObj);

    if (pageTitleEl && pageTitleEl.textContent && pageTitleEl.textContent.trim() === berthName) {
        header.textContent = portName || berthName;
    } else {
        header.textContent = berthName;
    }

    // compute summary counts using the same color logic we render with
    let critical = 0, attention = 0, normal = 0, total = 0;
    Object.values(bollardsObj).forEach(hooks => {
        hooks.forEach(h => {
            total++;
            const col = getHookColor(h);
            const s = colorToStatus(col);
            if (s === 'critical') critical++;
            else if (s === 'attention') attention++;
            else if (s === 'normal') normal++;
            // unknown -> don't increment normal
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
            // prefer server status color; prefer absolute tension when available,
            // fall back to estimating via percent+max_tension, then percent thresholds, then grey.
            let color;
            // Use centralized helper so rendering matches summary counts and
            // N/A (no tension & no percent) is forced to gray even if server status exists.
            color = getHookColor(h);
            const dot = document.createElement('span');
            const norm = normalizeColorName(color);
            dot.classList.add('status-dot', norm);
            if (norm === 'gray') dot.classList.add('grey');
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
            try { ctx.close(); } catch (e) { }
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

function getHookKey(h) {
    return `${h.berth_name}::${h.bollard_name}::${h.hook_name}`;
}

function applyDebounceToHooks(hooks) {
    // Return a shallow copy of hooks where each hook gets a `debounced_status` property
    return hooks.map(h => {
        const observed = h.status || (() => {
            // fallback: compute from percent if server didn't provide status
            const p = (h.percent === null || h.percent === undefined) ? null : Number(h.percent);
            if (p === null) return 'normal';
            // match server thresholds: attention >=50%, critical >=80%
            if (p >= 80) return 'critical';
            if (p >= 50) return 'attention';
            return 'normal';
        })();

        const key = getHookKey(h);
        if (!statusBuffers[key]) {
            // initialize buffer for this hook
            statusBuffers[key] = { last: observed, count: 1, stable: observed };
        } else {
            const buf = statusBuffers[key];
            if (buf.last === observed) {
                buf.count = Math.min(buf.count + 1, STATUS_BUFFER_THRESHOLD);
            } else {
                buf.last = observed;
                buf.count = 1;
            }

            // If the stable value already equals observed, nothing to do
            if (buf.stable === observed) {
                // noop
            } else {
                // Only apply buffering when the previous stable color was attention/yellow or critical/red.
                // If previous stable was 'normal' (green) OR the observed is 'normal', apply immediately.
                // This makes transitions from green -> yellow/red immediate (so values like 7 show up right away),
                // while still buffering changes that flip between yellow <-> red to reduce flicker.
                const prevStable = buf.stable;
                const obs = observed;
                const prevWasAlert = (prevStable === 'attention' || prevStable === 'critical');
                const obsIsAlert = (obs === 'attention' || obs === 'critical');

                if (!prevWasAlert || !obsIsAlert) {
                    // Either coming from green, or moving to green: apply immediately
                    buf.stable = observed;
                } else {
                    // Both previous and observed are alert states (yellow/red) -> respect buffer
                    if (buf.count >= STATUS_BUFFER_THRESHOLD) {
                        buf.stable = observed;
                    }
                }
            }
        }

        // attach debounced status to a shallow copy so we don't mutate upstream data
        return Object.assign({}, h, { debounced_status: statusBuffers[key].stable });
    });
}

function getHookColor(h) {
    // If neither a valid tension nor percent is available, treat as N/A -> gray
    const hasT = !(h.tension === null || h.tension === undefined || isNaN(Number(h.tension)));
    const hasP = !(h.percent === null || h.percent === undefined || isNaN(Number(h.percent)));
    if (!hasT && !hasP) return 'gray';

    // Prefer absolute tension when present
    if (hasT) return tensionLevelColor(Number(h.tension));

    // Otherwise try percent-based estimate
    if (hasP) {
        const p = Number(h.percent);
        const maxT = (h.max_tension === undefined || h.max_tension === null || isNaN(Number(h.max_tension))) ? null : Number(h.max_tension);
        if (maxT !== null) {
            const estT = (p / 100) * maxT;
            return tensionLevelColor(estT);
        }
        // No max_tension: fall back to percent thresholds
        if (p >= 80) return 'red';
        if (p >= 50) return 'yellow';
        return 'green';
    }

    // Last resort: server-provided status
    const st = h.debounced_status || h.status;
    if (st) return statusColor(st);

    return 'gray';
}

function colorToStatus(color) {
    const c = (color || '').toLowerCase();
    if (c === 'red') return 'critical';
    if (c === 'yellow') return 'attention';
    if (c === 'green') return 'normal';
    return 'unknown';
}

// Chart instance for the index summary pie
let summaryChart = null;

function renderSummaryChart(hooks) {
    if (!Array.isArray(hooks)) return;

    // compute counts
    let critical = 0, attention = 0, normal = 0, unknown = 0;
    hooks.forEach(h => {
        const col = getHookColor(h);
        const stat = colorToStatus(col);
        if (stat === 'critical') critical++;
        else if (stat === 'attention') attention++;
        else if (stat === 'normal') normal++;
        else unknown++;
    });

    const total = critical + attention + normal + unknown || 1;
    const data = [critical, attention, normal, unknown];

    const ctxEl = document.getElementById('status-pie');
    if (!ctxEl) return; // only render on pages that have the canvas

    const labels = ['Critical', 'Attention', 'Normal', 'N/A'];
    const bg = ['#d9534f', '#f0ad4e', '#2ecc71', '#888'];

    if (!summaryChart) {
        // create chart
        try {
            summaryChart = new Chart(ctxEl.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{ data: data, backgroundColor: bg }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: { callbacks: { label: function(tooltipItem) {
                            const v = tooltipItem.dataset.data[tooltipItem.dataIndex] || 0;
                            const pct = ((v / total) * 100).toFixed(1);
                            return `${tooltipItem.label}: ${v} (${pct}%)`;
                        } } }
                    }
                }
            });
        } catch (e) {
            console.warn('Chart creation failed', e);
            return;
        }
    } else {
        summaryChart.data.datasets[0].data = data;
        summaryChart.update();
    }
}