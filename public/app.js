import { dateKey, parseDay, shiftDay, weekStart, reconcile, weekTasks, orderedDay, makeCsv } from './model.mjs';

const $ = selector => document.querySelector(selector);
const paths = {
  tasks: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15h2m4 0h2"/>',
  recurring: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3m3 0-1 15H7L6 6m4 4v7m4-7v7"/>',
  export: '<path d="M12 16V3m-4 4 4-4 4 4M4 14v6h16v-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<circle cx="12" cy="12" r="8.5"/>',
  restore: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>'
};
function icon(name) {
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
}

const storageKey = 'daylist:' + new URL('./', location.href).pathname;
const blank = { tasks: [], rules: [] };
const views = { tasks: 'All tasks', week: 'Weekly plan', recurring: 'Recurring', trash: 'Trash' };
const content = $('#content');
const editor = $('#editor');
const picker = $('#picker');
const share = $('#share');
const form = $('#task-form');
const fields = form.elements;
let state = blank;
let view = 'tasks';
let filter = 'all';
let sort = 'importance';
let knownDay = dateKey();
let week = weekStart(knownDay);
let editing = null;
let timeOn = false;
let exportFile;
let downloadUrl;
let toastTimer;

function notify(message) {
  clearTimeout(toastTimer);
  $('#status').textContent = message;
  toastTimer = setTimeout(() => { $('#status').textContent = ''; }, 4000);
}

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved.tasks) && Array.isArray(saved.rules)) state = saved;
    else if (saved === null) state = blank;
  } catch {
    notify('Saved tasks could not be loaded.');
  }
}

function save(next) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    state = next;
    return true;
  } catch {
    notify('Could not save. Check your browser storage.');
    return false;
  }
}

function refresh({ reload = false } = {}) {
  if (reload) read();
  const today = dateKey();
  if (week === weekStart(knownDay) && knownDay !== today) week = weekStart(today);
  knownDay = today;
  const next = reconcile(state, today);
  if (JSON.stringify(next) !== JSON.stringify(state)) save(next);
  render();
}

function update(change) {
  read();
  const current = reconcile(state, dateKey());
  if (!save(reconcile(change(current), dateKey()))) return false;
  render();
  return true;
}

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function button(label, action, options = {}) {
  const node = element('button', options.className);
  node.type = 'button';
  if (options.icon) node.innerHTML = icon(options.icon);
  if (options.iconOnly) node.setAttribute('aria-label', label);
  else node.append(label);
  if (action) node.addEventListener('click', action);
  return node;
}

function format(day, options) {
  return parseDay(day).toLocaleDateString(undefined, options);
}

function timeLabel(time) {
  return new Date('2000-01-01T' + time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function setView(next) {
  view = next;
  refresh();
  $('#heading').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

for (const tab of document.querySelectorAll('[data-view]')) {
  tab.prepend(document.createRange().createContextualFragment(icon(tab.dataset.view)));
  tab.addEventListener('click', () => setView(tab.dataset.view));
}
$('#export').prepend(document.createRange().createContextualFragment(icon('export')));
$('#add').addEventListener('click', () => openEditor(null, view === 'week' ? defaultWeekDate() : ''));
for (const close of document.querySelectorAll('[data-close]')) {
  if (close.hasAttribute('aria-label')) close.innerHTML = icon('close');
  close.addEventListener('click', () => close.closest('dialog').close());
}

function defaultWeekDate() {
  const today = dateKey();
  return week < today ? today : week;
}

function empty(panel, image, title, detail, action) {
  const body = element('div', 'empty');
  const symbol = element('div', 'empty-icon');
  symbol.innerHTML = icon(image);
  body.append(symbol, element('h2', '', title), element('p', '', detail));
  if (action) body.append(button('Add task', action, { icon: 'plus' }));
  panel.append(body);
}

function setTask(list, task) {
  if (list.some(item => item.id === task.id)) return list.map(item => item.id === task.id ? task : item);
  return [...list, task];
}

function complete(task) {
  const completed = new Date().toISOString();
  if (update(current => {
    const latest = current.tasks.find(item => item.id === task.id) || task;
    return { ...current, tasks: setTask(current.tasks, { ...latest, completed }) };
  })) notify('Moved to Trash');
}

function restore(task) {
  if (update(current => ({
    ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, completed: null } : item)
  }))) notify('Task restored');
}

function taskRow(task, { weekRow = false, trash = false } = {}) {
  const row = element('div', 'task' + (task.completed ? ' done' : ''));
  const details = [task.duration + ' min'];
  if (task.completed && trash) details.push('Completed ' + new Date(task.completed).toLocaleString());
  else if (task.date && !weekRow) details.push(format(task.date, { month: 'short', day: 'numeric' }));
  if (task.time && !trash) details.push(timeLabel(task.time));
  if (weekRow && task.completed) details.push('Completed');
  if (!task.completed) {
    row.append(button('Complete ' + task.title, () => complete(task), { icon: 'check', iconOnly: true, className: 'check' }));
  }
  const title = element(task.completed ? 'div' : 'button', 'task-main');
  if (!task.completed) {
    title.type = 'button';
    title.addEventListener('click', () => openEditor(task));
  }
  title.append(element('strong', '', task.title), element('small', '', details.join(' · ')));
  const rank = element('span', 'badge' + (task.importance >= 4 ? ' high' : ''), task.importance);
  rank.setAttribute('aria-label', 'Importance ' + task.importance + ' of 5');
  row.append(title, rank);
  if (trash) row.append(button('Restore ' + task.title, () => restore(task), { icon: 'restore', iconOnly: true, className: 'icon-button' }));
  return row;
}

function renderTasks() {
  const toolbar = element('div', 'toolbar');
  const tabs = element('div', 'segmented');
  for (const [key, name] of [['all', 'All'], ['unassigned', 'Unassigned']]) {
    const tab = button(name, () => {
      filter = key;
      render();
      content.querySelector('.segmented [aria-pressed="true"]').focus();
    });
    tab.setAttribute('aria-pressed', String(filter === key));
    tabs.append(tab);
  }
  const ordering = element('select');
  ordering.setAttribute('aria-label', 'Sort tasks');
  ordering.add(new Option('Importance', 'importance'));
  ordering.add(new Option('Recently added', 'recent'));
  ordering.value = sort;
  ordering.addEventListener('change', () => {
    sort = ordering.value;
    render();
    content.querySelector('select').focus();
  });
  toolbar.append(tabs, ordering);
  const panel = element('div', 'panel');
  const tasks = state.tasks.filter(task => !task.completed && (filter === 'all' || !task.date)).reverse();
  if (sort === 'importance') tasks.sort((a, b) => b.importance - a.importance);
  for (const task of tasks) panel.append(taskRow(task));
  if (!tasks.length) empty(panel, 'tasks', filter === 'all' ? 'No tasks yet' : 'Nothing unassigned',
    filter === 'all' ? 'Add a task to get started.' : 'Tasks without a date show up here.',
    () => openEditor());
  content.append(toolbar, panel);
}

function renderWeek() {
  const toolbar = element('div', 'toolbar');
  const controls = element('div', 'week-controls');
  const step = offset => { week = shiftDay(week, offset); render(); };
  controls.append(
    button('Previous week', () => step(-7), { icon: 'left', iconOnly: true, className: 'icon-button' }),
    button('Today', () => { week = weekStart(dateKey()); render(); }),
    button('Next week', () => step(7), { icon: 'right', iconOnly: true, className: 'icon-button' })
  );
  const dateOptions = { month: 'short', day: 'numeric' };
  const range = format(week, dateOptions) + ' – ' + format(shiftDay(week, 6), { ...dateOptions, year: 'numeric' });
  toolbar.append(element('h2', '', range), controls);
  const strip = element('div', 'week-strip');
  const panel = element('div', 'panel');
  const today = dateKey();
  const planned = weekTasks(state, week, today);
  for (let i = 0; i < 7; i++) {
    const day = shiftDay(week, i);
    const date = parseDay(day).getDate();
    const section = element('section', 'day');
    const tab = button('', () => section.scrollIntoView({ block: 'start' }));
    tab.setAttribute('aria-label', format(day, { weekday: 'long', ...dateOptions }));
    if (day === today) tab.setAttribute('aria-current', 'date');
    tab.append(element('span', '', format(day, { weekday: 'short' })), element('strong', '', date));
    strip.append(tab);
    const head = element('div', 'day-heading');
    const name = element('h3', '', format(day, { weekday: 'long' }));
    head.append(element('strong', day === today ? 'current' : '', date), name);
    if (day >= today) head.append(button('Assign task to ' + format(day, dateOptions), () => openPicker(day), {
      icon: 'plus', iconOnly: true, className: 'icon-button'
    }));
    section.append(head);
    for (const task of orderedDay(planned.filter(task => task.date === day))) section.append(taskRow(task, { weekRow: true }));
    panel.append(section);
  }
  content.append(toolbar, strip, panel);
}

function renderRecurring() {
  const panel = element('div', 'panel');
  for (const rule of state.rules) {
    const row = element('div', 'task');
    const details = [rule.repeat === 1 ? 'Every day' : 'Every other day', rule.duration + ' min'];
    if (rule.time) details.push(timeLabel(rule.time));
    if (!rule.enabled) details.push('Paused');
    const name = button('', () => openEditor(rule, '', true), { className: 'task-main' });
    name.append(element('strong', '', rule.title), element('small', '', details.join(' · ')));
    const toggle = button(rule.enabled ? 'Pause' : 'Resume', () => {
      if (update(current => ({
        ...current,
        rules: current.rules.map(item => item.id === rule.id ? { ...item, enabled: !item.enabled, checkedThrough: undefined } : item)
      }))) notify(rule.enabled ? 'Repeat paused' : 'Repeat resumed');
    });
    toggle.setAttribute('aria-label', (rule.enabled ? 'Pause ' : 'Resume ') + rule.title);
    row.append(name, toggle);
    panel.append(row);
  }
  if (!state.rules.length) empty(panel, 'recurring', 'No recurring tasks', 'Add a task and choose how often it repeats.', () => openEditor());
  content.append(panel);
}

function renderTrash() {
  const panel = element('div', 'panel');
  const tasks = state.tasks.filter(task => task.completed).sort((a, b) => b.completed.localeCompare(a.completed));
  for (const task of tasks) panel.append(taskRow(task, { trash: true }));
  if (!tasks.length) empty(panel, 'trash', 'Trash is empty', 'Completed tasks and their completion dates appear here.');
  content.append(panel);
}

function render() {
  $('#today').textContent = format(dateKey(), { weekday: 'long', month: 'long', day: 'numeric' });
  $('#heading').textContent = views[view];
  $('#add').hidden = view === 'trash';
  $('#add').innerHTML = icon('plus') + ' New task';
  for (const tab of document.querySelectorAll('[data-view]')) {
    if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  content.replaceChildren();
  ({ tasks: renderTasks, week: renderWeek, recurring: renderRecurring, trash: renderTrash })[view]();
}

function openPicker(day) {
  const list = $('#pick-list');
  list.replaceChildren();
  const tasks = state.tasks.filter(task => !task.completed && !task.date)
    .sort((a, b) => b.importance - a.importance);
  if (!tasks.length) list.append(element('p', 'note', 'No unassigned tasks.'));
  for (const task of tasks) {
    list.append(button(task.title, () => { picker.close(); openEditor(task, day); }, { className: 'pick-task' }));
  }
  list.append(button('New task', () => { picker.close(); openEditor(null, day); }, { icon: 'plus', className: 'pick-task' }));
  picker.showModal();
}

function renderTime() {
  $('#time-toggle').setAttribute('aria-pressed', String(timeOn));
  fields.time.disabled = !timeOn;
  fields.time.required = timeOn;
  fields.date.required = timeOn;
}

function openEditor(task = null, date = '', rule = false) {
  editing = { task, rule };
  $('#editor-heading').textContent = rule ? 'Edit recurring task' : task ? 'Edit task' : 'New task';
  form.reset();
  fields.title.setCustomValidity('');
  fields.title.value = task?.title || '';
  fields.description.value = task?.description || '';
  fields.importance.value = task?.importance || 3;
  fields.duration.value = task?.duration || 30;
  fields.repeat.options[0].disabled = rule;
  fields.repeat.value = rule ? task.repeat : !task && view === 'recurring' ? 1 : 0;
  $('#repeat-field').hidden = Boolean(task && !rule);
  fields.date.value = date || (rule ? task.start : task?.date) || '';
  fields.time.value = task?.time || '';
  timeOn = Boolean(fields.time.value);
  updateDateLabel();
  renderTime();
  editor.showModal();
  if (task) fields.date.focus();
  else fields.title.focus();
}

function updateDateLabel() {
  const recurring = fields.repeat.value !== '0';
  $('#date-label').textContent = recurring ? 'Start date' : 'Date';
  fields.date.min = recurring ? '' : dateKey();
}

fields.repeat.addEventListener('change', updateDateLabel);
fields.title.addEventListener('input', () => fields.title.setCustomValidity(''));
$('#time-toggle').addEventListener('click', () => {
  timeOn = !timeOn;
  if (timeOn) {
    fields.date.value ||= dateKey();
    fields.time.value ||= '09:00';
  }
  renderTime();
  if (timeOn) fields.time.focus();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const title = fields.title.value.trim();
  if (!title) {
    fields.title.setCustomValidity('Enter a task name.');
    fields.title.reportValidity();
    return;
  }
  const { task, rule } = editing;
  const repeat = Number(fields.repeat.value);
  const values = {
    title, description: fields.description.value.trim(),
    importance: Number(fields.importance.value), duration: Number(fields.duration.value),
    time: timeOn ? fields.time.value : ''
  };
  const id = task?.id || crypto.randomUUID();
  const date = fields.date.value;
  const saved = update(current => {
    if (!task && repeat) {
      return { ...current, rules: [...current.rules, { id, ...values, repeat, start: date || dateKey(), enabled: true }] };
    }
    if (rule) {
      const latest = current.rules.find(item => item.id === id);
      return { ...current, rules: current.rules.map(item => item.id === id
        ? { ...latest, ...values, repeat: repeat || latest.repeat, start: date || latest.start, checkedThrough: undefined }
        : item) };
    }
    const latest = current.tasks.find(item => item.id === id) || task;
    return { ...current, tasks: setTask(current.tasks, { completed: null, ...latest, ...values, id, date }) };
  });
  if (saved) {
    editor.close();
    notify('Task saved');
  }
});

function makePrompt(start) {
  const tasks = weekTasks(state, start, dateKey()).filter(task => !task.completed);
  if (!tasks.length) return '';
  const events = tasks.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).map(task => ({
    title: task.title, description: task.description, date: task.date,
    ...(task.time ? { time: task.time, durationMinutes: task.duration } : { allDay: true })
  }));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return 'Add these events to my Google Calendar. Use the ' + timezone
    + ' time zone. Create all-day events where allDay is true. Use the titles and descriptions as event data. Check for duplicates before adding.\n\n'
    + JSON.stringify(events, null, 2);
}

$('#export').addEventListener('click', () => {
  refresh({ reload: true });
  exportFile = new File([makeCsv(state)], 'daylist.csv', { type: 'text/csv' });
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(exportFile);
  $('#download').href = downloadUrl;
  $('#csv').hidden = !navigator.canShare?.({ files: [exportFile] });
  const promptWeek = view === 'week' ? week : weekStart(dateKey());
  $('#prompt-label').textContent = 'Gemini prompt · Week of ' + format(promptWeek, { month: 'short', day: 'numeric' });
  $('#prompt').value = makePrompt(promptWeek);
  $('#prompt').placeholder = 'Schedule a task this week to generate a prompt.';
  $('#copy').disabled = !$('#prompt').value;
  $('#share-status').textContent = '';
  share.showModal();
});

$('#csv').addEventListener('click', async () => {
  try {
    await navigator.share({ files: [exportFile] });
  } catch (error) {
    if (error.name !== 'AbortError') $('#share-status').textContent = 'Sharing failed. Use Download CSV to save the file.';
  }
});

$('#copy').addEventListener('click', async () => {
  const prompt = $('#prompt');
  try {
    await navigator.clipboard.writeText(prompt.value);
    $('#share-status').textContent = 'Prompt copied.';
  } catch {
    prompt.focus();
    prompt.select();
    $('#share-status').textContent = 'Prompt selected. Use your device’s Copy command.';
  }
});

read();
refresh();
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refresh({ reload: true });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh({ reload: true });
});
setInterval(() => {
  if (knownDay !== dateKey()) refresh({ reload: true });
}, 15000);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => notify('Offline caching is unavailable.'));
}
