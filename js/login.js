(async function () {
  if (await getSession()) { location.href = 'dashboard.html'; return; }

  let role = 'client';
  const tabs = document.querySelectorAll('.tabs button');
  const submit = document.getElementById('submit');
  const error = document.getElementById('error');

  function setRole(r) {
    role = r;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.role === r));
    submit.textContent = 'Sign in as ' + (r === 'admin' ? 'Admin' : 'Client');
    error.textContent = '';
  }

  tabs.forEach(t => t.addEventListener('click', () => setRole(t.dataset.role)));

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!email || !password) { error.textContent = 'Enter your email and password.'; return; }

    submit.disabled = true;
    submit.textContent = 'Signing in…';
    const res = await login(email, password, role);
    if (res.error) {
      setRole(role);
      error.textContent = res.error;
      submit.disabled = false;
      return;
    }
    location.href = 'dashboard.html';
  });

  setRole('client');
})();
