# 🚀 Chat Widget - Embeddable Chat Solution

A lightweight, modern, and easy-to-use chat widget that can be embedded into any website. Perfect for customer support, lead generation, and user engagement.

## Features

- ✨ **Modern & Beautiful UI** - Sleek floating widget with smooth animations
- 🔧 **Dead Simple Setup** - Just 2 lines of code to embed
- 📱 **Mobile Responsive** - Works perfectly on all devices
- 🌐 **CORS Ready** - Works across different domains
- 🔐 **Secure** - API key authentication included
- ⚡ **Lightweight** - Single JS file (~8KB gzipped)
- 🎨 **Customizable** - Configurable colors, position, and text
- 💬 **Session Management** - Track conversations per visitor
- 🔌 **Extensible** - Easy to connect to any backend/AI service

## Project Structure

```
chat/
├── widget/
│   └── chat-widget.js          # Main embeddable script
├── backend/
│   ├── server.js               # Express.js API server
│   ├── package.json            # Node.js dependencies
│   └── .env.example            # Environment template
├── demo/
│   └── index.html              # Demo & documentation page
└── README.md                   # This file
```

## Quick Start

### 1. Start the Backend Server

```bash
cd backend
npm install
npm start
```

Server will run at `http://localhost:3000`

### 2. Embed in Your Website

Add these 2 lines to your HTML:

```html
<!-- Add this before closing </body> tag -->
<script src="http://localhost:3000/chat-widget.js"></script>
<script>
  ChatWidget.init({
    apiUrl: 'http://localhost:3000',
    apiKey: 'test-key-123',
    title: 'Chat Support',
    placeholder: 'Type a message...'
  });
</script>
```

### 3. View Demo

Open `demo/index.html` in your browser to see the widget in action.

## Configuration

```javascript
ChatWidget.init({
  // Required
  apiUrl: 'https://your-server.com',     // Backend API URL
  apiKey: 'your-secret-api-key',         // For authentication

  // Optional
  title: 'Chat Support',                 // Widget header title
  placeholder: 'Type a message...',       // Input field placeholder
  theme: 'light',                        // 'light' or 'dark' (future)
  position: 'bottom-right',              // 'bottom-right' or 'bottom-left'
  width: '400px',                        // Widget width
  height: '600px'                        // Widget height
});
```

## API Endpoints

### POST /chat
Send a message and get a reply.

**Request:**
```json
{
  "message": "Hello, how can you help?",
  "sessionId": "session-123456",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Response:**
```json
{
  "reply": "Hello! How can I assist you today?",
  "sessionId": "session-123456"
}
```

**Headers:**
```
Content-Type: application/json
X-API-Key: your-api-key
```

### GET /session/:sessionId
Retrieve conversation history.

**Response:**
```json
{
  "sessionId": "session-123456",
  "messages": [
    {
      "role": "user",
      "message": "Hello",
      "timestamp": "2024-01-01T12:00:00Z"
    },
    {
      "role": "assistant",
      "message": "Hi there! How can I help?",
      "timestamp": "2024-01-01T12:00:05Z"
    }
  ]
}
```

### DELETE /session/:sessionId
Clear a conversation.

**Response:**
```json
{
  "success": true,
  "message": "Session cleared"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Deployment

### Deploy Backend to Production

#### Option 1: Heroku
```bash
cd backend
heroku create your-chat-app
git push heroku main
```

#### Option 2: AWS EC2
```bash
ssh into instance
git clone your-repo
cd backend
npm install
npm start
```

#### Option 3: DigitalOcean App Platform
- Connect your GitHub repo
- Set environment variables in .env
- Deploy!

### Environment Variables

Create `.env` file in `backend/`:

```
PORT=3000
API_KEY=your-secure-api-key-here
CORS_ORIGINS=https://yourdomain.com,https://another-domain.com
```

### Update Widget Script URL

After deployment, update your HTML to point to production:

```html
<script src="https://your-production-url.com/chat-widget.js"></script>
<script>
  ChatWidget.init({
    apiUrl: 'https://your-production-url.com',
    apiKey: 'your-api-key'
  });
</script>
```

## Customization

### Change Chat Bubble Color

Edit `widget/chat-widget.js` around line 50:
```javascript
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); // Change these colors
```

### Connect to AI Service

Replace the `generateReply()` function in `backend/server.js`:

```javascript
// Example: Connect to OpenAI
const { Configuration, OpenAIApi } = require("openai");

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

async function generateReply(message) {
  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: message }],
  });
  return response.data.choices[0].message.content;
}
```

### Add Message Storage (Database)

```javascript
// Example: Use MongoDB
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionId: String,
  role: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
```

## JavaScript API

### ChatWidget Methods

```javascript
// Initialize widget
ChatWidget.init(options);

// Open/close widget programmatically
ChatWidget.toggleWidget();

// Send message via code
ChatWidget.sendMessage(text, messagesContainer, inputElement);

// Add message to chat
ChatWidget.addMessage({
  text: 'Hello',
  sender: 'user',
  timestamp: new Date()
}, messagesContainer);

// Call API directly
ChatWidget.callAPI(message);

// Get session ID
ChatWidget.state.sessionId;

// Get all messages
ChatWidget.state.messages;
```

### Example: Custom Integration

```javascript
// Wait for script to load
if (window.ChatWidget) {
  ChatWidget.init({
    apiUrl: 'https://your-api.com',
    apiKey: 'your-key'
  });

  // Listen for messages (add this to chat-widget.js)
  window.addEventListener('chatMessage', (event) => {
    console.log('New message:', event.detail);
  });
}
```

## Troubleshooting

### Widget not showing?
- Check browser console for errors
- Verify API URL is correct
- Ensure CORS is enabled on backend
- Check API key is correct

### Messages not sending?
- Verify backend is running (`npm start`)
- Check network tab in DevTools
- Ensure API_KEY in .env matches init config
- Check browser console for error messages

### CORS errors?
In `backend/server.js`, verify CORS is configured:
```javascript
app.use(cors()); // Allows all origins
// Or specify origins:
app.use(cors({
  origin: ['https://yourdomain.com', 'https://localhost:3000']
}));
```

## Performance Tips

- Minimize API latency (host server close to users)
- Cache frequent responses
- Compress chat-widget.js before deploying
- Use CDN for static files
- Implement conversation persistence in database

## Security Considerations

- Never expose API keys in frontend code
- Use HTTPS in production
- Implement rate limiting
- Sanitize/validate all messages
- Add CAPTCHA if needed
- Implement user authentication if required

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT License - Feel free to use for personal or commercial projects.

## Support & Contributions

For issues, feature requests, or contributions, please reach out.

## Roadmap

- [ ] Dark mode theme
- [ ] Voice messages
- [ ] File upload support
- [ ] Message reactions
- [ ] Typing indicators
- [ ] User authentication
- [ ] Analytics dashboard
- [ ] Mobile native apps

---

Made with ❤️ for developers
