(function () {
  if (getSession()) { location.href = 'dashboard.html'; return; }

  let role = 'client';
  const tabs = document.querySelectorAll('.tabs button');
  const submit = document.getElementById('submit');
  const error = document.getElementById('error');
  const hint = document.getElementById('hint');

  function setRole(r) {
    role = r;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.role === r));
    submit.textContent = 'Sign in as ' + (r === 'admin' ? 'Admin' : 'Client');
    const demo = USERS.find(u => u.role === r);
    hint.textContent = 'Demo: ' + demo.email + ' / ' + demo.password;
    error.textContent = '';
  }

  tabs.forEach(t => t.addEventListener('click', () => setRole(t.dataset.role)));

  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!email || !password) { error.textContent = 'Enter your email and password.'; return; }
    if (login(email, password, role)) {
      location.href = 'dashboard.html';
    } else {
      error.textContent = 'Incorrect email or password for ' + role + ' login.';
    }
  });

  setRole('client');
})();
