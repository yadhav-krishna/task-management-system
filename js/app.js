/* Taskflow's task state comes from the Express API. MongoDB is the source of truth. */
const API_BASE = '/api/tasks';
const CATEGORIES = ['Personal', 'College', 'Projects', 'Work', 'Other'];
const CATEGORY_COLORS = { Personal: '#e59b55', College: '#6384dc', Projects: '#9c70d5', Work: '#4eaa8b', Other: '#929daf' };
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

let tasks = [];
let activeView = 'dashboard';
let activeCategory = '';
let lastFocusedElement = null;
let isLoading = true;
let apiError = '';

const $ = (selector) => document.querySelector(selector);
const taskList = $('#taskList');
const taskModal = $('#taskModal');
const taskForm = $('#taskForm');

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function normalizeTask(task) {
  return { ...task, id: String(task._id || task.id), dueDate: task.dueDate || '' };
}

// All writes and reads go through the REST API; there is no localStorage fallback.
async function apiRequest(path = '', options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
    });
  } catch {
    throw new Error('Cannot reach the Taskflow server. Start it and make sure MongoDB is available, then retry.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw new Error('The server returned an unreadable response. Check the server logs.'); }
  if (!response.ok || !result.success) throw new Error(result.error?.message || `The request failed (${response.status}).`);
  return result.data;
}

// Get the current database records at page load and whenever the user retries.
async function loadTasks() {
  isLoading = true;
  apiError = '';
  renderTasks();
  try {
    const records = await apiRequest();
    tasks = records.map(normalizeTask);
    apiError = '';
  } catch (error) {
    apiError = error.message;
    showToast(error.message);
  } finally {
    isLoading = false;
    renderAll();
  }
}

function isOverdue(task, today = localDateString(new Date())) {
  return Boolean(task.dueDate) && task.dueDate < today && task.status !== 'Completed';
}
function calculateStatistics() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'Completed').length;
  return {
    total,
    pending: tasks.filter((task) => task.status === 'Pending').length,
    progress: tasks.filter((task) => task.status === 'In Progress').length,
    completed,
    overdue: tasks.filter((task) => isOverdue(task)).length,
    completion: total ? Math.round((completed / total) * 100) : 0
  };
}
function renderDashboard() {
  const stats = calculateStatistics();
  const unavailable = isLoading || Boolean(apiError);
  $('#totalStat').textContent = unavailable ? '—' : stats.total;
  $('#pendingStat').textContent = unavailable ? '—' : stats.pending;
  $('#progressStat').textContent = unavailable ? '—' : stats.progress;
  $('#completedStat').textContent = unavailable ? '—' : stats.completed;
  $('#overdueStat').textContent = unavailable ? '—' : stats.overdue;
  $('#allNavCount').textContent = unavailable ? '—' : stats.total;
  $('#completionText').textContent = unavailable ? '—' : `${stats.completion}%`;
  $('#completionBar').style.width = `${stats.completion}%`;
  $('#completionBar').setAttribute('aria-valuenow', stats.completion);
}

function renderCategories() {
  const nav = $('#categoryNav');
  nav.replaceChildren();
  CATEGORIES.forEach((category) => {
    const button = document.createElement('button');
    button.className = `nav-item${activeView === 'category' && activeCategory === category ? ' active' : ''}`;
    button.type = 'button';
    button.dataset.category = category;
    const dot = document.createElement('span');
    dot.className = 'category-dot';
    dot.style.setProperty('--category-color', CATEGORY_COLORS[category]);
    button.append(dot, document.createTextNode(category));
    button.addEventListener('click', () => { activeCategory = category; activeView = 'category'; syncView(); closeMobileNav(); renderTasks(); });
    nav.append(button);
  });
}
function syncView() {
  const views = {
    dashboard: ['Overview', 'Good day', 'YOUR SPACE, AT A GLANCE', 'Here’s what’s happening with your tasks today.', 'Your tasks'],
    all: ['All tasks', 'All your tasks', 'YOUR WORKSPACE', 'Everything you’re keeping track of, all in one place.', 'All tasks'],
    pending: ['Pending', 'Pending tasks', 'ONE STEP AT A TIME', 'A clear view of what’s waiting for you.', 'Pending tasks'],
    progress: ['In progress', 'In progress', 'KEEP THE MOMENTUM', 'Pick up where you left off.', 'In progress'],
    completed: ['Completed', 'Completed tasks', 'LOOK HOW FAR YOU’VE COME', 'Every finished task is a win.', 'Completed tasks'],
    category: [activeCategory, activeCategory, 'YOUR CATEGORIES', `Tasks filed under ${activeCategory}.`, `${activeCategory} tasks`]
  };
  const view = views[activeView] || views.dashboard;
  $('#pageCrumb').textContent = view[0];
  $('#pageTitle').firstChild.textContent = view[1];
  $('#headingEyebrow').textContent = view[2];
  $('#pageSubtitle').textContent = view[3];
  $('#listHeading').textContent = view[4];
  document.querySelectorAll('.main-nav .nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === activeView));
  renderCategories();
}
function formatDueDate(dateValue) {
  if (!dateValue) return { label: 'No due date', className: '' };
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = localDateString(new Date());
  const label = dateValue === today ? 'Today' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, className: dateValue < today ? 'overdue' : dateValue === today ? 'today' : '' };
}

// These filters operate on the API-loaded array but never mutate its records.
function filterTasks() {
  const query = $('#searchInput').value.trim().toLocaleLowerCase();
  const status = $('#statusFilter').value;
  const priority = $('#priorityFilter').value;
  const category = $('#categoryFilter').value;
  return tasks.filter((task) => {
    const viewMatch = activeView === 'dashboard' || activeView === 'all' || (activeView === 'pending' && task.status === 'Pending') || (activeView === 'progress' && task.status === 'In Progress') || (activeView === 'completed' && task.status === 'Completed') || (activeView === 'category' && task.category === activeCategory);
    const searchMatch = !query || `${task.title} ${task.description}`.toLocaleLowerCase().includes(query);
    return viewMatch && searchMatch && (!status || task.status === status) && (!priority || task.priority === priority) && (!category || task.category === category);
  });
}
function sortTasks(list) {
  const sorted = [...list];
  if ($('#sortSelect').value === 'priority') sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.title.localeCompare(b.title));
  else if ($('#sortSelect').value === 'created') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else sorted.sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'));
  return sorted;
}

function makeTaskRow(task) {
  const row = document.createElement('article');
  row.className = 'task-row';
  const isDone = task.status === 'Completed';
  const due = formatDueDate(task.dueDate);
  // Dynamic text is escaped; fixed action labels and validated enum values are the only other markup.
  row.innerHTML = `<div class="task-main"><button class="task-check${isDone ? ' checked' : ''}" aria-label="${isDone ? 'Mark as pending' : 'Mark as completed'}" title="${isDone ? 'Mark as pending' : 'Mark as completed'}">${isDone ? '✓' : ''}</button><div class="task-copy"><span class="task-title${isDone ? ' done' : ''}">${escapeText(task.title)}</span><span class="task-description">${escapeText(task.description || 'No description added')}</span></div></div><div class="task-category"><span class="category-mark" style="--category-color:${CATEGORY_COLORS[task.category]}"></span>${escapeText(task.category)}</div><div class="task-priority-cell"><span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority} priority</span></div><div class="task-status-cell" title="Choose a status"><span class="status-badge status-${task.status === 'In Progress' ? 'progress' : task.status.toLowerCase()}">${task.status}</span><select class="status-select" aria-label="Change status for ${escapeText(task.title)}"><option${task.status === 'Pending' ? ' selected' : ''}>Pending</option><option${task.status === 'In Progress' ? ' selected' : ''}>In Progress</option><option${task.status === 'Completed' ? ' selected' : ''}>Completed</option></select></div><div class="task-due-cell due-date ${due.className}">${due.label}</div><div class="row-actions"><button class="action-button edit" aria-label="Edit ${escapeText(task.title)}" title="Edit task">✎</button><button class="action-button delete" aria-label="Delete ${escapeText(task.title)}" title="Delete task">⌫</button></div>`;
  row.querySelector('.task-check').addEventListener('click', () => updateStatus(task.id, isDone ? 'Pending' : 'Completed'));
  row.querySelector('.status-select').addEventListener('change', (event) => updateStatus(task.id, event.target.value));
  row.querySelector('.edit').addEventListener('click', () => openTaskModal(task));
  row.querySelector('.delete').addEventListener('click', () => deleteTask(task.id));
  return row;
}
function renderActiveFilters() {
  const container = $('#activeFilters');
  container.replaceChildren();
  [['Search', $('#searchInput').value.trim()], ['Status', $('#statusFilter').value], ['Priority', $('#priorityFilter').value], ['Category', $('#categoryFilter').value]].filter(([, value]) => value).forEach(([label, value]) => {
    const chip = document.createElement('span'); chip.className = 'filter-chip'; chip.textContent = `${label}: ${value}`; container.append(chip);
  });
}
function renderTasks() {
  const filtered = sortTasks(filterTasks());
  taskList.replaceChildren();
  if (isLoading) {
    const loading = document.createElement('div'); loading.className = 'empty-state';
    loading.innerHTML = '<div class="empty-icon">◌</div><h3>Loading your tasks</h3><p>Connecting to the Taskflow server…</p>';
    taskList.append(loading);
  } else if (apiError) {
    const error = document.createElement('div'); error.className = 'empty-state';
    const icon = document.createElement('div'); icon.className = 'empty-icon'; icon.textContent = '!';
    const title = document.createElement('h3'); title.textContent = 'Tasks are unavailable';
    const message = document.createElement('p'); message.textContent = apiError;
    const retry = document.createElement('button'); retry.className = 'button button-primary'; retry.type = 'button'; retry.textContent = 'Retry connection'; retry.addEventListener('click', loadTasks);
    error.append(icon, title, message, retry); taskList.append(error);
  } else if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    const noTasksYet = tasks.length === 0;
    empty.innerHTML = `<div class="empty-icon">${noTasksYet ? '✦' : '⌕'}</div><h3>${noTasksYet ? 'A fresh start' : 'No tasks found'}</h3><p>${noTasksYet ? 'Create your first database task or add demo tasks for your project review.' : 'Try a different search or clear your filters to find what you need.'}</p>${noTasksYet ? '<button class="button button-primary" id="emptyAdd">＋ Add a task</button>' : ''}`;
    taskList.append(empty);
    const emptyAdd = $('#emptyAdd'); if (emptyAdd) emptyAdd.addEventListener('click', () => openTaskModal());
  } else filtered.forEach((task) => taskList.append(makeTaskRow(task)));
  $('#resultCount').textContent = isLoading ? 'Loading tasks…' : apiError ? 'Unable to load tasks' : `Showing ${filtered.length} of ${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
  renderActiveFilters();
}
function renderAll() { renderDashboard(); syncView(); renderTasks(); }

// A successful API response is required before the page changes or reports success.
async function addTask(task) {
  const saved = normalizeTask(await apiRequest('', { method: 'POST', body: JSON.stringify(task) }));
  tasks.push(saved); apiError = ''; renderAll(); showToast('Task created successfully.');
}
async function updateTask(id, changes) {
  const saved = normalizeTask(await apiRequest(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(changes) }));
  tasks = tasks.map((task) => task.id === id ? saved : task); apiError = ''; renderAll(); showToast('Task updated successfully.');
}
async function updateStatus(id, status) {
  try {
    const saved = normalizeTask(await apiRequest(`/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }));
    tasks = tasks.map((task) => task.id === id ? saved : task); renderAll();
  } catch (error) { showToast(error.message); }
}
async function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task || !window.confirm(`Delete “${task.title}”? This action cannot be undone.`)) return;
  try {
    await apiRequest(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
    tasks = tasks.filter((item) => item.id !== id); renderAll(); showToast('Task deleted.');
  } catch (error) { showToast(error.message); }
}

function openTaskModal(task = null) {
  lastFocusedElement = document.activeElement;
  taskForm.reset();
  $('#taskId').value = task?.id || '';
  $('#taskTitle').value = task?.title || '';
  $('#taskDescription').value = task?.description || '';
  $('#taskCategory').value = task?.category || 'Personal';
  $('#taskPriority').value = task?.priority || 'Medium';
  $('#taskDueDate').value = task?.dueDate || '';
  $('#taskStatus').value = task?.status || 'Pending';
  $('#modalTitle').textContent = task ? 'Edit task' : 'Create a task';
  $('#modalSubtitle').textContent = task ? 'Make the changes you need.' : 'Add a new item to your workspace.';
  $('#saveTaskButton').textContent = task ? 'Save changes →' : 'Create task →';
  $('#titleError').textContent = '';
  $('#taskTitle').removeAttribute('aria-invalid');
  $('#saveTaskButton').disabled = false;
  taskModal.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#taskTitle').focus();
  $('#taskDescription').dispatchEvent(new Event('input', { bubbles: true }));
}
function closeTaskModal() { taskModal.hidden = true; document.body.style.overflow = ''; if (lastFocusedElement?.focus) lastFocusedElement.focus(); }
async function handleTaskSubmit(event) {
  event.preventDefault();
  const titleInput = $('#taskTitle');
  const title = titleInput.value.trim();
  if (!title) { $('#titleError').textContent = 'Please enter a task title.'; titleInput.setAttribute('aria-invalid', 'true'); titleInput.focus(); return; }
  if (title.length > 80) { $('#titleError').textContent = 'Keep the title to 80 characters or fewer.'; titleInput.setAttribute('aria-invalid', 'true'); titleInput.focus(); return; }
  const id = $('#taskId').value;
  const values = { title, description: $('#taskDescription').value.trim(), category: $('#taskCategory').value, priority: $('#taskPriority').value, dueDate: $('#taskDueDate').value, status: $('#taskStatus').value };
  const saveButton = $('#saveTaskButton');
  saveButton.disabled = true; saveButton.textContent = id ? 'Saving…' : 'Creating…';
  try {
    if (id) await updateTask(id, values); else await addTask(values);
    closeTaskModal();
  } catch (error) {
    showToast(error.message);
  } finally {
    if (!taskModal.hidden) { saveButton.disabled = false; saveButton.textContent = id ? 'Save changes →' : 'Create task →'; }
  }
}
function showToast(message) {
  const toast = document.createElement('div'); toast.className = 'toast';
  const mark = document.createElement('span'); mark.className = 'toast-mark'; mark.textContent = '✓';
  toast.append(mark, document.createTextNode(message)); $('#toastRegion').append(toast);
  window.setTimeout(() => { toast.classList.add('toast-out'); window.setTimeout(() => toast.remove(), 220); }, 3200);
}
function clearFilters() {
  $('#searchInput').value = ''; $('#statusFilter').value = ''; $('#priorityFilter').value = ''; $('#categoryFilter').value = ''; $('#sortSelect').value = 'due';
  activeCategory = ''; activeView = 'all'; syncView(); renderTasks();
}
async function seedDemoData() {
  if (!window.confirm('Add or refresh the five tagged demo tasks in MongoDB? Existing personal tasks will not be deleted.')) return;
  try {
    const result = await apiRequest('/demo/seed', { method: 'POST' });
    await loadTasks();
    if (!apiError) showToast(`Demo tasks ready (${result.seeded} inserted, ${result.refreshed} refreshed).`);
  } catch (error) { showToast(error.message); }
}
function closeMobileNav() { $('#sidebar').classList.remove('open'); $('#mobileScrim').classList.remove('visible'); $('#menuToggle').setAttribute('aria-expanded', 'false'); }

function setupOptionalJQueryEnhancement() {
  // jQuery adds a live character count only; CRUD, validation, and navigation use vanilla JS.
  if (!window.jQuery) return;
  window.jQuery(() => {
    const $description = window.jQuery('#taskDescription');
    const $counter = window.jQuery('#descriptionCount');
    const updateCounter = () => {
      const length = $description.val().length;
      $counter.text(`${length} / 500`).prop('hidden', false).toggleClass('near-limit', length >= 450);
    };
    $description.off('input.taskflowCounter').on('input.taskflowCounter', updateCounter);
    updateCounter();
  });
}
function wireEvents() {
  document.querySelectorAll('.main-nav .nav-item').forEach((button) => button.addEventListener('click', () => { activeView = button.dataset.view; activeCategory = ''; syncView(); closeMobileNav(); renderTasks(); }));
  ['searchInput', 'statusFilter', 'priorityFilter', 'categoryFilter', 'sortSelect'].forEach((id) => $(`#${id}`).addEventListener(id === 'searchInput' ? 'input' : 'change', renderTasks));
  $('#categoryFilter').innerHTML = '<option value="">All categories</option>' + CATEGORIES.map((category) => `<option>${category}</option>`).join('');
  $('#addTaskTop').addEventListener('click', () => openTaskModal());
  $('#addTaskHeading').addEventListener('click', () => openTaskModal());
  $('#closeModal').addEventListener('click', closeTaskModal);
  $('#cancelModal').addEventListener('click', closeTaskModal);
  taskModal.addEventListener('click', (event) => { if (event.target === taskModal) closeTaskModal(); });
  taskForm.addEventListener('submit', handleTaskSubmit);
  $('#taskTitle').addEventListener('input', () => { $('#titleError').textContent = ''; $('#taskTitle').removeAttribute('aria-invalid'); });
  $('#clearFilters').addEventListener('click', clearFilters);
  $('#resetDemo').addEventListener('click', seedDemoData);
  $('#menuToggle').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#mobileScrim').classList.toggle('visible', open); $('#menuToggle').setAttribute('aria-expanded', String(open)); });
  $('#mobileScrim').addEventListener('click', closeMobileNav);
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#searchInput').focus(); }
    if (event.key === 'Escape') { if (!taskModal.hidden) closeTaskModal(); else closeMobileNav(); }
    if (event.key === 'Tab' && !taskModal.hidden) trapModalFocus(event);
  });
  setupOptionalJQueryEnhancement();
}
function trapModalFocus(event) {
  const focusable = [...taskModal.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])')].filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function initializeApp() {
  $('#todayLabel').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
  wireEvents();
  renderAll();
  loadTasks();
}
initializeApp();
