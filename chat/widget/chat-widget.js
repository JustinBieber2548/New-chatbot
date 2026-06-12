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
      leadTitle: 'ฝากข้อมูลติดต่อ',
      namePlaceholder: 'ชื่อของคุณ',
      emailPlaceholder: 'อีเมล',
      helpPlaceholder: 'ให้เราช่วยอะไรดีครับ?',
      imageButton: 'แนบรูป',
      imageRemove: 'ลบรูป',
      send: 'ส่ง',
      cancel: 'ยกเลิก',
      sending: 'กำลังส่ง...',
      imageTooLarge: 'กรุณาเลือกรูปไม่เกิน 3 MB',
      imageTypeError: 'กรุณาเลือกรูปภาพเท่านั้น',
      leadInvalid: 'กรุณากรอกชื่อและอีเมลให้ถูกต้องครับ',
      leadSummary: 'ฝากข้อมูลติดต่อ',
      welcome: 'สวัสดีครับ เราเป็นผู้ช่วยของ PK Supply Chain สอบถามเรื่องบริการระบบลำเลียงหรือฝากข้อมูลให้ทีมงานติดต่อกลับได้เลยครับ',
      apiMissing: 'ยังไม่ได้ตั้งค่า API กรุณาตั้งค่า apiUrl ใน ChatWidget.init()',
      apiError: 'เชื่อมต่อบริการแชทไม่ได้ กรุณาลองอีกครั้งครับ',
      leadError: 'ส่งข้อมูลไม่ได้ กรุณาลองอีกครั้งครับ'
    },
    en: {
      title: 'PK Supply Chain',
      subtitle: 'Online — quick reply',
      placeholder: 'Type a message...',
      leadButton: 'Leave name and email',
      leadMessage: 'I would like to leave my name and email for the team to contact me.',
      leadTitle: 'Leave contact details',
      namePlaceholder: 'Your name',
      emailPlaceholder: 'Email',
      helpPlaceholder: 'How can we help?',
      imageButton: 'Attach image',
      imageRemove: 'Remove image',
      send: 'Send',
      cancel: 'Cancel',
      sending: 'Sending...',
      imageTooLarge: 'Please choose an image under 3 MB',
      imageTypeError: 'Please choose an image file',
      leadInvalid: 'Please enter a valid name and email.',
      leadSummary: 'Contact details',
      welcome: 'Hello, we are the PK Supply Chain assistant. Ask about conveyor services or leave your details for our team to contact you.',
      apiMissing: 'API is not configured. Please set apiUrl in ChatWidget.init().',
      apiError: 'Could not connect to the chat service. Please try again.',
      leadError: 'Could not send your details. Please try again.'
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
      language: 'th',
      selectedLeadImage: null,
      leadSubmitting: false
    },

    init(options = {}) {
      this.config = { ...this.config, ...options };
      this.state.language = this.config.language === 'en' ? 'en' : 'th';

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
        #chat-widget-container input,
        #chat-widget-container textarea {
          font-family: inherit;
        }

        #chat-widget-container button:disabled {
          cursor: not-allowed;
          opacity: .72;
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

        .pk-lead-field {
          width: 100%;
          border: 1px solid #d7dce7;
          border-radius: 18px;
          background: #fbfcff;
          color: #111827;
          font-size: 14px;
          outline: none;
          padding: 0 16px;
        }

        .pk-lead-field:focus {
          border-color: #dc9b9b;
          box-shadow: 0 0 0 3px rgba(184, 0, 0, 0.08);
        }
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

      const leadPanel = document.createElement('form');
      leadPanel.setAttribute('data-chat-lead-panel', 'true');
      leadPanel.noValidate = true;
      leadPanel.style.cssText = `
        position: absolute;
        left: 18px;
        right: 18px;
        bottom: 78px;
        max-height: calc(100% - 98px);
        overflow-y: auto;
        background: #fff;
        border: 1px solid #e1e5ee;
        border-radius: 20px;
        padding: 16px;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.14);
        z-index: 3;
        display: none;
      `;
      leadPanel.innerHTML = `
        <div data-lead-title style="font-weight: 800; font-size: 15px; color: #1f2937; margin-bottom: 10px;">${this.t('leadTitle')}</div>
        <div style="display: grid; gap: 10px;">
          <input class="pk-lead-field" data-lead-name type="text" autocomplete="name" style="height: 46px;" placeholder="${this.t('namePlaceholder')}" />
          <input class="pk-lead-field" data-lead-email type="email" autocomplete="email" style="height: 46px;" placeholder="${this.t('emailPlaceholder')}" />
          <textarea class="pk-lead-field" data-lead-message rows="3" style="min-height: 72px; resize: none; padding-top: 12px;" placeholder="${this.t('helpPlaceholder')}"></textarea>
          <input data-lead-file type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display: none;" />
          <div style="display: flex; align-items: center; gap: 8px; min-height: 32px;">
            <button type="button" data-lead-file-button style="
              height: 32px;
              border-radius: 999px;
              border: 1px dashed ${this.config.brandPrimary};
              background: #fff;
              color: ${this.config.brandPrimary};
              padding: 0 14px;
              font-size: 12px;
              font-weight: 800;
              cursor: pointer;
            ">${this.t('imageButton')}</button>
            <span data-lead-file-name style="font-size: 12px; color: #6b7280; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
            <button type="button" data-lead-file-remove style="
              display: none;
              border: 0;
              background: transparent;
              color: #9f1239;
              font-size: 12px;
              font-weight: 700;
              cursor: pointer;
            ">${this.t('imageRemove')}</button>
          </div>
          <div data-lead-preview style="display: none;"></div>
          <div data-lead-error style="display: none; color: #b80000; font-size: 12px;"></div>
          <div style="display: flex; gap: 10px;">
            <button type="submit" data-lead-submit style="
              flex: 1;
              height: 46px;
              border-radius: 16px;
              border: 0;
              background: ${this.config.brandPrimary};
              color: #fff;
              font-size: 14px;
              font-weight: 800;
              cursor: pointer;
            ">${this.t('send')}</button>
            <button type="button" data-lead-cancel style="
              width: 80px;
              height: 46px;
              border-radius: 16px;
              border: 1px solid #dfe4ee;
              background: #fff;
              color: #1f2937;
              font-size: 14px;
              font-weight: 700;
              cursor: pointer;
            ">${this.t('cancel')}</button>
          </div>
        </div>
      `;

      const leadButton = document.createElement('button');
      leadButton.type = 'button';
      leadButton.setAttribute('data-chat-lead', 'true');
      leadButton.textContent = this.t('leadButton');
      leadButton.style.cssText = `
        width: 100%;
        height: 32px;
        border-radius: 999px;
        border: 1px dashed ${this.config.brandPrimary};
        background: #fff;
        color: ${this.config.brandPrimary};
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 8px;
      `;
      leadButton.addEventListener('click', () => {
        this.showLeadForm();
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
      chatWindow.appendChild(leadPanel);
      chatWindow.appendChild(inputArea);

      header.querySelector('#chat-widget-close').addEventListener('click', () => this.toggleWidget());
      header.querySelectorAll('[data-chat-lang]').forEach((button) => {
        button.addEventListener('click', () => this.setLanguage(button.dataset.chatLang));
      });
      leadPanel.addEventListener('submit', (event) => this.submitLeadForm(event));
      leadPanel.querySelector('[data-lead-cancel]').addEventListener('click', () => this.hideLeadForm());
      leadPanel.querySelector('[data-lead-file-button]').addEventListener('click', () => {
        leadPanel.querySelector('[data-lead-file]').click();
      });
      leadPanel.querySelector('[data-lead-file]').addEventListener('change', (event) => this.handleLeadImage(event));
      leadPanel.querySelector('[data-lead-file-remove]').addEventListener('click', () => this.clearLeadImage());

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
        leadButton,
        leadPanel
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
      if (this.elements.leadPanel) {
        const leadPanel = this.elements.leadPanel;
        leadPanel.querySelector('[data-lead-title]').textContent = this.t('leadTitle');
        leadPanel.querySelector('[data-lead-name]').placeholder = this.t('namePlaceholder');
        leadPanel.querySelector('[data-lead-email]').placeholder = this.t('emailPlaceholder');
        leadPanel.querySelector('[data-lead-message]').placeholder = this.t('helpPlaceholder');
        leadPanel.querySelector('[data-lead-file-button]').textContent = this.t('imageButton');
        leadPanel.querySelector('[data-lead-file-remove]').textContent = this.t('imageRemove');
        leadPanel.querySelector('[data-lead-submit]').textContent = this.state.leadSubmitting ? this.t('sending') : this.t('send');
        leadPanel.querySelector('[data-lead-cancel]').textContent = this.t('cancel');
      }

      this.elements.header.querySelectorAll('[data-chat-lang]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.chatLang === this.state.language);
      });
    },

    showLeadForm() {
      if (!this.elements?.leadPanel) return;

      this.elements.leadPanel.style.display = 'block';
      this.clearLeadError();
      setTimeout(() => {
        this.elements.leadPanel.querySelector('[data-lead-name]').focus();
      }, 0);
    },

    hideLeadForm() {
      if (!this.elements?.leadPanel || this.state.leadSubmitting) return;

      this.elements.leadPanel.style.display = 'none';
      this.clearLeadError();
    },

    resetLeadForm() {
      const panel = this.elements.leadPanel;
      panel.querySelector('[data-lead-name]').value = '';
      panel.querySelector('[data-lead-email]').value = '';
      panel.querySelector('[data-lead-message]').value = '';
      this.clearLeadImage();
      this.clearLeadError();
    },

    setLeadSubmitting(isSubmitting) {
      this.state.leadSubmitting = isSubmitting;
      const panel = this.elements.leadPanel;
      if (!panel) return;

      panel.querySelectorAll('input, textarea, button').forEach((field) => {
        field.disabled = isSubmitting;
      });
      panel.querySelector('[data-lead-submit]').textContent = isSubmitting ? this.t('sending') : this.t('send');
    },

    showLeadError(text) {
      const errorEl = this.elements.leadPanel.querySelector('[data-lead-error]');
      errorEl.textContent = text;
      errorEl.style.display = 'block';
    },

    clearLeadError() {
      const errorEl = this.elements?.leadPanel?.querySelector('[data-lead-error]');
      if (!errorEl) return;
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    },

    handleLeadImage(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        this.showLeadError(this.t('imageTypeError'));
        event.target.value = '';
        return;
      }

      if (file.size > 3 * 1024 * 1024) {
        this.showLeadError(this.t('imageTooLarge'));
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.state.selectedLeadImage = {
          name: file.name,
          type: file.type,
          dataUrl: reader.result
        };
        this.renderLeadImagePreview();
        this.clearLeadError();
      };
      reader.readAsDataURL(file);
    },

    renderLeadImagePreview() {
      const panel = this.elements.leadPanel;
      const preview = panel.querySelector('[data-lead-preview]');
      const fileName = panel.querySelector('[data-lead-file-name]');
      const removeButton = panel.querySelector('[data-lead-file-remove]');
      const image = this.state.selectedLeadImage;

      if (!image) {
        preview.style.display = 'none';
        preview.innerHTML = '';
        fileName.textContent = '';
        removeButton.style.display = 'none';
        return;
      }

      fileName.textContent = image.name;
      removeButton.style.display = 'inline-block';
      preview.style.display = 'block';
      preview.innerHTML = `
        <img src="${image.dataUrl}" alt="" style="
          width: 100%;
          max-height: 120px;
          object-fit: cover;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          display: block;
        " />
      `;
    },

    clearLeadImage() {
      this.state.selectedLeadImage = null;
      const panel = this.elements?.leadPanel;
      if (!panel) return;

      const fileInput = panel.querySelector('[data-lead-file]');
      if (fileInput) fileInput.value = '';
      this.renderLeadImagePreview();
    },

    submitLeadForm(event) {
      event.preventDefault();
      if (this.state.leadSubmitting) return;

      const panel = this.elements.leadPanel;
      const name = panel.querySelector('[data-lead-name]').value.trim();
      const email = panel.querySelector('[data-lead-email]').value.trim();
      const message = panel.querySelector('[data-lead-message]').value.trim();

      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.showLeadError(this.t('leadInvalid'));
        return;
      }

      const summary = `${this.t('leadSummary')}\n${name}\n${email}${message ? `\n${message}` : ''}`;
      this.addMessage({
        text: summary,
        imageUrl: this.state.selectedLeadImage?.dataUrl || null,
        imageName: this.state.selectedLeadImage?.name || '',
        sender: 'user',
        timestamp: new Date()
      }, this.elements.messagesContainer);

      this.sendLead({ name, email, message, image: this.state.selectedLeadImage });
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
        box-shadow: ${isUser ? 'none' : '0 1px 1px rgba(15, 23, 42, 0.03)'};
      `;
      if (msg.text) {
        const textEl = document.createElement('div');
        textEl.textContent = msg.text;
        bubble.appendChild(textEl);
      }

      if (msg.imageUrl) {
        const imageEl = document.createElement('img');
        imageEl.src = msg.imageUrl;
        imageEl.alt = msg.imageName || '';
        imageEl.style.cssText = `
          display: block;
          width: 100%;
          max-height: 150px;
          object-fit: cover;
          border-radius: 12px;
          margin-top: ${msg.text ? '8px' : '0'};
          border: ${isUser ? '1px solid rgba(255,255,255,.32)' : '1px solid #e5e7eb'};
        `;
        bubble.appendChild(imageEl);
      }

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

    sendLead({ name, email, message, image }) {
      if (!this.config.apiUrl) {
        this.addMessage({
          text: this.t('apiMissing'),
          sender: 'bot',
          timestamp: new Date()
        }, this.elements.messagesContainer);
        return;
      }

      this.setLeadSubmitting(true);
      this.showTyping();

      fetch(`${this.config.apiUrl}/lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey || ''
        },
        body: JSON.stringify({
          name,
          email,
          message,
          image,
          sessionId: this.state.sessionId,
          language: this.state.language,
          timestamp: new Date().toISOString()
        })
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.success) {
            throw new Error(data.message || this.t('leadError'));
          }
          return data;
        })
        .then((data) => {
          this.removeTyping();
          this.setLeadSubmitting(false);
          this.addMessage({
            text: data.message || this.t('leadMessage'),
            sender: 'bot',
            timestamp: new Date()
          }, this.elements.messagesContainer);
          this.resetLeadForm();
          this.hideLeadForm();
        })
        .catch((err) => {
          this.removeTyping();
          this.setLeadSubmitting(false);
          console.error('Lead API error:', err);
          const errorText = err.message || this.t('leadError');
          this.showLeadError(errorText);
          this.addMessage({
            text: errorText,
            sender: 'bot',
            timestamp: new Date()
          }, this.elements.messagesContainer);
        });
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
