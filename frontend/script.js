// Global state management
let currentUser = null;
let authToken = localStorage.getItem('budgetAdvisorToken');
// API base URL
const API_BASE = '/api';

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
});

// Initialize page based on current location
function initializePage() {
  const currentPage = window.location.pathname;
  // Check authentication status only if on index.html or root
  if ((currentPage === '/' || currentPage === '/index.html') && authToken) {
    verifyToken();
    return;
  }
  // Page-specific initialization
  if (currentPage === '/' || currentPage === '/index.html') {
    initializeAuthPage();
  } else if (currentPage === '/budget' || currentPage === '/budget.html') {
    initializeBudgetPage();
  } else if (currentPage === '/about' || currentPage === '/about.html') {
    initializeAboutPage();
  }
}

// Verify token validity
async function verifyToken() {
  try {
    const response = await fetch(`${API_BASE}/budget/history`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    // Parse response regardless of status to avoid promise rejections
    const data = await response.json();
    if (response.ok) {
      // Set a placeholder user object (since backend doesn't return user info on this endpoint)
      currentUser = { username: '[Authenticated]' };
      window.location.href = '/budget';
    } else {
      // Token is invalid, clear it
      localStorage.removeItem('budgetAdvisorToken');
      authToken = null;
      currentUser = null;
      initializeAuthPage();
    }
  } catch (error) {
    console.error('Token verification failed:', error);
    localStorage.removeItem('budgetAdvisorToken');
    authToken = null;
    currentUser = null;
    initializeAuthPage();
  }
}

// ===================
// AUTH PAGE FUNCTIONS
// ===================
function initializeAuthPage() {
  console.log('Initializing Auth Page');
  // If already logged in (token set), send to /budget
  if (authToken && currentUser) {
    window.location.href = '/budget';
    return;
  }
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const toggleLink = document.getElementById('toggle-link');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const toggleText = document.getElementById('toggle-text');
  let isLoginMode = true;
  // Toggle between login and register
  if (toggleLink) {
    toggleLink.addEventListener('click', function(e) {
      e.preventDefault();
      isLoginMode = !isLoginMode;
      if (isLoginMode) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authTitle.textContent = 'Welcome Back';
        authSubtitle.textContent = 'Sign in to manage your budget';
        toggleText.innerHTML = 'New user? <a href="#" id="toggle-link">Create an account</a>';
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authTitle.textContent = 'Join Budget Advisor';
        authSubtitle.textContent = 'Create your account to get started';
        toggleText.innerHTML = 'Already have an account? <a href="#" id="toggle-link">Sign in</a>';
      }
      // Re-attach event listener to new toggle link
      document.getElementById('toggle-link').addEventListener('click', arguments.callee);
      clearMessages();
    });
  }
  // Login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  // Register form submission
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) {
    showError('Please fill in all fields');
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (response.ok && data.token && data.user) {
      localStorage.setItem('budgetAdvisorToken', data.token);
      authToken = data.token;
      currentUser = data.user;
      showSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = '/budget';
      }, 1000);
    } else {
      showError(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please try again.');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm').value;
  if (!username || !password || !confirmPassword) {
    showError('Please fill in all fields');
    return;
  }
  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }
  if (password.length < 6) {
    showError('Password must be at least 6 characters long');
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (response.ok) {
      showSuccess('Account created successfully! Please sign in.');
      setTimeout(() => {
        document.getElementById('toggle-link').click();
        document.getElementById('login-username').value = username;
      }, 1500);
    } else {
      showError(data.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showError('Network error. Please try again.');
  }
}

// =====================
// BUDGET PAGE FUNCTIONS
// =====================
function initializeBudgetPage() {
  // Redirect to login if not authenticated
  if (!authToken) {
    window.location.href = '/';
    return;
  }
  // Display username where applicable (populate if user info available)
  const usernameDisplay = document.getElementById('username-display');
  if (usernameDisplay && currentUser && currentUser.username) {
    usernameDisplay.textContent = currentUser.username;
  }
  // Initialize budget form
  const budgetForm = document.getElementById('budget-form');
  if (budgetForm) {
    budgetForm.addEventListener('submit', handleBudgetGeneration);
  }
  // Initialize action buttons
  const createNewBtn = document.getElementById('create-new-btn');
  const viewHistoryBtn = document.getElementById('view-history-btn');
  const backToFormBtn = document.getElementById('back-to-form-btn');
  const logoutLink = document.getElementById('logout-link');
  if (createNewBtn) {
    createNewBtn.addEventListener('click', () => showCard('budget-form-card'));
  }
  if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', loadBudgetHistory);
  }
  if (backToFormBtn) {
    backToFormBtn.addEventListener('click', () => showCard('budget-form-card'));
  }
  if (logoutLink) {
    logoutLink.addEventListener('click', handleLogout);
  }
}

async function handleBudgetGeneration(e) {
  e.preventDefault();
  const salary = parseFloat(document.getElementById('salary').value);
  const notes = document.getElementById('notes').value.trim();
  // Get selected spending categories
  const spendingCheckboxes = document.querySelectorAll('input[name="spending"]:checked');
  const spendingCategories = Array.from(spendingCheckboxes).map(cb => cb.value);
  // Get selected saving options
  const savingCheckboxes = document.querySelectorAll('input[name="saving"]:checked');
  const savingOptions = Array.from(savingCheckboxes).map(cb => cb.value);
  if (!salary || salary <= 0) {
    showError('Please enter a valid salary amount');
    return;
  }
  if (spendingCategories.length === 0) {
    showError('Please select at least one spending category');
    return;
  }
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE}/budget/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ salary, spendingCategories, savingOptions, notes })
    });
    const data = await response.json();
    if (response.ok) {
      displayBudgetResult(data.budgetPlan);
    } else {
      showError(data.error || 'Failed to generate budget plan');
    }
  } catch (error) {
    console.error('Budget generation error:', error);
    showError('Network error. Please try again.');
  } finally {
    showLoading(false);
  }
}

async function loadBudgetHistory() {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE}/budget/history`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    if (response.ok) {
      displayBudgetHistory(data.history);
    } else {
      showError(data.error || 'Failed to load budget history');
    }
  } catch (error) {
    console.error('History loading error:', error);
    showError('Network error. Please try again.');
  } finally {
    showLoading(false);
  }
}

// Display budget result
function displayBudgetResult(budgetPlan) {
  const resultContent = document.getElementById('budget-result-content');
  if (resultContent) {
    resultContent.textContent = budgetPlan;
  }
  showCard('budget-result-card');
}

// Display budget history
function displayBudgetHistory(history) {
  const historyContent = document.getElementById('budget-history-content');
  if (!historyContent) return;
  if (history.length === 0) {
    historyContent.innerHTML = '... No budget history found. Create your first budget plan!';
  } else {
    const historyHtml = history.map(item => {
      const date = new Date(item.created_at).toLocaleDateString();
      const spendingCategories = JSON.parse(item.spending_categories || '[]').join(', ');
      const savingOptions = JSON.parse(item.saving_options || '[]').join(', ');
      return `
        <div class="history-item">
          <h4>Date: ${date}</h4>
          <div class="history-meta">
            <strong>Salary:</strong> $${item.salary}<br>
            <strong>Spending:</strong> ${spendingCategories}<br>
            <strong>Savings:</strong> ${savingOptions}<br>
            <strong>Notes:</strong> ${item.notes || 'None'}
          </div>
          <div class="history-content">${item.ai_response}</div>
        </div>
      `;
    }).join('');
    historyContent.innerHTML = historyHtml;
  }
  showCard('budget-history-card');
}

// Show one card, hide others (utility for switching between sections)
function showCard(cardId) {
  const allCards = document.querySelectorAll('.budget-card, .auth-card');
  allCards.forEach(card => card.classList.add('hidden'));
  const activeCard = document.getElementById(cardId);
  if (activeCard) activeCard.classList.remove('hidden');
}

// Logout
function handleLogout() {
  localStorage.removeItem('budgetAdvisorToken');
  authToken = null;
  currentUser = null;
  window.location.href = '/';
}

// Loading indicator logic
function showLoading(show) {
  const loadingElement = document.getElementById('loading-overlay');
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
}

// Error message display logic
function showError(msg) {
  let errBox = document.getElementById('error-message');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'error-message';
    errBox.className = 'error-message';
    document.body.appendChild(errBox);
  }
  errBox.textContent = msg;
  errBox.style.display = 'block';
  setTimeout(() => { errBox.style.display = 'none'; }, 4000);
}

// Success message display logic
function showSuccess(msg) {
  let succBox = document.getElementById('success-message');
  if (!succBox) {
    succBox = document.createElement('div');
    succBox.id = 'success-message';
    succBox.className = 'success-message';
    document.body.appendChild(succBox);
  }
  succBox.textContent = msg;
  succBox.style.display = 'block';
  setTimeout(() => { succBox.style.display = 'none'; }, 4000);
}

function clearMessages() {
  const errBox = document.getElementById('error-message');
  const succBox = document.getElementById('success-message');
  if (errBox) errBox.style.display = 'none';
  if (succBox) succBox.style.display = 'none';
}

// About page init — no-op, for completeness
function initializeAboutPage() {}
