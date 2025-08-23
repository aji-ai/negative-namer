import OpenAI from 'openai';

let openai = null;
let apiKey = '';

// DOM elements
const apiKeyInput = document.getElementById('apiKey');
const saveKeyButton = document.getElementById('saveKey');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendMessage');
const messagesContainer = document.getElementById('messages');

// Check for environment variable on page load
document.addEventListener('DOMContentLoaded', () => {
    const envApiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (envApiKey) {
        // Use environment variable
        apiKey = envApiKey;
        initializeOpenAI(apiKey);

        // Hide API key input section since we have the key
        document.querySelector('.api-key-section').style.display = 'none';

        addMessage('system', 'Using API key from environment. You can start chatting!');
    } else {
        // Show message that user needs to enter API key
        addMessage('system', 'Please enter your OpenAI API key above to start chatting.');
    }
});

// Event listeners
saveKeyButton.addEventListener('click', saveApiKey);
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendButton.disabled) {
        sendMessage();
    }
});

function initializeOpenAI(key) {
    try {
        openai = new OpenAI({
            apiKey: key,
            dangerouslyAllowBrowser: true
        });

        // Enable chat interface
        messageInput.disabled = false;
        sendButton.disabled = false;

        return true;
    } catch (error) {
        console.error('Error initializing OpenAI:', error);
        return false;
    }
}

function saveApiKey() {
    const inputKey = apiKeyInput.value.trim();

    if (!inputKey) {
        alert('Please enter a valid API key');
        return;
    }

    apiKey = inputKey;

    if (initializeOpenAI(apiKey)) {
        // Clear the API key input for security
        apiKeyInput.value = '';

        addMessage('system', 'API key saved! You can now start chatting.');
    } else {
        alert('Error initializing OpenAI client');
    }
}

async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message || !openai) {
        return;
    }

    // Add user message to chat
    addMessage('user', message);

    // Clear input
    messageInput.value = '';

    // Disable input while processing
    messageInput.disabled = true;
    sendButton.disabled = true;

    // Show loading message
    const loadingId = addMessage('assistant', 'Thinking...');

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that specializes in creating negative or pessimistic names for things. Be creative and humorous while staying appropriate."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            model: "gpt-3.5-turbo",
        });

        // Remove loading message
        removeMessage(loadingId);

        // Add assistant response
        const response = completion.choices[0].message.content;
        addMessage('assistant', response);

    } catch (error) {
        console.error('Error calling OpenAI:', error);

        // Remove loading message
        removeMessage(loadingId);

        // Show error message
        addMessage('assistant', 'Sorry, there was an error processing your request. Please check your API key and try again.');
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}

function addMessage(role, content) {
    const messageId = Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.id = `message-${messageId}`;
    messageDiv.textContent = content;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageId;
}

function removeMessage(messageId) {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
        messageElement.remove();
    }
}
