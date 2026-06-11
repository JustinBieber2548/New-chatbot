/**
 * ChatWidget - Embeddable chat widget for websites
 * Include in your site: <script src="https://yourserver.com/chat-widget.js"></script>
 * Then initialize: ChatWidget.init({ apiUrl: 'https://your-api.com', apiKey: 'your-key' })
 */

(function () {
  const ChatWidget = {
    config: {
      apiUrl: null,
      apiKey: null,
      position: 'bottom-left',
      theme: 'light',
      title: 'PK Supply Chain',
      subtitle: 'ออนไลน์',
      placeholder: 'พิมพ์ข้อความ',
      width: '370px',
      height: '560px',
      allowedDomain: 'pksupplychain.com',
      brandPrimary: '#B80000',
      brandDark: '#1D2338',
      logoUrl: null,
      welcomeMessage: 'สวัสดีครับ ผมเป็นผู้ช่วยของ PK Supply Chain สอบถามเรื่องบริการซัพพลายเชนได้เลย หรือฝากข้อมูลให้ทีมงานติดต่อกลับครับ'
    },

    state: {
      isOpen: false,
      messages: [],
      sessionId: null,
      typingEl: null
    },

    init(options = {}) {
      this.config = { ...this.config, ...options };

      const currentDomain = window.location.hostname;
      if (!currentDomain.includes(this.config.allowedDomain) && !currentDomain.includes('localhost')) {
        console.warn('Chat Widget: Domain not authorized. Only works on pksupplychain.com');
        return;
      }

      document.querySelector('#chat-widget-container')?.remove();
      this.state.sessionId = this.generateSessionId();
      this.createWidget();
      this.attachEventListeners();
      console.log('PK Supply Chain Chat Widget initialized');
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
        box-sizing: border-box;
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
        box-sizing: border-box;
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
        box-sizing: border-box;
      `;

      const header = document.createElement('div');
      header.style.cssText = `
        background: ${this.config.brandDark};
        color: white;
        padding: 10px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-sizing: border-box;
      `;
      header.innerHTML = `
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          overflow: hidden;
        ">
          <img src="${logoUrl}" alt="PK Supply Chain" style="width: 30px; height: 23px; object-fit: contain;" />
        </div>
        <div style="min-width: 0; flex: 1 1 auto;">
          <div style="font-weight: 700; font-size: 14px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.config.title}</div>
          <div style="display: flex; align-items: center; gap: 5px; font-size: 11px; line-height: 1.35; color: rgba(255,255,255,0.78);">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #18d47a; display: inline-block;"></span>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.config.subtitle}</span>
          </div>
        </div>
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        ">
          <div style="
            border: 1px solid rgba(255,255,255,0.32);
            border-radius: 999px;
            padding: 3px;
            display: flex;
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
          ">
            <span style="background: #fff; color: ${this.config.brandDark}; border-radius: 999px; padding: 5px 7px;">TH</span>
            <span style="color: rgba(255,255,255,0.72); padding: 5px 7px;">EN</span>
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
        box-sizing: border-box;
      `;

      const inputArea = document.createElement('div');
      inputArea.style.cssText = `
        padding: 10px 14px 14px;
        border-top: 1px solid #e1e5ee;
        background: #fff;
        box-sizing: border-box;
      `;

      const leadButton = document.createElement('button');
      leadButton.type = 'button';
      leadButton.textContent = 'ฝากชื่อและอีเมล';
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
        box-sizing: border-box;
      `;
      leadButton.addEventListener('click', () => {
        this.sendMessage('ต้องการฝากชื่อและอีเมลให้ทีมงานติดต่อกลับ', messagesContainer, input);
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
      input.placeholder = this.config.placeholder;
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
        box-sizing: border-box;
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

      container.appendChild(launcher);
      container.appendChild(chatWindow);
      document.body.appendChild(container);

      this.elements = {
        container,
        launcher,
        chatWindow,
        messagesContainer,
        input
      };

      this.addMessage({
        text: this.config.welcomeMessage,
        sender: 'bot',
        timestamp: new Date()
      }, messagesContainer);
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
      if (!cleanText) return;

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
        box-sizing: border-box;
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
          background: #fff;
          border: 1px solid #dde2ec;
          border-radius: 16px;
          padding: 8px 12px;
          color: #6b7280;
          font-weight: 700;
          letter-spacing: 4px;
          line-height: 1;
        ">•••</div>
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
          text: 'API not configured. Please set apiUrl in ChatWidget.init()',
          sender: 'bot',
          timestamp: new Date()
        }, this.elements.messagesContainer);
        return;
      }

      const payload = {
        message,
        sessionId: this.state.sessionId,
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
          console.error('Chat API error:', err);
          this.addMessage({
            text: 'เชื่อมต่อบริการแชทไม่ได้ กรุณาลองอีกครั้งครับ',
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
