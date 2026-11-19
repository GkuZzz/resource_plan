import React, { useMemo, useState, useEffect, useRef } from 'react';

const PROJECTS = [
  { id: 'lkk', name: 'ЛКК', color: '#4477d0' },
  { id: 'stock', name: 'Платформа стока', color: '#159a86' },
  { id: 'fast', name: 'FAST', color: '#9561c9' },
  { id: 'agent', name: 'Кабинет агента', color: '#d48b30' },
];
const PEOPLE = [
  { id: 'alex', name: 'Алексей', role: 'Backend' },
  { id: 'maria', name: 'Мария', role: 'Аналитик' },
  { id: 'dima', name: 'Дмитрий', role: 'Frontend' },
  { id: 'elena', name: 'Елена', role: 'QA' },
];
const INITIAL = [
  { id: '1', employeeId: 'alex', projectId: 'lkk', startDate: '2027-01-10', endDate: '2027-04-25' },
  { id: '2', employeeId: 'alex', projectId: 'stock', startDate: '2027-03-10', endDate: '2027-07-31' },
  { id: '3', employeeId: 'alex', projectId: 'fast', startDate: '2027-09-01', endDate: '2027-12-15' },
  { id: '4', employeeId: 'maria', projectId: 'fast', startDate: '2027-02-01', endDate: '2027-06-30' },
  { id: '5', employeeId: 'dima', projectId: 'stock', startDate: '2027-04-01', endDate: '2027-10-15' },
  { id: '6', employeeId: 'elena', projectId: 'agent', startDate: '2027-01-01', endDate: '2027-08-31' },
];
const STORAGE = 'tracker-resource-planner-assignments-v1';
const utc = s => new Date(`${s}T00:00:00Z`).getTime();
const iso = d => d.toISOString().slice(0, 10);
const fmt = s => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(utc(s)));
const days = (a, b) => (utc(b) - utc(a)) / 86400000;
const shiftDate = (date, amount) => iso(new Date(utc(date) + amount * 86400000));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isoWeek = date => {
  const value = new Date(utc(date));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
};
const blank = (year, employeeId = PEOPLE[0].id) => ({ employeeId, projectId: PROJECTS[0].id, startDate: `${year}-01-01`, endDate: `${year}-03-31` });
function load() { try { const value = localStorage.getItem(STORAGE); return value === null ? INITIAL : JSON.parse(value); } catch { return INITIAL; } }

export default function App() {
  const [year, setYear] = useState(2027);
  const [assignments, setAssignments] = useState(load);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [timelineScale, setTimelineScale] = useState('months');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(null);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(assignments)); }, [assignments]);
  useEffect(() => () => dragRef.current?.cleanup?.(), []);

  const first = `${year}-01-01`, last = `${year}-12-31`;
  const totalDays = days(first, `${year + 1}-01-01`);
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = iso(new Date(Date.UTC(year, i, 1)));
    const end = iso(new Date(Date.UTC(year, i + 1, 1)));
    return { label: new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(new Date(utc(start))), start, end, left: days(first, start) / totalDays * 100, width: days(start, end) / totalDays * 100 };
  });
  const weeks = [];
  let weekStart = first;
  while (weekStart < `${year + 1}-01-01`) {
    const day = new Date(utc(weekStart)).getUTCDay();
    const length = day === 1 ? 7 : (8 - day) % 7;
    const weekEnd = shiftDate(weekStart, length || 7);
    const clippedEnd = weekEnd > `${year + 1}-01-01` ? `${year + 1}-01-01` : weekEnd;
    weeks.push({
      label: `${isoWeek(weekStart)}`,
      start: weekStart,
      end: clippedEnd,
      left: days(first, weekStart) / totalDays * 100,
      width: days(weekStart, clippedEnd) / totalDays * 100,
    });
    weekStart = clippedEnd;
  }
  const periods = timelineScale === 'weeks' ? weeks : months;
  const visible = useMemo(() => assignments.filter(a => a.startDate <= last && a.endDate >= first && (projectFilter === 'all' || a.projectId === projectFilter)), [assignments, year, projectFilter]);
  const people = PEOPLE.filter(p => employeeFilter === 'all' || p.id === employeeFilter);
  const edit = a => { setError(''); setEditing({ ...a }); };
  const save = e => {
    e.preventDefault();
    if (editing.startDate > editing.endDate) { setError('Дата окончания не может быть раньше даты начала'); return; }
    const next = { ...editing, id: editing.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) };
    setAssignments(old => editing.id ? old.map(a => a.id === editing.id ? next : a) : [...old, next]);
    setEditing(null);
  };
  const remove = () => { if (window.confirm('Удалить это назначение?')) { setAssignments(old => old.filter(a => a.id !== editing.id)); setEditing(null); } };
  const beginDrag = (event, assignment, mode) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const timeline = event.currentTarget.closest('.timeline');
    const rect = timeline?.getBoundingClientRect();
    if (!rect?.width) return;

    const pointerId = event.pointerId;
    const originX = event.clientX;
    const duration = days(assignment.startDate, assignment.endDate);
    const snapshot = { ...assignment, mode, moved: false, dragged: false };
    event.currentTarget.setPointerCapture?.(pointerId);

    const onPointerMove = moveEvent => {
      if (moveEvent.pointerId !== pointerId) return;
      const rawDelta = Math.round((moveEvent.clientX - originX) / rect.width * totalDays);
      let delta = rawDelta;
      let startDate = assignment.startDate;
      let endDate = assignment.endDate;

      if (mode === 'move') {
        delta = clamp(rawDelta, Math.ceil(days(assignment.endDate, first)), Math.floor(days(assignment.startDate, last)));
        startDate = shiftDate(assignment.startDate, delta);
        endDate = shiftDate(assignment.endDate, delta);
      } else if (mode === 'start') {
        const maxDelta = Math.min(duration, Math.floor(days(assignment.startDate, last)));
        delta = Math.min(rawDelta, maxDelta);
        startDate = shiftDate(assignment.startDate, delta);
      } else {
        const minDelta = Math.max(-duration, Math.ceil(days(assignment.endDate, first)));
        delta = Math.max(rawDelta, minDelta);
        endDate = shiftDate(assignment.endDate, delta);
      }

      const next = {
        ...snapshot,
        startDate,
        endDate,
        moved: delta !== 0,
        dragged: dragRef.current?.dragged || Math.abs(moveEvent.clientX - originX) > 3,
      };
      dragRef.current = { ...dragRef.current, ...next };
      setDragging(next);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    const onPointerUp = upEvent => {
      if (upEvent.pointerId !== pointerId) return;
      const result = dragRef.current;
      cleanup();
      if (result?.moved) {
        setAssignments(old => old.map(item => item.id === assignment.id
          ? { ...item, startDate: result.startDate, endDate: result.endDate }
          : item));
      }
      if (result?.dragged) {
        suppressClickRef.current = assignment.id;
        window.setTimeout(() => { if (suppressClickRef.current === assignment.id) suppressClickRef.current = null; }, 0);
      }
      dragRef.current = null;
      setDragging(null);
    };

    dragRef.current = { ...snapshot, cleanup };
    setDragging(snapshot);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(assignments, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'resource-assignments.json'; link.click(); URL.revokeObjectURL(url);
  };
  return <main className="page">
    <header className="top"><div><div className="eyebrow">YANDEX TRACKER · RESOURCE PLANNER</div><h1>Годовой план ресурсов</h1><p>Назначения сотрудников на проекты · пересечения разрешены</p></div><button className="primary" onClick={() => edit(blank(year))}>+ Назначить сотрудника</button></header>
    <section className="toolbar">
      <div className="year"><button onClick={() => setYear(y => y - 1)} aria-label="Предыдущий год">‹</button><strong>{year}</strong><button onClick={() => setYear(y => y + 1)} aria-label="Следующий год">›</button></div>
      <div className="scale-switch" aria-label="Масштаб таймлайна">
        <button className={timelineScale === 'months' ? 'active' : ''} aria-pressed={timelineScale === 'months'} onClick={() => setTimelineScale('months')}>Месяцы</button>
        <button className={timelineScale === 'weeks' ? 'active' : ''} aria-pressed={timelineScale === 'weeks'} onClick={() => setTimelineScale('weeks')}>Недели</button>
      </div>
      <label>Сотрудник <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}><option value="all">Все сотрудники</option>{PEOPLE.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Проект <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}><option value="all">Все проекты</option>{PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button onClick={exportJson}>Экспорт JSON</button>
    </section>
    <section className="board"><div className="scroll"><div className={`gantt ${timelineScale}`}>
      <div className="gantt-head"><div className="person-heading">Сотрудник</div><div className="months">{periods.map((period, i) => <div key={`${period.start}-${i}`} title={`${fmt(period.start)} — ${fmt(shiftDate(period.end, -1))}`} style={{ left: `${period.left}%`, width: `${period.width}%` }}>{timelineScale === 'weeks' ? <><span className="week-prefix">нед&nbsp;</span>{period.label}</> : period.label}</div>)}</div></div>
      {people.map(person => {
        const rows = visible.filter(a => a.employeeId === person.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
        return <div className="person-row" key={person.id}><div className="person"><strong>{person.name}</strong><small>{person.role} · {rows.length} назнач.</small><button className="small-add" title="Добавить назначение" onClick={() => edit(blank(year, person.id))}>+</button></div><div className="timeline" style={{ minHeight: `${Math.max(1, rows.length) * 36 + 14}px` }}>
          {periods.slice(1).map(period => <span className={`gridline ${timelineScale}`} key={period.start} style={{ left: `${period.left}%` }} />)}
          {rows.map((a, i) => {
            const shown = dragging?.id === a.id ? dragging : a;
            const p = PROJECTS.find(project => project.id === a.projectId);
            const start = Math.max(0, days(first, shown.startDate));
            const end = Math.min(totalDays, days(first, shown.endDate) + 1);
            const title = `${p?.name || a.projectId}: ${fmt(shown.startDate)} — ${fmt(shown.endDate)}. Перетащите полосу или потяните за её край.`;
            return <button
              key={a.id}
              className={`bar${dragging?.id === a.id ? ' dragging' : ''}`}
              style={{ left: `${start / totalDays * 100}%`, width: `${(end - start) / totalDays * 100}%`, top: `${7 + i * 36}px`, backgroundColor: p?.color || '#777' }}
              title={title}
              aria-label={title}
              onPointerDown={event => beginDrag(event, a, 'move')}
              onClick={() => { if (suppressClickRef.current !== a.id) edit(a); }}
            >
              <span className="resize-handle start" onPointerDown={event => beginDrag(event, a, 'start')} />
              <span className="bar-label">{p?.name || a.projectId}</span>
              <span className="resize-handle end" onPointerDown={event => beginDrag(event, a, 'end')} />
            </button>;
          })}
        </div></div>;
      })}
      </div></div></section>
    <div className="legend">{PROJECTS.map(p => <span key={p.id}><i style={{ background: p.color }} />{p.name}</span>)}</div>
    <p className={`hint${dragging ? ' drag-readout' : ''}`} aria-live="polite">{dragging
      ? `${dragging.mode === 'move' ? 'Новый интервал' : dragging.mode === 'start' ? 'Новое начало' : 'Новое окончание'}: ${fmt(dragging.startDate)} — ${fmt(dragging.endDate)}`
      : 'Перетащите цветную полосу, чтобы сдвинуть интервал, или потяните за её край, чтобы изменить одну дату. Нажмите, чтобы открыть карточку.'}</p>
    {editing && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setEditing(null); }}><form className="dialog" onSubmit={save}><h2>{editing.id ? 'Редактировать назначение' : 'Новое назначение'}</h2>
      <label>Сотрудник<select value={editing.employeeId} onChange={e => setEditing(a => ({ ...a, employeeId: e.target.value }))}>{PEOPLE.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Проект<select value={editing.projectId} onChange={e => setEditing(a => ({ ...a, projectId: e.target.value }))}>{PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="date-pair"><label>Начало<input required type="date" value={editing.startDate} onChange={e => setEditing(a => ({ ...a, startDate: e.target.value }))}/></label><label>Окончание<input required type="date" value={editing.endDate} onChange={e => setEditing(a => ({ ...a, endDate: e.target.value }))}/></label></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">{editing.id && <button type="button" className="danger" onClick={remove}>Удалить</button>}<span className="grow"/><button type="button" onClick={() => setEditing(null)}>Отмена</button><button className="primary" type="submit">Сохранить</button></div>
    </form></div>}
  </main>;
}
