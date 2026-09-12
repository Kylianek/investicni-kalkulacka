/* Přihlášení, registrace, odhlášení a přepínání mezi obrazovkami podle stavu session. */

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authInfo = document.getElementById('auth-info');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const userEmailLabel = document.getElementById('user-email');
const configWarning = document.getElementById('config-warning');

function showAuthMessage(el, text) {
  authError.classList.add('hidden');
  authInfo.classList.add('hidden');
  el.textContent = text;
  el.classList.remove('hidden');
}

function setLoadingButtons(loading) {
  btnLogin.disabled = loading;
  btnRegister.disabled = loading;
}

async function handleLogin(e) {
  e.preventDefault();
  if (!supabaseClient) return;
  setLoadingButtons(true);
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: authEmail.value.trim(),
    password: authPassword.value,
  });
  setLoadingButtons(false);
  if (error) {
    showAuthMessage(authError, translateAuthError(error.message));
  }
}

async function handleRegister(e) {
  e.preventDefault();
  if (!supabaseClient) return;
  setLoadingButtons(true);
  const { data, error } = await supabaseClient.auth.signUp({
    email: authEmail.value.trim(),
    password: authPassword.value,
  });
  setLoadingButtons(false);
  if (error) {
    showAuthMessage(authError, translateAuthError(error.message));
    return;
  }
  if (data.user && !data.session) {
    showAuthMessage(authInfo, 'Registrace proběhla. Zkontroluj svůj e-mail a potvrď účet, pak se přihlas.');
  }
}

async function handleLogout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

function translateAuthError(message) {
  const known = {
    'Invalid login credentials': 'Nesprávný e-mail nebo heslo.',
    'User already registered': 'Uživatel s tímto e-mailem už existuje.',
    'Password should be at least 6 characters': 'Heslo musí mít alespoň 6 znaků.',
    'Email not confirmed': 'E-mail zatím nebyl potvrzen - zkontroluj schránku.',
  };
  return known[message] || message;
}

function showApp(session) {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  userEmailLabel.textContent = session.user.email;
  onAuthReady(session.user);
}

function showAuth() {
  appScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  authForm.reset();
}

function initAuth() {
  if (!supabaseClient) {
    configWarning.classList.remove('hidden');
    return;
  }
  if (SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
    configWarning.classList.remove('hidden');
  }

  authForm.addEventListener('submit', handleLogin);
  btnRegister.addEventListener('click', handleRegister);
  btnLogout.addEventListener('click', handleLogout);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showApp(session);
    } else {
      showAuth();
    }
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
      showApp(data.session);
    } else {
      showAuth();
    }
  });
}

document.addEventListener('DOMContentLoaded', initAuth);
