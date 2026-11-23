export function dateKey(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, i) => String(part).padStart(i ? 2 : 4, '0')).join('-');
}

export function parseDay(key) {
  return new Date(key + 'T12:00:00');
}

export function shiftDay(key, days) {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function weekStart(key) {
  return shiftDay(key, -((parseDay(key).getDay() + 6) % 7));
}

function occurrence(rule, day) {
  const days = (Date.parse(day) - Date.parse(rule.start)) / 86400000;
  if (!rule.enabled || days < 0 || days % rule.repeat !== 0) return null;
  const { title, description, importance, duration, time } = rule;
  return {
    id: rule.id + '@' + day, ruleId: rule.id, occurrence: day,
    title, description, importance, duration, date: day, time, completed: null
  };
}

export function reconcile(state, today) {
  const tasks = state.tasks.map(task => {
    if (!task.completed && task.date && task.date < today) {
      return { ...task, date: '', time: '' };
    }
    return task;
  });
  const ids = new Set(tasks.map(task => task.id));
  const rules = state.rules.map(rule => {
    if (!rule.enabled || rule.checkedThrough === today) return rule;
    const nextDay = rule.checkedThrough && rule.checkedThrough < today
      ? shiftDay(rule.checkedThrough, 1) : today;
    for (let day = nextDay > rule.start ? nextDay : rule.start; day <= today; day = shiftDay(day, 1)) {
      const task = occurrence(rule, day);
      if (!task || ids.has(task.id)) continue;
      tasks.push(day < today ? { ...task, date: '', time: '' } : task);
    }
    return { ...rule, checkedThrough: today };
  });
  return { ...state, tasks, rules };
}

export function weekTasks(state, start, today) {
  const ids = new Set(state.tasks.map(task => task.id));
  const tasks = state.tasks.filter(task => task.date >= start && task.date <= shiftDay(start, 6));
  for (let i = 0; i < 7; i++) {
    const day = shiftDay(start, i);
    if (day <= today) continue;
    for (const rule of state.rules) {
      const task = occurrence(rule, day);
      if (task && !ids.has(task.id)) tasks.push(task);
    }
  }
  return tasks;
}

export function orderedDay(tasks) {
  return [...tasks].sort((a, b) => a.time.localeCompare(b.time)
    || (a.completed || '').localeCompare(b.completed || ''));
}

export function makeCsv(state) {
  const headings = ['Type', 'Task', 'Description', 'Importance', 'Duration (minutes)', 'Date', 'Time', 'Completed at', 'Repeat interval (days)', 'Enabled', 'Occurrence date'];
  const rows = [
    ...state.tasks.map(t => ['Task', t.title, t.description, t.importance, t.duration, t.date, t.time, t.completed, '', '', t.occurrence]),
    ...state.rules.map(r => ['Recurring rule', r.title, r.description, r.importance, r.duration, r.start, r.time, '', r.repeat, r.enabled, ''])
  ];
  return '\uFEFF' + [headings, ...rows].map(row => row.map(value => {
    let cell = String(value ?? '');
    if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(cell)) cell = "'" + cell;
    return '"' + cell.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
