# 🚀 Quick Start Guide

Get your chat widget up and running in 5 minutes!

## Step 1: Install Dependencies (1 min)

```bash
cd backend
npm install
```

## Step 2: Start the Server (30 sec)

```bash
npm start
```

You should see:
```
🚀 Chat Widget Server running on http://localhost:3000
📝 API Key: test-key-123
💬 Widget available at: http://localhost:3000/chat-widget.js
```

## Step 3: View the Demo (30 sec)

Open `demo/index.html` in your browser → You'll see the chat widget in action!

Look for the **purple bubble** in the bottom-right corner 💬

## Step 4: Add to Your Website (2 min)

Copy-paste these 2 lines before the closing `</body>` tag:

```html
<script src="http://localhost:3000/chat-widget.js"></script>
<script>
  ChatWidget.init({
    apiUrl: 'http://localhost:3000',
    apiKey: 'test-key-123'
  });
</script>
```

## Step 5: Test It! 🎉

1. Open your website in browser
2. Look for the chat bubble
3. Click it and start typing
4. You should get automatic replies!

---

## Next Steps

📚 **For More Customization:**
- See [Configuration Guide](../README.md#configuration) in README.md
- Check out [Integration Examples](examples.html)

🚀 **For Production Deployment:**
1. Update `.env` with secure API_KEY
2. Deploy backend to Heroku / AWS / etc.
3. Update script URL to production domain
4. See [Deployment Section](../README.md#deployment) in README

🤖 **To Add AI Responses:**
- Connect OpenAI, Anthropic, or any LLM
- See [Customization Guide](../README.md#customization) in README

---

## Troubleshooting

**Widget not showing?**
- Is backend running? (`npm start`)
- Check browser console for errors
- Verify API URL is correct

**Messages not sending?**
- Check backend logs
- Verify API key matches
- Look at DevTools Network tab

**CORS errors?**
- Both need to be on same localhost for development
- See [Security](../README.md#security-considerations) in README for production

---

## File Structure

```
chat/
├── widget/chat-widget.js       ← The embeddable script
├── backend/
│   └── server.js               ← API that handles messages
├── demo/
│   ├── index.html              ← Main demo page
│   └── examples.html           ← Integration examples
└── README.md                   ← Full documentation
```

---

**🎉 All set! Your chat widget is ready to go!**

For questions → Check README.md
For examples → Open demo/examples.html
For API docs → See README.md under "API Endpoints"
