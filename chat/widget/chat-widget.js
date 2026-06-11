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
      position: 'bottom-right',
      theme: 'light',
      title: 'PK Supply Chain Support',
      placeholder: 'Type your message (Thai or English)...',
      width: '400px',
      height: '600px',
      allowedDomain: 'pksupplychain.com'
    },

    state: {
      isOpen: false,
      messages: [],
      sessionId: null
    },

    init(options = {}) {
      // Domain lock - only work on pksupplychain.com
      const currentDomain = window.location.hostname;
      if (!currentDomain.includes(this.config.allowedDomain) && !currentDomain.includes('localhost')) {
        console.warn('⚠️ Chat Widget: Domain not authorized. Only works on pksupplychain.com');
        return;
      }

      this.config = { ...this.config, ...options };
      this.state.sessionId = this.generateSessionId();
      this.createWidget();
      this.attachEventListeners();
      console.log('🚀 PK Supply Chain Chat Widget initialized');
    },

    createWidget() {
      // Create container
      const container = document.createElement('div');
      container.id = 'chat-widget-container';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        z-index: 9999;
      `;

      if (this.config.position === 'bottom-left') {
        container.style.right = 'auto';
        container.style.left = '20px';
      }

      // Chat bubble button
      const bubble = document.createElement('button');
      bubble.id = 'chat-widget-bubble';
      bubble.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>1e40af 0%, #1e3a8a
      `;
      bubble.style.cssText = `
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        font-size: 0;
      `;

      bubble.addEventListener('mouseenter', () => {
        bubble.style.transform = 'scale(1.1)';
      });
      bubble.addEventListener('mouseleave', () => {
        bubble.style.transform = 'scale(1)';
      });

      bubble.addEventListener('click', () => this.toggleWidget());

      // Chat window
      const chatWindow = document.createElement('div');
      chatWindow.id = 'chat-widget-window';
      chatWindow.style.cssText = `
        position: absolute;
        bottom: 80px;
        right: 0;
        width: ${this.config.width};
        height: ${this.config.height};
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 40px rgba(0, 0, 0, 0.16);
        display: none;
        flex-direction: column;
        overflow: hidden;
      `;

      // Header
      const header = document.createElement('div');
      header.style.cssText = `
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
        color: white;
        padding: 16px;
        font-weight: 600;
        font-size: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      header.innerHTML = `
        <span>🔧 ${this.config.title}</span>
        <button id="chat-widget-close" style="
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 20px;
          padding: 0;
          width: 20px;
          height: 20px;
        ">×</button>
      `;

      // Messages container
      const messagesContainer = document.createElement('div');
      messagesContainer.id = 'chat-widget-messages';
      messagesContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f9fafb;
      `;

      // Input area
      const inputArea = document.createElement('div');
      inputArea.style.cssText = `
        padding: 16px;
        border-top: 1px solid #e5e7eb;
        background: white;
        display: flex;
        gap: 8px;
      `;

      const input = document.createElement('input');
      input.id = 'chat-widget-input';
      input.type = 'text';
      input.placeholder = this.config.placeholder;
      input.style.cssText = `
        flex: 1;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      `;

      input.addEventListener('focus', () => {
        input.style.borderColor = '#667eea';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = '#d1d5db';
      });

      const sendBtn = document.createElement('button');
      sendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      `;
      sendBtn.style.cssText = `
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
        color: white;
        border: none;
        border-radius: 6px;
        width: 40px;
        height: 40px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
      `;

      sendBtn.addEventListener('click', () => this.sendMessage(input.value, messagesContainer, input));
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendMessage(input.value, messagesContainer, input);
      });

      sendBtn.addEventListener('mouseenter', () => { sendBtn.style.opacity = '0.9'; });
      sendBtn.addEventListener('mouseleave', () => { sendBtn.style.opacity = '1'; });

      inputArea.appendChild(input);
      inputArea.appendChild(sendBtn);

      chatWindow.appendChild(header);
      chatWindow.appendChild(messagesContainer);
      chatWindow.appendChild(inputArea);

      // Close button handler
      header.querySelector('#chat-widget-close').addEventListener('click', () => this.toggleWidget());

      container.appendChild(bubble);
      container.appendChild(chatWindow);
      document.body.appendChild(container);

      // Store references
      this.elements = {
        container,
        bubble,
        chatWindow,
        messagesContainer,
        input
      };
    },

    toggleWidget() {
      this.state.isOpen = !this.state.isOpen;
      const chatWindow = this.elements.chatWindow;
      chatWindow.style.display = this.state.isOpen ? 'flex' : 'none';

      if (this.state.isOpen) {
        this.elements.input.focus();
        // Scroll to bottom
        setTimeout(() => {
          this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }, 0);
      }
    },

    sendMessage(text, messagesContainer, input) {
      if (!text.trim()) return;

      // Add user message
      this.addMessage({
        text: text.trim(),
        sender: 'user',
        timestamp: new Date()
      }, messagesContainer);

      // Clear input
      input.value = '';

      // Send to API
      this.callAPI(text.trim());
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
        max-width: 70%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.4;
        word-wrap: break-word;
        background: ${isUser ? 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)' : '#e5e7eb'};
        color: ${isUser ? 'white' : '#1f2937'};
      `;
      bubble.textContent = msg.text;

      messageEl.appendChild(bubble);
      messagesContainer.appendChild(messageEl);

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      this.state.messages.push(msg);
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
          if (data.reply) {
            this.addMessage({
              text: data.reply,
              sender: 'bot',
              timestamp: new Date()
            }, this.elements.messagesContainer);
          }
        })
        .catch(err => {
          console.error('Chat API error:', err);
          this.addMessage({
            text: 'Error connecting to chat service. Please try again.',
            sender: 'bot',
            timestamp: new Date()
          }, this.elements.messagesContainer);
        });
    },

    generateSessionId() {
      return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    attachEventListeners() {
      // Add any global event listeners here
    }
  };

  // Expose to window
  window.ChatWidget = ChatWidget;
})();
