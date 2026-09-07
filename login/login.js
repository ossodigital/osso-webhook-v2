const loginForm = document.getElementById("loginForm");
const recoveryForm = document.getElementById("recoveryForm");
const passwordForm = document.getElementById("passwordForm");
const message = document.getElementById("message");
const client = await window.ossoAuth.getClient();

function show(form, text = "", success = false) {
  [loginForm, recoveryForm, passwordForm].forEach(item => item.classList.toggle("hidden", item !== form));
  message.textContent = text;
  message.classList.toggle("success", success);
}

client.auth.onAuthStateChange(event => {
  if (event === "PASSWORD_RECOVERY") show(passwordForm);
});

const session = await window.ossoAuth.getSession();
if (session && !location.hash) location.replace("/dashboard");

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  message.textContent = "Entrando...";
  const { error } = await client.auth.signInWithPassword({
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  });
  if (error) return show(loginForm, "E-mail ou senha inválidos.");
  location.replace("/dashboard");
});

document.getElementById("forgotButton").addEventListener("click", () => show(recoveryForm));
document.getElementById("backButton").addEventListener("click", () => show(loginForm));
recoveryForm.addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("recoveryEmail").value.trim();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` });
  show(recoveryForm, error ? error.message : "Se o e-mail estiver cadastrado, enviaremos o link de recuperação.", !error);
});
passwordForm.addEventListener("submit", async event => {
  event.preventDefault();
  const { error } = await client.auth.updateUser({ password: document.getElementById("newPassword").value });
  if (error) return show(passwordForm, error.message);
  await client.auth.signOut();
  show(loginForm, "Senha atualizada. Entre novamente.", true);
});
