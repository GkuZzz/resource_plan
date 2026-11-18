import React, { useMemo, useState, useEffect } from 'react';

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
const blank = (year, employeeId = PEOPLE[0].id) => ({ employeeId, projectId: PROJECTS[0].id, startDate: `${year}-01-01`, endDate: `${year}-03-31` });
function load() { try { const value = localStorage.getItem(STORAGE); return value === null ? INITIAL : JSON.parse(value); } catch { return INITIAL; } }

export default function App() {
  const [year, setYear] = useState(2027);
  const [assignments, setAssignments] = useState(load);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(assignments)); }, [assignments]);

  const first = `${year}-01-01`, last = `${year}-12-31`;
  const totalDays = days(first, `${year + 1}-01-01`);
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = iso(new Date(Date.UTC(year, i, 1)));
    const end = iso(new Date(Date.UTC(year, i + 1, 1)));
    return { label: new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(new Date(utc(start))), left: days(first, start) / totalDays * 100, width: days(start, end) / totalDays * 100 };
  });
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
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(assignments, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'resource-assignments.json'; link.click(); URL.revokeObjectURL(url);
  };
  return <main className="page">
    <header className="top"><div><div className="eyebrow">YANDEX TRACKER · RESOURCE PLANNER</div><h1>Годовой план ресурсов</h1><p>Назначения сотрудников на проекты · пересечения разрешены</p></div><button className="primary" onClick={() => edit(blank(year))}>+ Назначить сотрудника</button></header>
    <section className="toolbar">
      <div className="year"><button onClick={() => setYear(y => y - 1)} aria-label="Предыдущий год">‹</button><strong>{year}</strong><button onClick={() => setYear(y => y + 1)} aria-label="Следующий год">›</button></div>
      <label>Сотрудник <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}><option value="all">Все сотрудники</option>{PEOPLE.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Проект <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}><option value="all">Все проекты</option>{PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button onClick={exportJson}>Экспорт JSON</button>
    </section>
    <section className="board"><div className="scroll"><div className="gantt">
      <div className="gantt-head"><div className="person-heading">Сотрудник</div><div className="months">{months.map((m, i) => <div key={i} style={{ left: `${m.left}%`, width: `${m.width}%` }}>{m.label}</div>)}</div></div>
      {people.map(person => {
        const rows = visible.filter(a => a.employeeId === person.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
        return <div className="person-row" key={person.id}><div className="person"><strong>{person.name}</strong><small>{person.role} · {rows.length} назнач.</small><button className="small-add" title="Добавить назначение" onClick={() => edit(blank(year, person.id))}>+</button></div><div className="timeline" style={{ minHeight: `${Math.max(1, rows.length) * 36 + 14}px` }}>
          {months.slice(1).map((m, i) => <span className="gridline" key={i} style={{ left: `${m.left}%` }} />)}
          {rows.map((a, i) => { const p = PROJECTS.find(p => p.id === a.projectId); const start = Math.max(0, days(first, a.startDate)); const end = Math.min(totalDays, days(first, a.endDate) + 1); return <button key={a.id} className="bar" style={{ left: `${start / totalDays * 100}%`, width: `${(end - start) / totalDays * 100}%`, top: `${7 + i * 36}px`, backgroundColor: p?.color || '#777' }} title={`${p?.name || a.projectId}: ${fmt(a.startDate)} — ${fmt(a.endDate)}`} onClick={() => edit(a)}><span>{p?.name || a.projectId}</span></button>; })}
        </div></div>;
      })}
      </div></div></section>
    <div className="legend">{PROJECTS.map(p => <span key={p.id}><i style={{ background: p.color }} />{p.name}</span>)}</div>
    <p className="hint">Нажмите на цветную полосу, чтобы изменить даты или проект. Назначения хранятся локально в этом браузере.</p>
    {editing && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setEditing(null); }}><form className="dialog" onSubmit={save}><h2>{editing.id ? 'Редактировать назначение' : 'Новое назначение'}</h2>
      <label>Сотрудник<select value={editing.employeeId} onChange={e => setEditing(a => ({ ...a, employeeId: e.target.value }))}>{PEOPLE.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Проект<select value={editing.projectId} onChange={e => setEditing(a => ({ ...a, projectId: e.target.value }))}>{PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="date-pair"><label>Начало<input required type="date" value={editing.startDate} onChange={e => setEditing(a => ({ ...a, startDate: e.target.value }))}/></label><label>Окончание<input required type="date" value={editing.endDate} onChange={e => setEditing(a => ({ ...a, endDate: e.target.value }))}/></label></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">{editing.id && <button type="button" className="danger" onClick={remove}>Удалить</button>}<span className="grow"/><button type="button" onClick={() => setEditing(null)}>Отмена</button><button className="primary" type="submit">Сохранить</button></div>
    </form></div>}
  </main>;
}
