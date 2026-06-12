/**
 * ChatWidget - Embeddable chat widget for websites
 * Include in your site: <script src="https://yourserver.com/chat-widget.js"></script>
 * Then initialize: ChatWidget.init({ apiUrl: 'https://your-api.com', apiKey: 'your-key' })
 */

(function () {
  const I18N = {
    th: {
      title: 'PK Supply Chain',
      subtitle: 'ออนไลน์ — ตอบกลับทันที',
      placeholder: 'พิมพ์ข้อความ...',
      leadButton: 'ฝากชื่อและอีเมล',
      leadMessage: 'ต้องการฝากชื่อและอีเมลให้ทีมงานติดต่อกลับ',
      welcome: 'สวัสดีครับ เราเป็นผู้ช่วยของ PK Supply Chain สอบถามเรื่องบริการระบบลำเลียงหรือฝากข้อมูลให้ทีมงานติดต่อกลับได้เลยครับ',
      apiMissing: 'ยังไม่ได้ตั้งค่า API กรุณาตั้งค่า apiUrl ใน ChatWidget.init()',
      apiError: 'เชื่อมต่อบริการแชทไม่ได้ กรุณาลองอีกครั้งครับ'
    },
    en: {
      title: 'PK Supply Chain',
      subtitle: 'Online — quick reply',
      placeholder: 'Type a message...',
      leadButton: 'Leave name and email',
      leadMessage: 'I would like to leave my name and email for the team to contact me.',
      welcome: 'Hello, we are the PK Supply Chain assistant. Ask about conveyor services or leave your details for our team to contact you.',
      apiMissing: 'API is not configured. Please set apiUrl in ChatWidget.init().',
      apiError: 'Could not connect to the chat service. Please try again.'
    }
  };

  const ChatWidget = {
    config: {
      apiUrl: null,
      apiKey: null,
      position: 'bottom-left',
      language: 'th',
      width: '366px',
      height: '560px',
      allowedDomain: 'pksupplychain.com',
      brandPrimary: '#B80000',
      brandDark: '#1D2338',
      logoUrl: null
    },

    state: {
      isOpen: false,
      messages: [],
      sessionId: null,
      typingEl: null,
      language: 'th'
    },

    init(options = {}) {
      this.config = { ...this.config, ...options };
      this.state = { isOpen: false, messages: [], sessionId: null, typingEl: null, language: this.config.language === 'en' ? 'en' : 'th', isSending: false };

      const currentDomain = window.location.hostname;
      if (!currentDomain.includes(this.config.allowedDomain) && !currentDomain.includes('localhost')) {
        console.warn('Chat Widget: Domain not authorized. Only works on pksupplychain.com');
        return;
      }

      document.querySelector('#chat-widget-container')?.remove();
      this.ensureStyles();
      this.state.sessionId = this.generateSessionId();
      this.createWidget();
      this.attachEventListeners();
      console.log('PK Supply Chain Chat Widget initialized');
    },

    t(key) {
      return I18N[this.state.language][key] || I18N.th[key] || key;
    },

    ensureStyles() {
      if (document.querySelector('#chat-widget-styles')) return;

      const style = document.createElement('style');
      style.id = 'chat-widget-styles';
      style.textContent = `
        @keyframes pkTypingPulse {
          0%, 80%, 100% { opacity: .28; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }

        #chat-widget-container, #chat-widget-container * {
          box-sizing: border-box;
        }

        #chat-widget-container button,
        #chat-widget-container input {
          font-family: inherit;
        }

        .pk-lang-button {
          border: 0;
          border-radius: 999px;
          padding: 5px 8px;
          background: transparent;
          color: rgba(255,255,255,.72);
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
        }

        .pk-lang-button.is-active {
          background: #fff;
          color: #1D2338;
        }

        .pk-typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6b7280;
          display: inline-block;
          animation: pkTypingPulse 1.05s infinite ease-in-out;
        }

        .pk-typing-dot:nth-child(2) { animation-delay: .14s; }
        .pk-typing-dot:nth-child(3) { animation-delay: .28s; }
      `;
      document.head.appendChild(style);
    },

    createWidget() {
      const logoUrl = this.config.logoUrl || `${this.config.apiUrl || ''}/pk-logo.png`;
      const isLeft = this.config.position === 'bottom-left';

      const container = document.createElement('div');
      container.id = 'chat-widget-container';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        ${isLeft ? 'left: 24px;' : 'right: 24px;'}
        font-family: Poppins, 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        z-index: 9999;
      `;

      const launcher = document.createElement('button');
      launcher.id = 'chat-widget-bubble';
      launcher.setAttribute('aria-label', 'Open chat');
      launcher.innerHTML = `
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.3 8.9 8.9 0 0 1-4.2-1.1L3 20l1.3-4.2A8.2 8.2 0 0 1 3 11.5a8.5 8.5 0 0 1 18 0Z"></path>
        </svg>
      `;
      launcher.style.cssText = `
        width: 58px;
        height: 58px;
        border-radius: 50%;
        border: 4px solid rgba(184, 0, 0, 0.12);
        background: ${this.config.brandPrimary};
        color: #fff;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(29, 35, 56, 0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        padding: 0;
      `;

      launcher.addEventListener('mouseenter', () => {
        launcher.style.transform = 'translateY(-2px)';
        launcher.style.boxShadow = '0 10px 24px rgba(29, 35, 56, 0.22)';
      });
      launcher.addEventListener('mouseleave', () => {
        launcher.style.transform = 'translateY(0)';
        launcher.style.boxShadow = '0 8px 18px rgba(29, 35, 56, 0.18)';
      });
      launcher.addEventListener('click', () => this.toggleWidget());

      const chatWindow = document.createElement('div');
      chatWindow.id = 'chat-widget-window';
      chatWindow.style.cssText = `
        position: absolute;
        bottom: 74px;
        ${isLeft ? 'left: 0;' : 'right: 0;'}
        width: min(${this.config.width}, calc(100vw - 28px));
        height: min(${this.config.height}, calc(100vh - 118px));
        background: #f6f7fb;
        border-radius: 20px;
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22);
        display: none;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.08);
      `;

      const header = document.createElement('div');
      header.style.cssText = `
        background: ${this.config.brandDark};
        color: white;
        height: 50px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      `;
      header.innerHTML = `
        <div style="
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          overflow: hidden;
        ">
          <img src="${logoUrl}" alt="PK Supply Chain" style="width: 29px; height: 22px; object-fit: contain;" />
        </div>
        <div style="min-width: 0; flex: 1 1 auto;">
          <div data-chat-title style="font-weight: 800; font-size: 14px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.t('title')}</div>
          <div style="display: flex; align-items: center; gap: 5px; font-size: 11px; line-height: 1.25; color: rgba(255,255,255,0.78); white-space: nowrap; overflow: hidden;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #18d47a; display: inline-block; flex: 0 0 auto;"></span>
            <span data-chat-subtitle style="overflow: hidden; text-overflow: ellipsis;">${this.t('subtitle')}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex: 0 0 auto;">
          <div style="border: 1px solid rgba(255,255,255,0.32); border-radius: 999px; padding: 3px; display: flex; line-height: 1;">
            <button type="button" data-chat-lang="th" class="pk-lang-button">TH</button>
            <button type="button" data-chat-lang="en" class="pk-lang-button">EN</button>
          </div>
          <button id="chat-widget-close" aria-label="Close chat" style="
            background: none;
            border: none;
            color: rgba(255,255,255,0.72);
            cursor: pointer;
            font-size: 26px;
            line-height: 1;
            padding: 0;
            width: 22px;
            height: 22px;
            flex: 0 0 auto;
          ">&times;</button>
        </div>
      `;

      const messagesContainer = document.createElement('div');
      messagesContainer.id = 'chat-widget-messages';
      messagesContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f6f7fb;
      `;

      const inputArea = document.createElement('div');
      inputArea.style.cssText = `
        padding: 10px 14px 14px;
        border-top: 1px solid #e1e5ee;
        background: #fff;
        flex: 0 0 auto;
      `;

      const leadButton = document.createElement('button');
      leadButton.type = 'button';
      leadButton.setAttribute('data-chat-lead', 'true');
      leadButton.textContent = this.t('leadButton');
      leadButton.style.cssText = `
        width: 100%;
        height: 32px;
        border-radius: 999px;
        border: 1px dashed #d8dde8;
        background: #fff;
        color: ${this.config.brandDark};
        cursor: pointer;
        font-size: 12px;
        margin-bottom: 8px;
      `;
      leadButton.addEventListener('click', () => {
        this.sendMessage(this.t('leadMessage'), messagesContainer, input);
      });

      const inputRow = document.createElement('div');
      inputRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;

      const input = document.createElement('input');
      input.id = 'chat-widget-input';
      input.type = 'text';
      input.placeholder = this.t('placeholder');
      input.style.cssText = `
        flex: 1;
        min-width: 0;
        height: 36px;
        border: 1px solid #d7dce7;
        border-radius: 999px;
        padding: 0 16px;
        font-size: 13px;
        outline: none;
        background: #fbfcff;
        transition: border-color 0.2s, box-shadow 0.2s;
      `;

      input.addEventListener('focus', () => {
        input.style.borderColor = '#dc9b9b';
        input.style.boxShadow = '0 0 0 3px rgba(184, 0, 0, 0.08)';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = '#d7dce7';
        input.style.boxShadow = 'none';
      });

      const sendBtn = document.createElement('button');
      sendBtn.setAttribute('aria-label', 'Send message');
      sendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      `;
      sendBtn.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: #df9297;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        transition: background 0.2s, transform 0.2s;
      `;

      sendBtn.addEventListener('mouseenter', () => {
        sendBtn.style.background = this.config.brandPrimary;
      });
      sendBtn.addEventListener('mouseleave', () => {
        sendBtn.style.background = '#df9297';
      });
      sendBtn.addEventListener('click', () => this.sendMessage(input.value, messagesContainer, input));
      input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') this.sendMessage(input.value, messagesContainer, input);
      });

      inputRow.appendChild(input);
      inputRow.appendChild(sendBtn);
      inputArea.appendChild(leadButton);
      inputArea.appendChild(inputRow);

      chatWindow.appendChild(header);
      chatWindow.appendChild(messagesContainer);
      chatWindow.appendChild(inputArea);

      header.querySelector('#chat-widget-close').addEventListener('click', () => this.toggleWidget());
      header.querySelectorAll('[data-chat-lang]').forEach((button) => {
        button.addEventListener('click', () => this.setLanguage(button.dataset.chatLang));
      });

      container.appendChild(launcher);
      container.appendChild(chatWindow);
      document.body.appendChild(container);

      this.elements = {
        container,
        launcher,
        chatWindow,
        header,
        messagesContainer,
        input,
        leadButton
      };

      this.updateLanguageUI();
      this.addMessage({
        text: this.t('welcome'),
        sender: 'bot',
        timestamp: new Date()
      }, messagesContainer);
    },

    setLanguage(language) {
      if (!I18N[language] || this.state.language === language) return;

      this.state.language = language;
      this.updateLanguageUI();
      this.addMessage({
        text: this.t('welcome'),
        sender: 'bot',
        timestamp: new Date()
      }, this.elements.messagesContainer);
    },

    updateLanguageUI() {
      if (!this.elements) return;

      const title = this.elements.header.querySelector('[data-chat-title]');
      const subtitle = this.elements.header.querySelector('[data-chat-subtitle]');
      if (title) title.textContent = this.t('title');
      if (subtitle) subtitle.textContent = this.t('subtitle');
      if (this.elements.input) this.elements.input.placeholder = this.t('placeholder');
      if (this.elements.leadButton) this.elements.leadButton.textContent = this.t('leadButton');

      this.elements.header.querySelectorAll('[data-chat-lang]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.chatLang === this.state.language);
      });
    },

    toggleWidget() {
      this.state.isOpen = !this.state.isOpen;
      const chatWindow = this.elements.chatWindow;
      chatWindow.style.display = this.state.isOpen ? 'flex' : 'none';

      if (this.state.isOpen) {
        this.elements.input.focus();
        setTimeout(() => {
          this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }, 0);
      }
    },

    sendMessage(text, messagesContainer, input) {
      const cleanText = text.trim();
      if (!cleanText || this.state.isSending) return;

      this.state.isSending = true;

      this.addMessage({
        text: cleanText,
        sender: 'user',
        timestamp: new Date()
      }, messagesContainer);

      input.value = '';
      this.callAPI(cleanText);
    },

    addMessage(msg, messagesContainer) {
      const messageEl = document.createElement('div');
      const isUser = msg.sender === 'user';

      messageEl.style.cssText = `
        margin-bottom: 12px;
        display: flex;
        justify-content: ${isUser ? 'flex-end' : 'flex-start'};
      `;

      const bubble = document.createElement('div');
      bubble.style.cssText = `
        max-width: 78%;
        padding: 10px 14px;
        border-radius: ${isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px'};
        font-size: 13px;
        line-height: 1.55;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        word-break: break-word;
        background: ${isUser ? this.config.brandPrimary : '#ffffff'};
        color: ${isUser ? 'white' : '#111827'};
        border: ${isUser ? 'none' : '1px solid #dde2ec'};
        white-space: pre-line;
        box-shadow: ${isUser ? 'none' : '0 1px 1px rgba(15, 23, 42, 0.03)'};
      `;
      bubble.textContent = msg.text;

      messageEl.appendChild(bubble);
      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      this.state.messages.push(msg);
    },

    showTyping() {
      this.removeTyping();

      const typingEl = document.createElement('div');
      typingEl.style.cssText = `
        margin-bottom: 12px;
        display: flex;
        justify-content: flex-start;
      `;
      typingEl.innerHTML = `
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #fff;
          border: 1px solid #dde2ec;
          border-radius: 16px;
          padding: 9px 12px;
        ">
          <span class="pk-typing-dot"></span>
          <span class="pk-typing-dot"></span>
          <span class="pk-typing-dot"></span>
        </div>
      `;

      this.state.typingEl = typingEl;
      this.elements.messagesContainer.appendChild(typingEl);
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    },

    removeTyping() {
      if (this.state.typingEl) {
        this.state.typingEl.remove();
        this.state.typingEl = null;
      }
    },

    callAPI(message) {
      if (!this.config.apiUrl) {
        console.warn('API URL not configured');
        this.addMessage({
          text: this.t('apiMissing'),
          sender: 'bot',
          timestamp: new Date()
        }, this.elements.messagesContainer);
        return;
      }

      const payload = {
        message,
        sessionId: this.state.sessionId,
        language: this.state.language,
        timestamp: new Date().toISOString()
      };

      this.showTyping();

      fetch(`${this.config.apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey || ''
        },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
          this.removeTyping();
          this.state.isSending = false;
          if (data.reply) {
            this.addMessage({
              text: data.reply,
              sender: 'bot',
              timestamp: new Date()
            }, this.elements.messagesContainer);
          }
        })
        .catch(err => {
          this.removeTyping();
          this.state.isSending = false;
          console.error('Chat API error:', err);
          this.addMessage({
            text: this.t('apiError'),
            sender: 'bot',
            timestamp: new Date()
          }, this.elements.messagesContainer);
        });
    },

    generateSessionId() {
      return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    attachEventListeners() {}
  };

  window.ChatWidget = ChatWidget;
})();
