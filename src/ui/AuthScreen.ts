import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'signup' | 'recovery';

export class AuthScreen {
  private mode: AuthMode = 'login';
  private readonly root: HTMLElement;
  private busy = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
  }

  private render(): void {
    const page = document.createElement('main');
    page.style.cssText = 'min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:radial-gradient(ellipse at top,#252044 0%,#10131d 55%,#090b11 100%);color:#f8fafc;font-family:Arial,sans-serif;';
    const card = document.createElement('section');
    card.style.cssText = 'width:min(420px,100%);box-sizing:border-box;padding:28px;border:1px solid #554477;border-radius:14px;background:#151923;box-shadow:0 18px 60px #0008;';
    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'KILL CULT MMO';
    eyebrow.style.cssText = 'margin:0 0 8px;color:#b69aff;font-size:.75rem;font-weight:800;letter-spacing:.2em;text-align:center;';
    const title = document.createElement('h1');
    title.textContent = this.mode === 'signup' ? 'CRIAR CONTA' : this.mode === 'recovery' ? 'RECUPERAR SENHA' : 'ENTRAR';
    title.style.cssText = 'margin:0 0 8px;text-align:center;font-size:1.8rem;';
    const subtitle = document.createElement('p');
    subtitle.textContent = this.mode === 'signup'
      ? 'Crie sua conta para começar sua jornada.'
      : this.mode === 'recovery'
        ? 'Informe seu e-mail para receber o link de recuperação.'
        : 'Entre na sua conta para continuar.';
    subtitle.style.cssText = 'margin:0 0 22px;color:#aeb8c8;text-align:center;line-height:1.5;font-size:.9rem;';
    const form = document.createElement('form');
    form.style.cssText = 'display:grid;gap:12px;';
    const makeField = (labelText: string, type: string, placeholder: string, autocomplete: string): HTMLInputElement => {
      const label = document.createElement('label');
      label.textContent = labelText;
      label.style.cssText = 'display:grid;gap:6px;color:#dbe2ef;font-size:.85rem;font-weight:700;';
      const input = document.createElement('input');
      input.type = type;
      input.placeholder = placeholder;
      input.autocomplete = autocomplete;
      input.required = true;
      input.style.cssText = 'width:100%;box-sizing:border-box;padding:12px;border:1px solid #465064;border-radius:8px;background:#0d111a;color:#fff;font:inherit;outline-color:#a78bfa;';
      label.append(input);
      form.append(label);
      return input;
    };

    let nickname: HTMLInputElement | null = null;
    if (this.mode === 'signup') nickname = makeField('Nickname (3 a 20 caracteres)', 'text', 'Seu nome no jogo', 'username');
    const email = makeField('E-mail', 'email', 'voce@exemplo.com', 'email');
    let password: HTMLInputElement | null = null;
    let confirmation: HTMLInputElement | null = null;
    if (this.mode !== 'recovery') {
      password = makeField('Senha', 'password', 'Mínimo de 8 caracteres', this.mode === 'signup' ? 'new-password' : 'current-password');
      password.minLength = 8;
    }
    if (this.mode === 'signup') {
      confirmation = makeField('Confirmar senha', 'password', 'Digite a senha novamente', 'new-password');
      confirmation.minLength = 8;
    }

    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'status');
    feedback.style.cssText = 'min-height:18px;margin:2px 0;color:#fbbf24;font-size:.85rem;line-height:1.4;';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = this.mode === 'signup' ? 'CRIAR CONTA' : this.mode === 'recovery' ? 'ENVIAR LINK' : 'ENTRAR';
    submit.style.cssText = 'padding:12px;border:1px solid #9b7be8;border-radius:8px;background:#6541a5;color:#fff;font-weight:800;cursor:pointer;';
    form.append(feedback, submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (this.busy || !supabase) return;
      const emailValue = email.value.trim();
      this.busy = true;
      submit.disabled = true;
      submit.textContent = 'AGUARDE...';
      feedback.style.color = '#fbbf24';
      feedback.textContent = '';

      try {
        if (this.mode === 'signup') {
          const nicknameValue = nickname?.value.trim() ?? '';
          const passwordValue = password?.value ?? '';
          if (!/^[a-zA-Z0-9_]{3,20}$/.test(nicknameValue)) {
            throw new Error('Use um nickname de 3 a 20 caracteres: letras, números e _.');
          }
          if (passwordValue.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
          if (passwordValue !== confirmation?.value) throw new Error('As senhas não coincidem.');
          const { data, error } = await supabase.auth.signUp({
            email: emailValue,
            password: passwordValue,
            options: { data: { nickname: nicknameValue, display_name: nicknameValue } },
          });
          if (error) throw error;
          feedback.style.color = '#86efac';
          feedback.textContent = data.session
            ? 'Conta criada! Preparando sua base...'
            : 'Cadastro recebido! Confirme seu e-mail pelo link enviado para ativar a conta.';
        } else if (this.mode === 'login') {
          const { error } = await supabase.auth.signInWithPassword({
            email: emailValue,
            password: password?.value ?? '',
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.resetPasswordForEmail(emailValue);
          if (error) throw error;
          feedback.style.color = '#86efac';
          feedback.textContent = 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.';
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
        const duplicate = /profiles_nickname_lower_unique|duplicate key|already exists/i.test(message);
        feedback.textContent = duplicate ? 'Esse nickname já está em uso. Escolha outro.' : message;
      } finally {
        this.busy = false;
        submit.disabled = false;
        submit.textContent = this.mode === 'signup' ? 'CRIAR CONTA' : this.mode === 'recovery' ? 'ENVIAR LINK' : 'ENTRAR';
      }
    });

    const links = document.createElement('div');
    links.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:8px 16px;margin-top:18px;';
    const addLink = (label: string, mode: AuthMode): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = 'padding:4px;border:0;background:transparent;color:#c4b5fd;text-decoration:underline;cursor:pointer;font-size:.85rem;';
      button.addEventListener('click', () => { this.mode = mode; this.render(); });
      links.append(button);
    };
    if (this.mode === 'login') {
      addLink('Criar conta', 'signup');
      addLink('Esqueci minha senha', 'recovery');
    } else {
      addLink('Voltar ao login', 'login');
    }

    card.append(eyebrow, title, subtitle, form, links);
    page.append(card);
    this.root.replaceChildren(page);
  }
}
