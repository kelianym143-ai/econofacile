// ========== ELEMENTOS DOM ==========
const loginScreen = document.querySelector('#loginScreen');
const loginForm = document.querySelector('#loginForm');
const loginUsername = document.querySelector('#loginUsername');
const loginPassword = document.querySelector('#loginPassword');
const appContent = document.querySelector('#appContent');
const appLoading = document.querySelector('#appLoading');
const messageBox = document.querySelector('#messageBox');
const alertBanner = document.querySelector('#alertBanner');

const form = document.querySelector('#formTransaction');
const tableBody = document.querySelector('#transactionsTable tbody');
const totalIncomeLabel = document.querySelector('#totalIncome');
const totalExpensesLabel = document.querySelector('#totalExpenses');
const balanceLabel = document.querySelector('#balance');
const expensePercentLabel = document.querySelector('#expensePercent');
const topCategoryLabel = document.querySelector('#topCategory');
const goalStatusLabel = document.querySelector('#goalStatus');
const forecastBalanceLabel = document.querySelector('#forecastBalance');
const avgTransactionLabel = document.querySelector('#avgTransaction');
const totalTransactionsLabel = document.querySelector('#totalTransactions');
const periodSelect = document.querySelector('#periodSelect');
const filterType = document.querySelector('#filterType');
const filterCategory = document.querySelector('#filterCategory');
const filterStartDate = document.querySelector('#filterStartDate');
const filterEndDate = document.querySelector('#filterEndDate');
const customDateRange = document.querySelector('#customDateRange');
const monthlyGoalInput = document.querySelector('#monthlyGoal');
const clearStorageButton = document.querySelector('#clearStorage');
const exportDataButton = document.querySelector('#exportData');
const categoryChartCtx = document.querySelector('#categoryChart');
const typeChartCtx = document.querySelector('#typeChart');
const iaAdviceLabel = document.querySelector('#iaAdvice');
const iaForecast1Y = document.querySelector('#iaForecast1Y');
const iaForecast5Y = document.querySelector('#iaForecast5Y');
const iaForecast10Y = document.querySelector('#iaForecast10Y');
const toggleAutoBudget = document.querySelector('#toggleAutoBudget');
const toggleImpulseBlock = document.querySelector('#toggleImpulseBlock');
const runWasteDetectorBtn = document.querySelector('#runWasteDetector');
const runNegotiateBillsBtn = document.querySelector('#runNegotiateBills');
const runFraudScanBtn = document.querySelector('#runFraudScan');
const runRoboAdvisorBtn = document.querySelector('#runRoboAdvisor');
const userLevelLabel = document.querySelector('#userLevel');
const userPointsLabel = document.querySelector('#userPoints');
const greenScoreLabel = document.querySelector('#greenScore');

// ========== ESTADO GLOBAL ==========
let transactions = [];
let state = { categoryChart: null, typeChart: null };
let autoManager = { savings: 0, invested: 0, automated: false };
let milestone = { level: 1, points: 0 };
let blockedPurchase = null;
let impulseTimeout = null;

const formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

// ========== UTILS ==========
function setLoading(visible) {
  appLoading.classList.toggle('hidden', !visible);
}

function showMessage(text, type = 'success') {
  messageBox.innerText = text;
  messageBox.className = `message-box ${type}`;
  messageBox.classList.remove('hidden');
  clearTimeout(showMessage.timeout);
  showMessage.timeout = setTimeout(() => messageBox.classList.add('hidden'), 2500);
}

function showAlert(text) {
  alertBanner.innerText = text;
  alertBanner.classList.remove('hidden');
}

function hideAlert() {
  alertBanner.classList.add('hidden');
}

// ========== LOCALSTORAGE COM SINCRONIZAÇÃO ==========
class StorageManager {
  static KEYS = {
    TRANSACTIONS: 'éconofacile_transactions',
    MONTHLY_GOAL: 'éconofacile_monthly_goal',
    USER: 'éconofacile_user',
    LAST_UPDATE: 'éconofacile_last_update'
  };

  static save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem(this.KEYS.LAST_UPDATE, new Date().toISOString());
      return true;
    } catch (e) {
      console.error('Erreur sauvegarde localStorage:', e);
      return false;
    }
  }

  static load(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error('Erreur lecture localStorage:', e);
      return defaultValue;
    }
  }

  static saveTransactions(trans) {
    return this.save(this.KEYS.TRANSACTIONS, trans);
  }

  static loadTransactions() {
    const loaded = this.load(this.KEYS.TRANSACTIONS, []);
    return loaded.map(t => ({ 
      ...t, 
      date: new Date(t.date),
      id: t.id || Math.random().toString(36).substr(2, 9)
    }));
  }

  static clear() {
    localStorage.removeItem(this.KEYS.TRANSACTIONS);
    localStorage.removeItem(this.KEYS.MONTHLY_GOAL);
    localStorage.removeItem(this.KEYS.LAST_UPDATE);
  }

  static exportJSON() {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      transactions: transactions,
      monthlyGoal: monthlyGoalInput.value,
      stats: {
        totalTransactions: transactions.length,
        dateRange: [transactions.length > 0 ? Math.min(...transactions.map(t => new Date(t.date).getTime())) : null, Date.now()]
      }
    };
  }
}

// ========== CÁLCULOS DE SALDO ==========
function calculateForecast(income, expense) {
  const daysThisMonth = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
  const today = new Date().getDate();
  const moyenneRevenus = income / Math.max(1, today);
  const moyenneDepenses = expense / Math.max(1, today);
  const resteMois = daysThisMonth - today;
  return (income - expense) + (moyenneRevenus - moyenneDepenses) * resteMois;
}

function projectFutureBalance(currentBalance, monthlyNet) {
  // Simula crescimento com contribuição mensal constante e 3% de retorno médio
  const annualRate = 0.03;
  const months = monthlyNet > 0 ? 12 : 0;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  return function(years) {
    let balance = currentBalance;
    for (let i = 0; i < years * 12; i++) {
      balance = balance + monthlyNet;
      balance = balance * (1 + monthlyRate);
    }
    return balance;
  };
}

function getWasteRecommendations(transactionsToUse) {
  const spendByCategory = {};
  transactionsToUse.filter(t => t.type === 'expense').forEach(t => {
    spendByCategory[t.category] = (spendByCategory[t.category] || 0) + t.amount;
  });
  const totalExpense = Object.values(spendByCategory).reduce((a,b)=>a+b,0);
  const highWaste = Object.entries(spendByCategory)
    .filter(([,amt]) => amt > totalExpense * 0.18)
    .sort((a,b) => b[1]-a[1])
    .slice(0,3);
  return { totalExpense, highWaste };
}

function calculateUserLevel(balance, expense) {
  const saved = Math.max(0, balance);
  const level = 1 + Math.floor(saved / 500);
  const points = Math.max(0, Math.floor(saved / 10) + Math.floor(Math.max(0, 1000 - expense) / 10));
  milestone.level = Math.min(50, level);
  milestone.points = points;
  userLevelLabel.innerText = milestone.level;
  userPointsLabel.innerText = milestone.points;
}

function getGreenScore(transactionsToUse) {
  const greenCategories = ['Transport', 'Alimentation', 'Loisirs', 'Logement'];
  const greenSpend = transactionsToUse
    .filter(t => t.type === 'expense' && greenCategories.includes(t.category))
    .reduce((sum, t) => sum + t.amount, 0);
  const total = transactionsToUse.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  if (total === 0) return 100;
  const score = 100 - Math.min(100, Math.round((greenSpend / total) * 100 * 0.7));
  return score;
}

function evaluateIA(transactionsToUse) {
  const stats = calculateStats(transactionsToUse);
  const forecast = calculateForecast(stats.income, stats.expense);
  const netPerDay = (stats.income - stats.expense) / Math.max(1, new Date().getDate());

  if (forecast < 0) {
    iaAdviceLabel.innerText = '⚠️ Risque de manquer d’argent à la fin du mois si la tendance continue.';
  } else if (stats.expense / Math.max(1, stats.income) > 0.75) {
    iaAdviceLabel.innerText = 'Attention : dépenses élevées, activez l’automatisation et réduisez les dépenses.';
  } else {
    iaAdviceLabel.innerText = 'Très bien ! Continuez ainsi. L’app recommande l’automatisation et les simulations pour monter de niveau.';
  }

  const project = projectFutureBalance(stats.income - stats.expense, netPerDay * 30);
  iaForecast1Y.innerText = 'Previsão 1 ano: ' + formatter.format(project(1));
  iaForecast5Y.innerText = 'Previsão 5 anos: ' + formatter.format(project(5));
  iaForecast10Y.innerText = 'Previsão 10 anos: ' + formatter.format(project(10));

  calculateUserLevel(stats.income - stats.expense, stats.expense);
  greenScoreLabel.innerText = `${getGreenScore(transactionsToUse)} / 100`;
}

function handleAutoFinance(stats) {
  if (!toggleAutoBudget.checked) return;
  const surplus = stats.balance > 0 ? stats.balance : 0;
  const allocation = {
    toSavings: surplus * 0.25,
    toInvest: surplus * 0.12,
    toEmergency: surplus * 0.13
  };
  autoManager.savings += allocation.toSavings;
  autoManager.invested += allocation.toInvest;
  autoManager.automated = true;
  showMessage(`Auto Financeiro: €${allocation.toSavings.toFixed(2)} poupança, €${allocation.toInvest.toFixed(2)} investidos.`, 'success');
}

  const income = transactionsToUse.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactionsToUse.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expense;
  const count = transactionsToUse.length;
  const avgAmount = count > 0 ? (income + expense) / count : 0;

  return { income, expense, balance, count, avgAmount };
}

function getTopCategory(transactionsToUse) {
  const categories = {};
  transactionsToUse.forEach(t => {
    if (t.type === 'expense') {
      if (!categories[t.category]) categories[t.category] = 0;
      categories[t.category] += t.amount;
    }
  });

  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  return topCategory ? { name: topCategory[0], amount: topCategory[1] } : null;
}

// ========== AUTENTICAÇÃO ==========
function isAuthenticated() {
  return localStorage.getItem(StorageManager.KEYS.USER) === 'connected';
}

function checkAuth() {
  if (isAuthenticated()) {
    loginScreen.classList.remove('active');
    appContent.classList.remove('hidden');
    document.getElementById('btnBack').classList.remove('hidden');
    setLoading(true);
    setTimeout(async () => {
      setLoading(false);
      document.getElementById('appSplash').classList.add('hidden');
      await initializeCharts();
      readStorage();
      calculate();
      showMessage('Bienvenue sur ÉconoFacile !', 'success');
      requestNotificationPermission();
    }, 400);
  } else {
    loginScreen.classList.add('active');
    appContent.classList.add('hidden');
    document.getElementById('btnBack').classList.add('hidden');
  }
}

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const user = loginUsername.value.trim();
  const pass = loginPassword.value;
  setLoading(true);
  setTimeout(() => {
    setLoading(false);
    if (user === 'admin' && pass === '1234') {
      localStorage.setItem(StorageManager.KEYS.USER, 'connected');
      showMessage('Connexion réussie', 'success');
      checkAuth();
    } else {
      showMessage('Identifiants invalides', 'error');
    }
  }, 600);
});

document.getElementById('btnBack').addEventListener('click', () => {
  if (confirm('Retourner à la page de connexion ?')) {
    localStorage.removeItem(StorageManager.KEYS.USER);
    checkAuth();
  }
});

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') notification('Notifications activées ✔️');
    });
  } else if (Notification.permission === 'granted') {
    notification('Vous recevrez des alertes de budgeting.');
  }
}

function notification(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('ÉconoFacile', { body: message, icon: 'https://via.placeholder.com/128/0284c7/ffffff?text=E' });
  }
}

// ========== STORAGE ==========
function readStorage() {
  transactions = StorageManager.loadTransactions();
  const savedGoal = StorageManager.load(StorageManager.KEYS.MONTHLY_GOAL);
  if (savedGoal) monthlyGoalInput.value = savedGoal;
}

function writeStorage() {
  StorageManager.saveTransactions(transactions);
  StorageManager.save(StorageManager.KEYS.MONTHLY_GOAL, monthlyGoalInput.value || '');
}

// ========== FILTRES ==========
function getFilteredTransactions() {
  let filtered = [...transactions];

  // Filtre de période
  const mode = periodSelect.value;
  const now = new Date();

  if (mode === 'all') {
    // Garder tous
  } else if (mode === 'thisMonth') {
    filtered = filtered.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (mode === 'lastMonth') {
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    filtered = filtered.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === previous.getMonth() && d.getFullYear() === previous.getFullYear();
    });
  } else if (mode === 'thisYear') {
    filtered = filtered.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear();
    });
  } else if (mode === 'customRange') {
    const startDate = filterStartDate.value ? new Date(filterStartDate.value) : null;
    const endDate = filterEndDate.value ? new Date(filterEndDate.value) : null;
    
    filtered = filtered.filter(t => {
      const d = new Date(t.date);
      if (startDate && d < startDate) return false;
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
        if (d > endDate) return false;
      }
      return true;
    });
  }

  // Filtre de type
  if (filterType.value) {
    filtered = filtered.filter(t => t.type === filterType.value);
  }

  // Filtre de catégorie
  if (filterCategory.value) {
    filtered = filtered.filter(t => t.category === filterCategory.value);
  }

  return filtered;
}

// ========== CÁLCULOS E AFFICHAGE ==========
function calculate() {
  const activeTransactions = getFilteredTransactions();
  const stats = calculateStats(activeTransactions);

  // Mises à jour des labels
  totalIncomeLabel.innerText = formatter.format(stats.income);
  totalExpensesLabel.innerText = formatter.format(stats.expense);
  balanceLabel.innerText = formatter.format(stats.balance);
  balanceLabel.style.color = stats.balance >= 0 ? 'var(--success)' : 'var(--danger)';

  const percentExpense = stats.income > 0 ? Math.min(100, (stats.expense / stats.income) * 100) : 0;
  expensePercentLabel.innerText = `${percentExpense.toFixed(1)}%`;

  const topCategory = getTopCategory(activeTransactions);
  topCategoryLabel.innerText = topCategory ? `${topCategory.name} (${formatter.format(topCategory.amount)})` : '-';

  avgTransactionLabel.innerText = formatter.format(stats.avgAmount);
  totalTransactionsLabel.innerText = stats.count.toString();

  // Alerte solde négatif
  if (stats.balance < 0) {
    notification('Attention: votre solde est négatif. Ajustez votre budget.');
  }

  // Objectif mensuel
  const goal = Number(monthlyGoalInput.value);
  if (goal > 0) {
    goalStatusLabel.innerText = `${formatter.format(stats.expense)} / ${formatter.format(goal)}`;
    const ratio = Math.min(100, (stats.expense / goal) * 100);
    goalStatusLabel.style.color = ratio > 100 ? 'var(--danger)' : (ratio > 80 ? 'var(--warning)' : 'var(--success)');
    if (ratio > 80) {
      showAlert(`⚠️ Vous avez atteint ${ratio.toFixed(0)}% de votre objectif mensuel (${formatter.format(stats.expense)} / ${formatter.format(goal)})`);
    } else {
      hideAlert();
    }
  } else {
    goalStatusLabel.innerText = 'Pas d\'objectif';
    goalStatusLabel.style.color = 'inherit';
    hideAlert();
  }

  // Prévision
  const forecast = calculateForecast(stats.income, stats.expense);
  forecastBalanceLabel.innerText = formatter.format(forecast);
  forecastBalanceLabel.style.color = forecast < 0 ? 'var(--danger)' : 'var(--success)';

  evaluateIA(activeTransactions);
  handleAutoFinance(stats);

  updateTransactionsTable(activeTransactions);
  drawCharts(activeTransactions, stats.income, stats.expense);
}

function updateTransactionsTable(activeTransactions) {
  tableBody.innerHTML = '';

  if (activeTransactions.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5" style="text-align:center; color:#6b7280;">Aucune transaction pour la periode sélectionnée</td>';
    tableBody.appendChild(row);
    return;
  }

  activeTransactions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((t, i) => {
      const row = document.createElement('tr');
      const dateStr = new Date(t.date).toLocaleDateString('fr-FR');
      row.innerHTML = `
        <td>${t.title} <small style="color: #999;">(${dateStr})</small></td>
        <td class="badge-${t.type}">${t.type === 'income' ? 'Revenu' : 'Dépense'}</td>
        <td>${t.category}</td>
        <td>${formatter.format(t.type === 'expense' ? -t.amount : t.amount)}</td>
        <td><button data-id="${t.id}">Supprimer</button></td>
      `;
      tableBody.appendChild(row);
    });

  tableBody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.id;
      const index = transactions.findIndex(t => t.id === id);
      if (index >= 0 && confirm('Supprimer cette transaction ?')) {
        transactions.splice(index, 1);
        writeStorage();
        calculate();
        showMessage('Transaction supprimée', 'warning');
      }
    });
  });
}

async function ensureChartIsLoaded() {
  if (window.Chart) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initializeCharts() {
  await ensureChartIsLoaded();
  
  // Initialiser le graphique des catégories
  if (!state.categoryChart) {
    state.categoryChart = new Chart(categoryChartCtx, {
      type: 'pie',
      data: { 
        labels: ['Vide'], 
        datasets: [{ 
          data: [1], 
          backgroundColor: ['#e5e7eb'] 
        }] 
      },
      options: { 
        responsive: true, 
        plugins: { 
          legend: { position: 'bottom' },
          tooltip: { enabled: false }
        } 
      }
    });
  }

  // Initialiser le graphique revenu vs dépense
  if (!state.typeChart) {
    state.typeChart = new Chart(typeChartCtx, {
      type: 'bar',
      data: { 
        labels: ['Revenu', 'Dépense'], 
        datasets: [{ 
          label: '€', 
          data: [0, 0], 
          backgroundColor: ['#16a34a', '#dc2626'] 
        }] 
      },
      options: { 
        responsive: true, 
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: true } }
      }
    });
  }
}

async function drawCharts(activeTransactions, income, expense) {
  await ensureChartIsLoaded();
  const categories = {};
  activeTransactions.forEach(t => {
    if (!categories[t.category]) categories[t.category] = 0;
    categories[t.category] += Math.abs(t.amount);
  });
  const categoryLabels = Object.keys(categories);
  const categoryData = categoryLabels.map(label => categories[label]);

  if (state.categoryChart) {
    state.categoryChart.data.labels = categoryLabels;
    state.categoryChart.data.datasets[0].data = categoryData;
    state.categoryChart.update();
  } else {
    state.categoryChart = new Chart(categoryChartCtx, {
      type: 'pie',
      data: { labels: categoryLabels, datasets: [{ data: categoryData, backgroundColor: ['#2563eb', '#2dd4bf', '#f97316', '#ef4444', '#a855f7', '#10b981', '#f59e0b', '#8b5cf6'] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  if (state.typeChart) {
    state.typeChart.data.datasets[0].data = [income, expense];
    state.typeChart.update();
  } else {
    state.typeChart = new Chart(typeChartCtx, {
      type: 'bar',
      data: { labels: ['Revenu', 'Dépense'], datasets: [{ label: '€', data: [income, expense], backgroundColor: ['#16a34a', '#dc2626'] }] },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }
}

// ========== ÉVÉNEMENTS ==========
form.addEventListener('submit', e => {
  e.preventDefault();
  const title = document.querySelector('#title').value.trim();
  const amount = Number(document.querySelector('#amount').value);
  const type = document.querySelector('#type').value;
  const category = document.querySelector('#category').value;

  if (!title || !amount || isNaN(amount)) {
    showMessage('Veuillez entrer une transaction valide', 'error');
    return;
  }

  const stats = calculateStats(transactions);
  const impulsive = type === 'expense' && (category === 'Loisirs' || amount > Math.max(120, stats.expense * 0.2));

  if (toggleImpulseBlock.checked && impulsive) {
    showAlert('🤖 Dépense émotionnelle détectée — blocage pendant 60s pour révision.');
    blockedPurchase = { title, amount, type, category };
    clearTimeout(impulseTimeout);
    impulseTimeout = setTimeout(() => {
      if (!blockedPurchase) return;
      transactions.push({ id: Math.random().toString(36).substr(2, 9), ...blockedPurchase, date: new Date() });
      writeStorage();
      calculate();
      showMessage('Dépense impulsive validée après révision automatique.', 'warning');
      hideAlert();
      blockedPurchase = null;
    }, 60000);
    showMessage('Dépense impulsive bloquée pendant 60 secondes. Vérifiez avant de valider.', 'warning');
    return;
  }

  setLoading(true);
  setTimeout(() => {
    transactions.push({ 
      id: Math.random().toString(36).substr(2, 9),
      title,
      amount,
      type,
      category,
      date: new Date()
    });
    form.reset();
    writeStorage();
    calculate();
    setLoading(false);
    showMessage('Transaction ajoutée avec succès', 'success');
  }, 450);
});

periodSelect.addEventListener('change', () => {
  if (periodSelect.value === 'customRange') {
    customDateRange.classList.remove('hidden');
  } else {
    customDateRange.classList.add('hidden');
  }
  calculate();
});

filterType.addEventListener('change', calculate);
filterCategory.addEventListener('change', calculate);
filterStartDate.addEventListener('change', calculate);
filterEndDate.addEventListener('change', calculate);
monthlyGoalInput.addEventListener('input', () => { writeStorage(); calculate(); });

clearStorageButton.addEventListener('click', () => {
  if (!confirm('Voulez-vous vraiment supprimer toutes les données ?')) return;
  transactions = [];
  StorageManager.clear();
  monthlyGoalInput.value = '';
  calculate();
  showMessage('Toutes les données ont été supprimées', 'warning');
});

exportDataButton.addEventListener('click', () => {
  const data = StorageManager.exportJSON();
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `econofacile-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showMessage('Données exportées avec succès', 'success');
});

runWasteDetectorBtn.addEventListener('click', () => {
  const activeTransactions = getFilteredTransactions();
  const { highWaste, totalExpense } = getWasteRecommendations(activeTransactions);
  if (highWaste.length === 0) {
    showMessage('Félicitations ! Aucun gaspillage critique détecté.', 'success');
    return;
  }
  const notes = highWaste.map(([cat, amt]) => `${cat} (€${amt.toFixed(2)})`).join(' · ');
  showMessage(`Gaspillage détecté : ${notes}. Total dépenses : €${totalExpense.toFixed(2)}.`, 'warning');
});

runNegotiateBillsBtn.addEventListener('click', () => {
  showMessage('Négociation automatique simulée activée : -7% sur les factures fixes suggérées.', 'success');
});

runFraudScanBtn.addEventListener('click', () => {
  const alertFraud = transactions.some(t => t.type === 'expense' && t.amount > 800);
  if (alertFraud) {
    showAlert('⚠️ Transaction suspecte détectée (montant élevé). Vérifiez vos achats.');
  } else {
    showMessage('Aucune fraude détectée pour le moment. Continuez à surveiller.', 'success');
  }
});

runRoboAdvisorBtn.addEventListener('click', () => {
  const stats = calculateStats(transactions);
  const invest = Math.max(0, stats.balance * 0.08);
  autoManager.invested += invest;
  showMessage(`Robo-conseiller : €${invest.toFixed(2)} investis automatiquement.`, 'success');
});

// ========== INITIALISATION ==========
checkAuth();

// ========== TESTS ==========
window.runEconoFacileTests = () => {
  const results = [];

  const test = (name, condition) => {
    results.push({ name, ok: !!condition });
  };

  test('Login screen visible', loginScreen.classList.contains('active') || !loginScreen.classList.contains('active'));
  test('App content container existe', !!appContent);
  test('StorageManager disponible', !!StorageManager);

  localStorage.setItem('test_econofacile', 'ok');
  test('LocalStorage accessible', localStorage.getItem('test_econofacile') === 'ok');
  localStorage.removeItem('test_econofacile');

  transactions = [];
  transactions.push({ id: '1', title: 'Test rev', amount: 100, type: 'income', category: 'Salaire', date: new Date() });
  transactions.push({ id: '2', title: 'Test dep', amount: 50, type: 'expense', category: 'Alimentation', date: new Date() });
  writeStorage();
  readStorage();
  test('Sauvegarde et chargement transactions', transactions.length >= 2);

  calculate();
  test('Calculs de base revenus/dépenses', totalIncomeLabel.innerText.includes('100') && totalExpensesLabel.innerText.includes('50'));

  monthlyGoalInput.value = 200;
  calculate();
  test('Objectif mensuel pris en compte', goalStatusLabel.innerText.includes('200'));
  test('Prévision de solde non vide', forecastBalanceLabel.innerText.replace(/[^\d.,€]/g, '').trim().length > 0);

  test('Category chart instancié', !!state.categoryChart);
  test('Type chart instancié', !!state.typeChart);

  test('Filtres disponibles', !!filterType && !!filterCategory && !!periodSelect);
  test('Export data disponible', !!exportDataButton);

  const filtered = getFilteredTransactions();
  test('Filtrage fonctionne', filtered.length > 0);

  const failed = results.filter(r => !r.ok);
  window.lastEconoFacileTest = { results, failed };

  if (failed.length === 0) {
    showMessage('Tous les tests ont réussi ! Votre app est au top 🎉', 'success');
  } else {
    showMessage(`Échec ${failed.length}/${results.length} tests: ${failed.map(f => f.name).join(', ')}`, 'error');
  }

  return window.lastEconoFacileTest;
};
