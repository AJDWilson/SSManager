const STORAGE_KEY = 'yards_v1';
const ACTIVE_KEY = 'yards_active_id_v1';
const containerDepthFt = 8;

/** @type {const} */
const containerTypes = [
  { type: '5ft', widthFt: 5, color: '#8ecae6' },
  { type: '10ft', widthFt: 10, color: '#a3bffa' },
  { type: '20ft', widthFt: 20, color: '#facc15' },
  { type: '40ft', widthFt: 40, color: '#f87171' },
  { type: '50ft', widthFt: 50, color: '#c084fc' },
];

const ftToUnitFactor = {
  ft: 1,
  m: 0.3048,
  cm: 30.48,
};

const state = {
  yards: [],
  activeYardId: null,
  snapEnabled: true,
  scale: 1,
};

let selectedContainerId = null;
let currentDrag = null;
let hintTimeout = null;

const els = {
  yardList: document.getElementById('yardList'),
  newYardBtn: document.getElementById('newYardBtn'),
  renameYardBtn: document.getElementById('renameYardBtn'),
  duplicateYardBtn: document.getElementById('duplicateYardBtn'),
  deleteYardBtn: document.getElementById('deleteYardBtn'),
  paletteItems: document.getElementById('paletteItems'),
  legendList: document.getElementById('legendList'),
  snapToggle: document.getElementById('snapToggle'),
  yardSummary: document.getElementById('yardSummary'),
  scaleInfo: document.getElementById('scaleInfo'),
  hint: document.getElementById('hint'),
  yardSvg: document.getElementById('yardSvg'),
  emptyState: document.getElementById('emptyState'),
  yardWrapper: document.getElementById('yardWrapper'),
  yardModal: document.getElementById('yardModal'),
  yardForm: document.getElementById('yardForm'),
  yardNameInput: document.getElementById('yardNameInput'),
  yardWidthInput: document.getElementById('yardWidthInput'),
  yardHeightInput: document.getElementById('yardHeightInput'),
  yardUnitSelect: document.getElementById('yardUnitSelect'),
  yardModalClose: document.getElementById('yardModalClose'),
  yardModalCancel: document.getElementById('yardModalCancel'),
  detailPlaceholder: document.getElementById('detailPlaceholder'),
  containerForm: document.getElementById('containerForm'),
  detailTitle: document.getElementById('detailTitle'),
  detailRenter: document.getElementById('detailRenter'),
  detailRate: document.getElementById('detailRate'),
  detailPhone: document.getElementById('detailPhone'),
};
const createYardTriggers = Array.from(document.querySelectorAll('[data-trigger="create-yard"]'));

init();

function init() {
  loadState();
  renderPalette();
  renderLegend();
  attachEventListeners();
  renderAll();
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        state.yards = parsed.map(upgradeYard).filter(Boolean);
      }
    }
    const activeId = localStorage.getItem(ACTIVE_KEY);
    if (activeId) {
      state.activeYardId = activeId;
    }
  } catch (err) {
    console.warn('Failed to load yards from storage', err);
    state.yards = [];
    state.activeYardId = null;
  }
  if (!state.activeYardId && state.yards.length > 0) {
    state.activeYardId = state.yards[0].id;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.yards));
  if (state.activeYardId) {
    localStorage.setItem(ACTIVE_KEY, state.activeYardId);
  }
}

function upgradeYard(yard) {
  if (!yard || typeof yard !== 'object') {
    return null;
  }
  const width = Number(yard.width);
  const height = Number(yard.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const safeUnit = ['ft', 'm', 'cm'].includes(yard.unit) ? yard.unit : 'ft';
  const name = typeof yard.name === 'string' && yard.name.trim() ? yard.name.trim() : 'Untitled Yard';
  return {
    ...yard,
    name,
    width: Number(width.toFixed(3)),
    height: Number(height.toFixed(3)),
    unit: safeUnit,
    containers: Array.isArray(yard.containers)
      ? yard.containers.map(upgradeContainer).filter(Boolean)
      : [],
  };
}

function upgradeContainer(container) {
  if (!container || typeof container !== 'object') {
    return null;
  }
  const widthFt = Number(container.widthFt) || Number(container.width) || 10;
  const baseLabel =
    typeof container.label === 'string' && container.label.trim()
      ? container.label.trim()
      : `${widthFt}`;
  return {
    id: container.id || generateId(),
    type: container.type || `${widthFt}ft`,
    widthFt,
    x: Number.isFinite(container.x) ? container.x : 0,
    y: Number.isFinite(container.y) ? container.y : 0,
    rotation: container.rotation === 90 ? 90 : 0,
    label: baseLabel,
    renter: container.renter ? String(container.renter) : '',
    monthlyRate: container.monthlyRate ? String(container.monthlyRate) : '',
    phone: container.phone ? String(container.phone) : '',
  };
}

function attachEventListeners() {
  els.newYardBtn.addEventListener('click', openYardModal);
  createYardTriggers.forEach((button) => button.addEventListener('click', openYardModal));
  els.renameYardBtn.addEventListener('click', handleRenameYard);
  els.duplicateYardBtn.addEventListener('click', handleDuplicateYard);
  els.deleteYardBtn.addEventListener('click', handleDeleteYard);
  els.snapToggle.addEventListener('change', () => {
    state.snapEnabled = els.snapToggle.checked;
    renderScaleInfo();
  });

  els.yardSvg.addEventListener('pointerdown', (event) => {
    if (event.target === els.yardSvg) {
      selectContainer(null);
    }
  });

  els.yardSvg.addEventListener('pointermove', handlePointerMove);
  els.yardSvg.addEventListener('pointerup', handlePointerUp);
  els.yardSvg.addEventListener('pointercancel', handlePointerUp);

  document.addEventListener('pointermove', handleGlobalPointerMove);
  document.addEventListener('pointerup', handleGlobalPointerUp);
  document.addEventListener('keydown', handleGlobalKeyDown);
  window.addEventListener('resize', () => renderActiveYard());

  els.yardForm.addEventListener('submit', handleYardFormSubmit);
  els.yardModalClose.addEventListener('click', closeYardModal);
  els.yardModalCancel.addEventListener('click', closeYardModal);
  els.yardModal.addEventListener('click', (event) => {
    if (event.target === els.yardModal) {
      closeYardModal();
    }
  });

  els.containerForm.addEventListener('input', handleDetailInput);
  els.containerForm.addEventListener('submit', (event) => event.preventDefault());
}

function renderAll() {
  renderYardList();
  renderActiveYard();
  renderScaleInfo();
  updateDetailPanel();
}

function renderPalette() {
  els.paletteItems.innerHTML = '';
  containerTypes.forEach((type) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'palette-item';
    item.dataset.type = type.type;
    item.innerHTML = `
      <span>${type.widthFt} ft container</span>
      <span class="swatch" style="background:${type.color}"></span>
    `;
    item.addEventListener('pointerdown', (event) => startPaletteDrag(event, type));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        startPaletteDragFromKeyboard(type);
      }
    });
    els.paletteItems.appendChild(item);
  });
}

function renderLegend() {
  els.legendList.innerHTML = '';
  containerTypes.forEach((type) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="swatch" style="background:${type.color}"></span>
      <span>${type.widthFt} ft container</span>
    `;
    els.legendList.appendChild(li);
  });
}

function renderYardList() {
  els.yardList.innerHTML = '';
  state.yards.forEach((yard) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = `${yard.name}`;
    button.classList.toggle('active', yard.id === state.activeYardId);
    button.addEventListener('click', () => {
      state.activeYardId = yard.id;
      saveState();
      renderAll();
    });
    li.appendChild(button);
    els.yardList.appendChild(li);
  });
}

function renderActiveYard() {
  const yard = getActiveYard();
  const previouslySelected = selectedContainerId;
  els.yardSvg.innerHTML = '';

  if (!yard) {
    els.yardSvg.setAttribute('width', '100%');
    els.yardSvg.setAttribute('height', '100%');
    els.emptyState.hidden = false;
    els.yardSummary.textContent = '';
    selectContainer(null);
    return;
  }

  els.emptyState.hidden = true;
  const available = els.yardWrapper.getBoundingClientRect();
  const padding = 32;
  const availableWidth = Math.max(available.width - padding, 200);
  const availableHeight = Math.max(available.height - padding, 200);
  const scaleCandidate = Math.min(
    availableWidth / yard.width,
    availableHeight / yard.height
  );
  const minScale = 8 / convertFtToUnit(1, yard.unit);
  const scale = Math.max(scaleCandidate, minScale);
  state.scale = scale;

  els.yardSvg.setAttribute('viewBox', `0 0 ${yard.width} ${yard.height}`);
  els.yardSvg.setAttribute('width', yard.width * scale);
  els.yardSvg.setAttribute('height', yard.height * scale);

  renderGrid(yard);
  renderContainers(yard);
  if (
    previouslySelected &&
    yard.containers.some((container) => container.id === previouslySelected)
  ) {
    selectContainer(previouslySelected);
  } else {
    selectContainer(null);
  }
  els.yardSummary.textContent = `${yard.name} — ${yard.width} × ${yard.height} ${yard.unit}`;
}

function renderGrid(yard) {
  const gridSize = gridUnit(yard.unit);
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
  pattern.setAttribute('id', 'grid-pattern');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('width', gridSize);
  pattern.setAttribute('height', gridSize);

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', gridSize);
  rect.setAttribute('height', gridSize);
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', '#cbd5e1');
  rect.setAttribute('stroke-width', 0.03);

  pattern.appendChild(rect);
  defs.appendChild(pattern);
  els.yardSvg.appendChild(defs);

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', yard.width);
  background.setAttribute('height', yard.height);
  background.setAttribute('fill', 'url(#grid-pattern)');
  background.setAttribute('stroke', '#94a3b8');
  background.setAttribute('stroke-width', 0.1);
  els.yardSvg.appendChild(background);
}

function renderContainers(yard) {
  yard.containers.forEach((container) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('container-group');
    group.dataset.id = container.id;
    group.dataset.type = container.type;
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${container.label} container`);

    const dims = getContainerDimensions(yard, container);
    const palette = containerTypes.find((type) => type.type === container.type);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('container-rect');
    rect.setAttribute('width', dims.width);
    rect.setAttribute('height', dims.height);
    rect.setAttribute('rx', 0.2);
    rect.setAttribute('ry', 0.2);
    rect.setAttribute('fill', palette?.color || '#cbd5f5');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('container-label');
    text.setAttribute('x', dims.width / 2);
    text.setAttribute('y', dims.height / 2);
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('text-anchor', 'middle');
    const labelText = container.label && String(container.label).trim() ? String(container.label).trim() : `${container.widthFt}`;
    text.textContent = labelText;

    group.appendChild(rect);
    group.appendChild(text);
    setContainerTransform(group, container.x, container.y);

    group.addEventListener('pointerdown', (event) => handleContainerPointerDown(event, container.id));
    group.addEventListener('focus', () => selectContainer(container.id));
    group.addEventListener('blur', () => {
      if (selectedContainerId === container.id) {
        selectContainer(null);
      }
    });

    els.yardSvg.appendChild(group);
  });
}

function renderScaleInfo() {
  const yard = getActiveYard();
  if (!yard) {
    els.scaleInfo.textContent = '';
    return;
  }
  const unitStep = gridUnit(yard.unit);
  const gridLabel = formatNumber(unitStep);
  els.scaleInfo.textContent = `Scale: 1 grid ≈ ${gridLabel} ${yard.unit} (${state.snapEnabled ? 'snap on' : 'snap off'})`;
  els.snapToggle.checked = state.snapEnabled;
}

function startPaletteDrag(event, type) {
  event.preventDefault();
  const pointerId = event.pointerId;
  currentDrag = {
    mode: 'palette',
    pointerId,
    type,
    ghost: createGhost(type),
  };
  document.body.appendChild(currentDrag.ghost);
  updateGhostPosition(event);
  document.addEventListener('pointermove', updateGhostPosition);
}

function startPaletteDragFromKeyboard(type) {
  const yard = getActiveYard();
  if (!yard) {
    showHint('Create a yard before placing containers.');
    return;
  }
  const container = createContainerFromType(yard, type);
  container.x = 0;
  container.y = 0;
  if (!isCollision(yard, container, container.id)) {
    yard.containers.push(container);
    saveState();
    selectedContainerId = container.id;
    renderActiveYard();
  } else {
    showHint('No free space at the origin. Move existing containers.');
  }
}

function updateGhostPosition(event) {
  if (!currentDrag || currentDrag.mode !== 'palette') return;
  const ghost = currentDrag.ghost;
  ghost.style.left = `${event.clientX + 12}px`;
  ghost.style.top = `${event.clientY + 12}px`;
}

function handleGlobalPointerMove(event) {
  if (currentDrag && currentDrag.mode === 'palette' && event.pointerId === currentDrag.pointerId) {
    updateGhostPosition(event);
  }
}

function handleGlobalPointerUp(event) {
  if (!currentDrag) return;
  if (currentDrag.mode === 'palette' && event.pointerId === currentDrag.pointerId) {
    finishPaletteDrag(event);
  }
}

function finishPaletteDrag(event) {
  document.removeEventListener('pointermove', updateGhostPosition);
  if (currentDrag?.ghost) {
    currentDrag.ghost.remove();
  }
  const yard = getActiveYard();
  if (!yard) {
    showHint('Create a yard before placing containers.');
    currentDrag = null;
    return;
  }
  const rect = els.yardSvg.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    currentDrag = null;
    return;
  }

  const pointer = yardPointerToUnits(event);
  const container = createContainerFromType(yard, currentDrag.type);
  const dims = getContainerDimensions(yard, container);
  let x = pointer.x - dims.width / 2;
  let y = pointer.y - dims.height / 2;

  if (state.snapEnabled) {
    x = snapValue(x, yard.unit);
    y = snapValue(y, yard.unit);
  }

  const clamped = clampToBounds({ x, y }, dims.width, dims.height, yard);
  container.x = clamped.x;
  container.y = clamped.y;

  if (isCollision(yard, container, container.id)) {
    if (state.snapEnabled) {
      const fallback = findNearestSpot(yard, container, dims.width, dims.height);
      if (fallback) {
        container.x = fallback.x;
        container.y = fallback.y;
      } else {
        showHint('No free space available here.');
        currentDrag = null;
        return;
      }
    } else {
      showHint('Containers cannot overlap.');
      currentDrag = null;
      return;
    }
  }

  yard.containers.push(container);
  saveState();
  selectedContainerId = container.id;
  renderActiveYard();
  currentDrag = null;
}

function handleContainerPointerDown(event, containerId) {
  event.preventDefault();
  event.stopPropagation();
  const yard = getActiveYard();
  if (!yard) return;
  const container = yard.containers.find((c) => c.id === containerId);
  if (!container) return;
  selectContainer(containerId);
  const dims = getContainerDimensions(yard, container);
  const pointer = yardPointerToUnits(event);
  const offsetX = pointer.x - container.x;
  const offsetY = pointer.y - container.y;
  const group = event.currentTarget;
  group.classList.add('dragging');

  currentDrag = {
    mode: 'move',
    pointerId: event.pointerId,
    containerId,
    offsetX,
    offsetY,
    element: group,
    width: dims.width,
    height: dims.height,
    lastValid: { x: container.x, y: container.y },
    valid: true,
  };
  group.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!currentDrag || currentDrag.mode !== 'move') return;
  if (event.pointerId !== currentDrag.pointerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const base = getContainerById(yard, currentDrag.containerId);
  if (!base) return;
  const pointer = yardPointerToUnits(event);
  let x = pointer.x - currentDrag.offsetX;
  let y = pointer.y - currentDrag.offsetY;
  if (state.snapEnabled) {
    x = snapValue(x, yard.unit);
    y = snapValue(y, yard.unit);
  }
  const clamped = clampToBounds({ x, y }, currentDrag.width, currentDrag.height, yard);
  const candidate = {
    id: currentDrag.containerId,
    widthFt: base.widthFt,
    rotation: base.rotation,
    x: clamped.x,
    y: clamped.y,
  };
  const collides = isCollision(yard, candidate, currentDrag.containerId);
  currentDrag.valid = !collides;
  if (!collides) {
    currentDrag.lastValid = { x: clamped.x, y: clamped.y };
    currentDrag.element.classList.remove('invalid');
  } else {
    currentDrag.element.classList.add('invalid');
  }
  setContainerTransform(currentDrag.element, clamped.x, clamped.y);
}

function handlePointerUp(event) {
  if (!currentDrag || currentDrag.mode !== 'move') return;
  if (event.pointerId !== currentDrag.pointerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const container = getContainerById(yard, currentDrag.containerId);
  currentDrag.element.classList.remove('dragging');
  currentDrag.element.classList.remove('invalid');
  currentDrag.element.releasePointerCapture(event.pointerId);

  if (currentDrag.valid) {
    container.x = currentDrag.lastValid.x;
    container.y = currentDrag.lastValid.y;
    saveState();
    renderActiveYard();
  } else {
    showHint('Placement blocked by another container.');
    renderActiveYard();
  }
  currentDrag = null;
}

function handleKeyDown(event) {
  const target = event.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
    return;
  }
  const yard = getActiveYard();
  if (!yard || !selectedContainerId) return;
  const container = getContainerById(yard, selectedContainerId);
  if (!container) return;
  const step = gridUnit(yard.unit);
  let handled = false;
  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      removeSelectedContainer();
      handled = true;
      break;
    case 'ArrowUp':
      attemptMove(container, 0, -step, yard);
      handled = true;
      break;
    case 'ArrowDown':
      attemptMove(container, 0, step, yard);
      handled = true;
      break;
    case 'ArrowLeft':
      attemptMove(container, -step, 0, yard);
      handled = true;
      break;
    case 'ArrowRight':
      attemptMove(container, step, 0, yard);
      handled = true;
      break;
    case 'r':
    case 'R':
      attemptRotate(container, yard);
      handled = true;
      break;
    default:
      break;
  }
  if (handled) {
    event.preventDefault();
  }
}

function attemptMove(container, dx, dy, yard) {
  const dims = getContainerDimensions(yard, container);
  const target = {
    x: container.x + dx,
    y: container.y + dy,
  };
  const clamped = clampToBounds(target, dims.width, dims.height, yard);
  const candidate = { ...container, ...clamped };
  if (!isCollision(yard, candidate, container.id)) {
    container.x = clamped.x;
    container.y = clamped.y;
    saveState();
    renderActiveYard();
  } else {
    showHint('Movement blocked by collision or bounds.');
  }
}

function attemptRotate(container, yard) {
  const previousRotation = container.rotation;
  const nextRotation = previousRotation === 90 ? 0 : 90;
  container.rotation = nextRotation;
  const dims = getContainerDimensions(yard, container);
  const clamped = clampToBounds({ x: container.x, y: container.y }, dims.width, dims.height, yard);
  const candidate = { ...container, ...clamped };
  if (!isCollision(yard, candidate, container.id)) {
    container.x = clamped.x;
    container.y = clamped.y;
    saveState();
    renderActiveYard();
  } else {
    container.rotation = previousRotation;
    showHint('Rotation blocked by bounds or collision.');
    renderActiveYard();
  }
}

function removeSelectedContainer() {
  const yard = getActiveYard();
  if (!yard || !selectedContainerId) return;
  const idx = yard.containers.findIndex((c) => c.id === selectedContainerId);
  if (idx >= 0) {
    yard.containers.splice(idx, 1);
    saveState();
    renderActiveYard();
    showHint('Container removed.');
  }
}

function startYard(name, width, height, unit) {
  const yard = {
    id: generateId(),
    name,
    width,
    height,
    unit,
    containers: [],
  };
  state.yards.push(yard);
  state.activeYardId = yard.id;
  saveState();
  renderAll();
}

function handleCreateYard() {
  openYardModal();
}

function handleRenameYard() {
  const yard = getActiveYard();
  if (!yard) return;
  const name = prompt('Rename yard', yard.name);
  if (!name) return;
  yard.name = name.trim();
  saveState();
  renderAll();
}

function handleDuplicateYard() {
  const yard = getActiveYard();
  if (!yard) return;
  const clone = JSON.parse(JSON.stringify(yard));
  clone.id = generateId();
  clone.name = `${yard.name} Copy`;
  clone.containers = clone.containers.map((container) => ({
    ...container,
    id: generateId(),
  }));
  state.yards.push(clone);
  state.activeYardId = clone.id;
  saveState();
  renderAll();
}

function handleDeleteYard() {
  const yard = getActiveYard();
  if (!yard) return;
  if (!confirm(`Delete yard "${yard.name}"?`)) return;
  state.yards = state.yards.filter((y) => y.id !== yard.id);
  if (state.activeYardId === yard.id) {
    state.activeYardId = state.yards[0]?.id || null;
  }
  saveState();
  renderAll();
}

function openYardModal() {
  const template = getActiveYard();
  els.yardForm.reset();
  const defaultName = `Yard ${state.yards.length + 1}`;
  els.yardNameInput.value = defaultName;
  const widthValue = template ? template.width : 100;
  const heightValue = template ? template.height : 60;
  const unitValue = template ? template.unit : 'ft';
  els.yardWidthInput.value = widthValue;
  els.yardHeightInput.value = heightValue;
  els.yardUnitSelect.value = ['ft', 'm', 'cm'].includes(unitValue) ? unitValue : 'ft';
  els.yardModal.hidden = false;
  window.setTimeout(() => {
    els.yardNameInput.focus();
    els.yardNameInput.select();
  }, 0);
}

function closeYardModal() {
  if (els.yardModal.hidden) return;
  els.yardModal.hidden = true;
}

function isModalOpen() {
  return !els.yardModal.hidden;
}

function handleYardFormSubmit(event) {
  event.preventDefault();
  const name = els.yardNameInput.value.trim();
  const width = parseFloat(els.yardWidthInput.value);
  const height = parseFloat(els.yardHeightInput.value);
  const unit = els.yardUnitSelect.value;
  if (!name) {
    showHint('Please enter a yard name.');
    els.yardNameInput.focus();
    return;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    showHint('Width and height must be positive numbers.');
    els.yardWidthInput.focus();
    return;
  }
  if (!['ft', 'm', 'cm'].includes(unit)) {
    showHint('Units must be ft, m, or cm.');
    els.yardUnitSelect.focus();
    return;
  }
  closeYardModal();
  startYard(name, Number(width.toFixed(3)), Number(height.toFixed(3)), unit);
  els.yardForm.reset();
}

function updateDetailPanel() {
  const yard = getActiveYard();
  if (!yard) {
    els.containerForm.hidden = true;
    setDetailFormDisabled(true);
    els.containerForm.reset();
    delete els.containerForm.dataset.containerId;
    els.detailPlaceholder.hidden = false;
    els.detailPlaceholder.innerHTML = '<p>Create a yard to edit container details.</p>';
    return;
  }
  const container = selectedContainerId ? getContainerById(yard, selectedContainerId) : null;
  if (!container) {
    els.containerForm.hidden = true;
    setDetailFormDisabled(true);
    els.containerForm.reset();
    delete els.containerForm.dataset.containerId;
    els.detailPlaceholder.hidden = false;
    els.detailPlaceholder.innerHTML = '<p>Select a container to edit its info.</p>';
    return;
  }
  els.detailPlaceholder.hidden = true;
  els.containerForm.hidden = false;
  setDetailFormDisabled(false);
  els.containerForm.dataset.containerId = container.id;
  els.detailTitle.value = container.label ?? '';
  els.detailTitle.placeholder = `${container.widthFt}`;
  els.detailRenter.value = container.renter || '';
  els.detailRate.value = container.monthlyRate || '';
  els.detailPhone.value = container.phone || '';
}

function setDetailFormDisabled(disabled) {
  Array.from(els.containerForm.elements).forEach((element) => {
    element.disabled = disabled;
  });
}

function handleDetailInput(event) {
  if (!selectedContainerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const container = getContainerById(yard, selectedContainerId);
  if (!container) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const { name, value } = target;
  switch (name) {
    case 'label':
      container.label = value;
      updateContainerLabelDisplay(container);
      break;
    case 'renter':
      container.renter = value;
      break;
    case 'monthlyRate':
      container.monthlyRate = value;
      break;
    case 'phone':
      container.phone = value;
      break;
    default:
      break;
  }
  saveState();
}

function updateContainerLabelDisplay(container) {
  const group = els.yardSvg.querySelector(`.container-group[data-id="${container.id}"]`);
  if (!group) return;
  const text = group.querySelector('.container-label');
  const labelText = container.label && container.label.trim() ? container.label.trim() : `${container.widthFt}`;
  if (text) {
    text.textContent = labelText;
  }
  group.setAttribute('aria-label', `${labelText} container`);
}

function handleGlobalKeyDown(event) {
  if (isModalOpen()) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeYardModal();
    }
    return;
  }
  if (event.key === 'Escape' && selectedContainerId) {
    event.preventDefault();
    selectContainer(null);
    return;
  }
  handleKeyDown(event);
}



function selectContainer(containerId) {
  selectedContainerId = containerId;
  Array.from(els.yardSvg.querySelectorAll('.container-group')).forEach((group) => {
    group.classList.toggle('selected', group.dataset.id === containerId);
  });
  updateDetailPanel();
}

function getActiveYard() {
  if (!state.activeYardId) return null;
  return state.yards.find((yard) => yard.id === state.activeYardId) || null;
}

function createContainerFromType(yard, type) {
  return {
    id: generateId(),
    type: type.type,
    widthFt: type.widthFt,
    x: 0,
    y: 0,
    rotation: 0,
    label: `${type.widthFt}`,
    renter: '',
    monthlyRate: '',
    phone: '',
  };
}

function yardPointerToUnits(event) {
  const rect = els.yardSvg.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / state.scale,
    y: (event.clientY - rect.top) / state.scale,
  };
}

function snapValue(value, unit) {
  const size = gridUnit(unit);
  return Math.round(value / size) * size;
}

function gridUnit(unit) {
  return convertFtToUnit(1, unit);
}

function convertFtToUnit(value, unit) {
  return value * ftToUnitFactor[unit];
}

function getContainerDimensions(yard, container) {
  const width = convertFtToUnit(container.widthFt, yard.unit);
  const depth = convertFtToUnit(containerDepthFt, yard.unit);
  if (container.rotation === 90) {
    return { width: depth, height: width };
  }
  return { width, height: depth };
}

function clampToBounds(position, width, height, yard) {
  return {
    x: Math.min(Math.max(position.x, 0), Math.max(yard.width - width, 0)),
    y: Math.min(Math.max(position.y, 0), Math.max(yard.height - height, 0)),
  };
}

function isCollision(yard, candidate, ignoreId) {
  const dims = getContainerDimensions(yard, candidate);
  return yard.containers.some((container) => {
    if (container.id === ignoreId) return false;
    const otherDims = getContainerDimensions(yard, container);
    return !(
      candidate.x + dims.width <= container.x ||
      candidate.x >= container.x + otherDims.width ||
      candidate.y + dims.height <= container.y ||
      candidate.y >= container.y + otherDims.height
    );
  });
}

function findNearestSpot(yard, container, width, height) {
  const startX = container.x;
  const startY = container.y;
  const step = gridUnit(yard.unit);
  const maxRadius = Math.ceil(Math.max(yard.width, yard.height) / step) + 2;
  for (let radius = 0; radius <= maxRadius && radius < 60; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = startX + dx * step;
        const y = startY + dy * step;
        const clamped = clampToBounds({ x, y }, width, height, yard);
        const candidate = { ...container, x: clamped.x, y: clamped.y };
        if (!isCollision(yard, candidate, container.id)) {
          return clamped;
        }
      }
    }
  }
  return null;
}

function setContainerTransform(group, x, y) {
  group.setAttribute('transform', `translate(${x}, ${y})`);
}

function getContainerById(yard, id) {
  return yard.containers.find((container) => container.id === id);
}

function createGhost(type) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = `${type.widthFt} ft`;
  ghost.style.borderColor = type.color;
  return ghost;
}

function showHint(message) {
  if (!message) return;
  els.hint.textContent = message;
  els.hint.classList.add('visible');
  if (hintTimeout) window.clearTimeout(hintTimeout);
  hintTimeout = window.setTimeout(() => {
    els.hint.classList.remove('visible');
  }, 1800);
}

function formatNumber(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Number(rounded.toString()).toString();
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
