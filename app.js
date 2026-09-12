// Initialize MapLibre GL JS Map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', // Clean, high-performance base style
  center: [-71.3824, 42.4072], // Massachusetts Center
  zoom: 8
});

let isPlaying = false;
let playInterval = null;

map.on('load', () => {
  // Add GeoJSON data source
  map.addSource('ma-towns', {
    type: 'geojson',
    data: './data/ma_towns.geojson' // Relative path for GitHub Pages
  });

  // Base Polygon Fill Layer
  map.addLayer({
    id: 'towns-base',
    type: 'fill',
    source: 'ma-towns',
    paint: {
      'fill-color': '#339af0',
      'fill-opacity': 0.4,
      'fill-outline-color': '#1c7ed6'
    },
    filter: ['all', ['<=', ['get', 'start_year'], 1620], ['>', ['get', 'end_year'], 1620]]
  });

  // Highlight Layer (Triggered on hover)
  map.addLayer({
    id: 'towns-highlight',
    type: 'fill',
    source: 'ma-towns',
    paint: {
      'fill-color': '#fab005',
      'fill-opacity': 0.85,
      'fill-outline-color': '#e67700'
    },
    filter: ['==', ['get', 'town_id'], '']
  });

  setupEventListeners();
});

function setupEventListeners() {
  const slider = document.getElementById('year-slider');
  const yearDisplay = document.getElementById('year-display');
  const playBtn = document.getElementById('play-btn');

  // Slider change event
  slider.addEventListener('input', (e) => {
    const year = parseInt(e.target.value, 10);
    updateYear(year);
  });

  // Play / Pause toggle
  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });

  // Sidebar Hover -> Highlight Map Polygon
  document.querySelectorAll('.town-item').forEach(item => {
    item.addEventListener('mouseenter', (e) => {
      const townId = e.currentTarget.dataset.townId;
      map.setFilter('towns-highlight', ['==', ['get', 'town_id'], townId]);
    });

    item.addEventListener('mouseleave', () => {
      map.setFilter('towns-highlight', ['==', ['get', 'town_id'], '']);
    });
  });

  // Map Hover -> Highlight Sidebar Text
  map.on('mousemove', 'towns-base', (e) => {
    if (e.features.length > 0) {
      const hoveredTownId = e.features[0].properties.town_id;
      map.setFilter('towns-highlight', ['==', ['get', 'town_id'], hoveredTownId]);

      document.querySelectorAll('.town-item').forEach(el => el.classList.remove('active-hover'));
      const activeSidebarItem = document.querySelector(`.town-item[data-town-id="${hoveredTownId}"]`);
      if (activeSidebarItem) {
        activeSidebarItem.classList.add('active-hover');
      }
    }
  });

  map.on('mouseleave', 'towns-base', () => {
    map.setFilter('towns-highlight', ['==', ['get', 'town_id'], '']);
    document.querySelectorAll('.town-item').forEach(el => el.classList.remove('active-hover'));
  });
}

function updateYear(year) {
  document.getElementById('year-display').textContent = year;

  // Filter map shapes based on year
  if (map.getLayer('towns-base')) {
    map.setFilter('towns-base', [
      'all',
      ['<=', ['get', 'start_year'], year],
      ['>', ['get', 'end_year'], year]
    ]);
  }

  // Clear hover state
  map.setFilter('towns-highlight', ['==', ['get', 'town_id'], '']);

  // Sync accordion
  syncAccordion(year);
}

function syncAccordion(year) {
  const blocks = document.querySelectorAll('.year-block');
  let targetBlock = document.getElementById(`year-${year}`);

  blocks.forEach(b => b.removeAttribute('open'));

  if (targetBlock) {
    targetBlock.setAttribute('open', 'true');
    targetBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function startPlayback() {
  isPlaying = true;
  document.getElementById('play-btn').textContent = 'Pause';
  const slider = document.getElementById('year-slider');

  playInterval = setInterval(() => {
    let current = parseInt(slider.value, 10);
    if (current >= 1920) {
      stopPlayback();
    } else {
      current++;
      slider.value = current;
      updateYear(current);
    }
  }, 300);
}

function stopPlayback() {
  isPlaying = false;
  document.getElementById('play-btn').textContent = 'Play';
  clearInterval(playInterval);
}