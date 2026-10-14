(() => {
  'use strict';

  const CATS = {
    expense: [
      { name: 'Food',      icon: '🍔', color: '#E8744F' },
      { name: 'Transport', icon: '🚌', color: '#3D7FD9' },
      { name: 'Shopping',  icon: '🛍️', color: '#B05CC7' },
      { name: 'Bills',     icon: '💡', color: '#E8A317' },
      { name: 'Health',    icon: '💊', color: '#D6453D' },
      { name: 'Fun',       icon: '🎬', color: '#1FA88F' },
      { name: 'Education', icon: '📚', color: '#5B6EE1' },
      { name: 'Other',     icon: '📦', color: '#8A9A9D' }
    ],
    income: [
      { name: 'Salary',       icon: '💼', color: '#0E8A5F' },
      { name: 'Freelance',    icon: '💻', color: '#0E8A5F' },
      { name: 'Gift',         icon: '🎁', color: '#0E8A5F' },
      { name: 'Other income', icon: '💰', color: '#0E8A5F' }
    ]
  };
  const ALL = [...CATS.expense, ...CATS.income];
  const meta = n => ALL.find(c => c.name === n) || CATS.expense[7];

  const KEY = 'smart-expense-tracker-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const state = { tx: saved.tx || [], budget: saved.budget || 0, currency: saved.currency || '₹' };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const thisMonth = () => today().slice(0, 7);
  const money = n => state.currency + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const sum = a => a.reduce((s, t) => s + t.amount, 0);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.id);
    toast.id = setTimeout(() => t.classList.remove('show'), 2200);
  }

  $('month').value = thisMonth();
  $('date').value = today();
  $('currency').value = state.currency;
  $('budget').value = state.budget || '';

  function fillCategories() {
    const type = document.querySelector('input[name="type"]:checked').value;
    $('category').innerHTML = CATS[type].map(c => `<option>${c.name}</option>`).join('');
  }
  $('filter').innerHTML += ALL.map(c => `<option>${c.name}</option>`).join('');
  fillCategories();

  document.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener('change', fillCategories));
  $('month').addEventListener('change', render);
  $('filter').addEventListener('change', render);
  $('currency').addEventListener('change', e => { state.currency = e.target.value; save(); render(); });

  $('budgetForm').addEventListener('submit', e => {
    e.preventDefault();
    state.budget = Math.max(0, Number($('budget').value) || 0);
    save(); render(); toast('Budget saved');
  });

  $('txForm').addEventListener('submit', e => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = Number($('amount').value);
    if (!(amount > 0)) return;
    state.tx.push({ id: uid(), type, amount, category: $('category').value, date: $('date').value, note: $('note').value.trim() });
    save();
    $('amount').value = ''; $('note').value = '';
    $('month').value = $('date').value.slice(0, 7);
    render(); toast(type === 'expense' ? 'Expense added' : 'Income added');
    $('amount').focus();
  });

  $('list').addEventListener('click', e => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    state.tx = state.tx.filter(t => t.id !== btn.dataset.id);
    save(); render(); toast('Transaction deleted');
  });

  $('exportBtn').addEventListener('click', () => {
    if (!state.tx.length) return toast('Nothing to export yet');
    const rows = [['Date', 'Type', 'Category', 'Amount', 'Note']]
      .concat(state.tx.map(t => [t.date, t.type, t.category, t.amount, '"' + t.note.replace(/"/g, '""') + '"']));
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'expenses.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('resetBtn').addEventListener('click', () => {
    if (confirm('Delete all transactions and your budget? This cannot be undone.')) {
      state.tx = []; state.budget = 0; $('budget').value = '';
      save(); render(); toast('All data deleted');
    }
  });

  function render() {
    const month = $('month').value || thisMonth();
    const inMonth = state.tx.filter(t => t.date.startsWith(month));
    const expenses = inMonth.filter(t => t.type === 'expense');
    const income = sum(inMonth.filter(t => t.type === 'income'));
    const spent = sum(expenses);
    const balance = income - spent;

    $('balance').textContent = (balance < 0 ? '-' : '') + money(Math.abs(balance));
    $('balance').classList.toggle('neg', balance < 0);
    $('income').textContent = money(income);
    $('spent').textContent = money(spent);

    renderBudget(month, spent, expenses);
    renderChart(expenses, spent);
    renderList(inMonth);
  }

  function renderBudget(month, spent, expenses) {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrent = month === thisMonth();
    const dayNow = isCurrent ? new Date().getDate() : daysInMonth;
    const daysLeft = isCurrent ? daysInMonth - dayNow : 0;

    const pct = state.budget ? Math.min(100, (spent / state.budget) * 100) : 0;
    const bar = $('bar');
    $('barFill').style.width = pct + '%';
    bar.setAttribute('aria-valuenow', Math.round(pct));
    bar.classList.toggle('warn', pct >= 75 && pct < 100);
    bar.classList.toggle('over', state.budget > 0 && spent > state.budget);

    if (!state.budget) $('barText').textContent = 'Set a budget to see how much you can spend each day.';
    else if (spent > state.budget) $('barText').textContent = `You are ${money(spent - state.budget)} over your ${money(state.budget)} budget.`;
    else $('barText').textContent = `${money(spent)} of ${money(state.budget)} used. ${money(state.budget - spent)} left.`;

    const tips = [];
    if (state.budget && isCurrent && spent <= state.budget && daysLeft > 0) {
      tips.push(`💡 You can spend about <b>${money((state.budget - spent) / daysLeft)}</b> a day for the next ${daysLeft} days.`);
    }
    if (expenses.length) {
      const byCat = {};
      expenses.forEach(t => byCat[t.category] = (byCat[t.category] || 0) + t.amount);
      const [topName, topAmt] = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
      tips.push(`${meta(topName).icon} <b>${topName}</b> is your biggest expense at ${money(topAmt)} (${Math.round(topAmt / spent * 100)}%).`);
      tips.push(`📅 You spend about <b>${money(spent / dayNow)}</b> a day on average.`);
      if (isCurrent && dayNow >= 5) {
        const proj = (spent / dayNow) * daysInMonth;
        const over = state.budget && proj > state.budget;
        tips.push(`${over ? '⚠️' : '📈'} At this pace you will spend <b>${money(proj)}</b> by month end${over ? ', which is over your budget' : ''}.`);
      }
    }
    const prev = `${m === 1 ? y - 1 : y}-${pad(m === 1 ? 12 : m - 1)}`;
    const prevSpent = sum(state.tx.filter(t => t.type === 'expense' && t.date.startsWith(prev)));
    if (prevSpent > 0 && spent > 0) {
      const d = Math.round((spent - prevSpent) / prevSpent * 100);
      tips.push(`${d <= 0 ? '🎉' : '📊'} ${isCurrent ? 'So far, spending' : 'Spending'} is <b>${Math.abs(d)}% ${d <= 0 ? 'lower' : 'higher'}</b> than last month.`);
    }
    if (!tips.length) tips.push('Add a few expenses and your tips will show up here.');
    $('insights').innerHTML = tips.map(t => `<li>${t}</li>`).join('');
  }

  function renderChart(expenses, spent) {
    $('donutTotal').textContent = money(spent);
    const byCat = {};
    expenses.forEach(t => byCat[t.category] = (byCat[t.category] || 0) + t.amount);
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    let html = '<circle cx="21" cy="21" r="15.915" stroke="var(--bg)"></circle>';
    let offset = 0;
    entries.forEach(([name, amt]) => {
      const p = (amt / spent) * 100;
      html += `<circle cx="21" cy="21" r="15.915" stroke="${meta(name).color}" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${-offset}"></circle>`;
      offset += p;
    });
    $('donut').innerHTML = html;

    $('legend').innerHTML = entries.length
      ? entries.map(([name, amt]) => `<li><span class="dot" style="background:${meta(name).color}"></span>${name}<span class="amt">${money(amt)}</span><span class="pct">${Math.round(amt / spent * 100)}%</span></li>`).join('')
      : '<li class="muted">No expenses this month.</li>';
  }

  function renderList(inMonth) {
    const f = $('filter').value;
    const items = inMonth.filter(t => f === 'all' || t.category === f).sort((a, b) => b.date.localeCompare(a.date));
    $('empty').hidden = items.length > 0;
    $('list').innerHTML = items.map(t => {
      const c = meta(t.category);
      const d = new Date(t.date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      return `<li>
        <span class="icon" style="background:${c.color}22">${c.icon}</span>
        <span class="info"><b>${t.note ? esc(t.note) : t.category}</b><small>${t.category} · ${d}</small></span>
        <span class="amt-l ${t.type === 'income' ? 'in' : ''}">${t.type === 'income' ? '+' : '-'}${money(t.amount)}</span>
        <button class="del" data-id="${t.id}" aria-label="Delete transaction">✕</button>
      </li>`;
    }).join('');
  }

  render();
})();
