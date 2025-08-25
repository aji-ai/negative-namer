import OpenAI from 'openai';
import { encoding_for_model, get_encoding } from '@dqbd/tiktoken';
import { marked } from 'marked';

// Immediate localStorage check on script load
console.log('=== SCRIPT LOADED - IMMEDIATE localStorage CHECK ===');
console.log('localStorage available:', typeof Storage !== 'undefined');
if (typeof Storage !== 'undefined') {
    const apiKeyValue = localStorage.getItem('negative-namer-api-key');
    console.log('API key on script load:', apiKeyValue ? 'PRESENT (' + apiKeyValue.length + ' chars)' : 'MISSING');
    console.log('Full localStorage contents:');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        console.log(`  ${key}: ${value ? (key.includes('api') ? '***' + value.slice(-4) : value) : 'null'}`);
    }
} else {
    console.log('localStorage NOT AVAILABLE');
}

let openai = null;
let apiKey = '';
let conversationHistory = [];
let encoder = null;

// Configure marked for safe HTML rendering
marked.setOptions({
    breaks: true, // Convert line breaks to <br>
    gfm: true, // Enable GitHub flavored markdown
});

// Function to detect if text likely contains markdown
function hasMarkdownContent(text) {
    const markdownPatterns = [
        /#{1,6}\s+/, // Headers
        /\*{1,2}[^*]+\*{1,2}/, // Bold/italic
        /`[^`]+`/, // Inline code
        /```[\s\S]*```/, // Code blocks
        /^\s*[-*+]\s+/m, // Unordered lists
        /^\s*\d+\.\s+/m, // Ordered lists
        /\[([^\]]+)\]\([^)]+\)/, // Links
        /^\s*\|.*\|/m, // Tables
        /^\s*>/m, // Blockquotes
    ];
    
    return markdownPatterns.some(pattern => pattern.test(text));
}

// Encoder functions
const loadEncoding = (model = 'gpt-4o') => {
    try { 
        return encoding_for_model(model) 
    } catch { 
        return get_encoding('cl100k_base') 
    }
}

const ensureEncoder = (model = 'gpt-4o') => {
    if (!encoder || (model && model !== encoder.model)) {
        // Free previous encoder if exists
        if (encoder && encoder.enc) {
            try {
                encoder.enc.free()
            } catch (e) {
                console.warn('Error freeing encoder:', e)
            }
        }
        
        // Create new encoder
        const enc = loadEncoding(model)
        encoder = { enc, model }
    }
    return encoder.enc
}

function countTokens(text, model = 'gpt-4o') {
    try {
        const enc = ensureEncoder(model)
        return enc.encode(text).length
    } catch (error) {
        console.error('Error counting tokens:', error)
        // Fallback to simple estimation
        const cleanText = text.trim().replace(/\s+/g, ' ')
        const words = cleanText.split(' ').length
        const chars = cleanText.length
        return Math.max(1, Math.ceil((words + chars / 4) / 1.3))
    }
}

// DOM elements - Navigation
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsButton = document.getElementById('closeSettings');
const apiStatusCompact = document.getElementById('apiStatusCompact');
const apiCheckmark = document.getElementById('apiCheckmark');

// DOM elements - Settings
const settingsApiKeyInput = document.getElementById('settingsApiKey');
const saveSettingsKeyButton = document.getElementById('saveSettingsKey');
const testSettingsKeyButton = document.getElementById('testSettingsKey');
const settingsSystemMessageInput = document.getElementById('settingsSystemMessage');
const saveSystemMessageButton = document.getElementById('saveSystemMessage');
const settingsGroundingTextInput = document.getElementById('settingsGroundingText');
const saveGroundingTextButton = document.getElementById('saveGroundingText');
const markdownToggle = document.getElementById('markdownToggle');
const markdownPreview = document.getElementById('markdownPreview');

// DOM elements - Chat
const modelSelect = document.getElementById('modelSelect');
const gpt5Controls = document.getElementById('gpt5Controls');
const reasoningSelect = document.getElementById('reasoningSelect');
const verbositySelect = document.getElementById('verbositySelect');
const clearButton = document.getElementById('clearButton');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendMessage');
const messagesContainer = document.getElementById('messages');

// Local Storage Keys
const STORAGE_KEYS = {
    API_KEY: 'negative-namer-api-key',
    SYSTEM_MESSAGE: 'negative-namer-system-message',
    GROUNDING_TEXT: 'negative-namer-grounding-text'
};

// Check for stored data on page load
console.log('Setting up DOMContentLoaded listener...');
console.log('Document readyState:', document.readyState);

function initializeApp() {
    console.log('=== INITIALIZING APP ===');
    
    // Debug: Check localStorage immediately
    console.log('Raw localStorage check:');
    console.log('localStorage.length:', localStorage.length);
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        console.log(`localStorage[${i}]: ${key} = ${localStorage.getItem(key)}`);
    }
    
    // Check specific keys
    const apiKeyValue = localStorage.getItem(STORAGE_KEYS.API_KEY);
    const systemMsgValue = localStorage.getItem(STORAGE_KEYS.SYSTEM_MESSAGE);
    console.log('STORAGE_KEYS.API_KEY:', STORAGE_KEYS.API_KEY);
    console.log('Direct API key value:', apiKeyValue);
    console.log('API key exists:', apiKeyValue !== null);
    console.log('API key length:', apiKeyValue ? apiKeyValue.length : 0);
    console.log('System message exists:', systemMsgValue !== null);
    
    // Initialize encoder
    try {
        ensureEncoder('gpt-4o')
        console.log('Tiktoken encoder initialized successfully')
    } catch (e) {
        console.error('Tiktoken encoder initialization failed:', e)
    }

    // Initialize GPT-5 controls visibility
    handleModelChange();
    
    // Load stored API key and system message
    loadStoredSettings();
    
    // Initialize API status
    updateApiStatus();
    
    console.log('=== App initialization complete ===');
}

// Handle both cases: DOM already loaded or still loading
if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    console.log('DOM already loaded, initializing immediately...');
    initializeApp();
}

// Cleanup encoder on page unload
window.addEventListener('beforeunload', () => {
    if (encoder && encoder.enc) {
        try {
            encoder.enc.free()
            encoder = null
        } catch (e) {
            console.warn('Error freeing encoder on unload:', e)
        }
    }
});

// Event listeners - Navigation
settingsButton.addEventListener('click', openSettingsModal);
closeSettingsButton.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettingsModal();
    }
});

// Event listeners - Settings
saveSettingsKeyButton.addEventListener('click', saveApiKeyFromSettings);
testSettingsKeyButton.addEventListener('click', testApiKeyFromSettings);
saveSystemMessageButton.addEventListener('click', saveSystemMessage);
saveGroundingTextButton.addEventListener('click', saveGroundingText);
markdownToggle.addEventListener('change', toggleMarkdownPreview);
settingsGroundingTextInput.addEventListener('input', updateMarkdownPreview);

// Event listeners - Chat
modelSelect.addEventListener('change', handleModelChange);
clearButton.addEventListener('click', clearMessages);
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendButton.disabled) {
        sendMessage();
    }
});

// Modal functions
function openSettingsModal() {
    settingsModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
    document.body.style.overflow = 'auto'; // Restore scrolling
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal.classList.contains('active')) {
        closeSettingsModal();
    }
});

// Local Storage functions
function loadStoredSettings() {
    console.log('Loading stored settings...');
    
    // Load API key
    const storedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    console.log('Stored API key found:', storedApiKey ? '***' + storedApiKey.slice(-4) : 'none');
    
    if (storedApiKey && storedApiKey.trim()) {
        apiKey = storedApiKey;
        settingsApiKeyInput.value = storedApiKey;
        console.log('Initializing OpenAI with stored key...');
        if (initializeOpenAI(apiKey)) {
            console.log('OpenAI initialized successfully with stored key');
        } else {
            console.error('Failed to initialize OpenAI with stored key');
        }
    } else {
        console.log('No valid stored API key found');
    }

    // Load system message
    const storedSystemMessage = localStorage.getItem(STORAGE_KEYS.SYSTEM_MESSAGE);
    console.log('Stored system message found:', storedSystemMessage ? 'yes' : 'no');
    
    if (storedSystemMessage) {
        settingsSystemMessageInput.value = storedSystemMessage;
    }

    // Load grounding text
    const storedGroundingText = localStorage.getItem(STORAGE_KEYS.GROUNDING_TEXT);
    console.log('Stored grounding text found:', storedGroundingText ? 'yes' : 'no');
    
    if (storedGroundingText) {
        settingsGroundingTextInput.value = storedGroundingText;
    }
}

function updateApiStatus() {
    if (apiKey && apiKey.trim()) {
        apiCheckmark.textContent = '✓';
        apiCheckmark.className = 'api-checkmark connected';
        apiStatusCompact.style.display = 'flex';
    } else {
        apiCheckmark.textContent = '✗';
        apiCheckmark.className = 'api-checkmark disconnected';
        apiStatusCompact.style.display = 'flex';
    }
}

function saveApiKeyFromSettings() {
    const inputKey = settingsApiKeyInput.value.trim();
    
    if (!inputKey) {
        alert('Please enter a valid API key');
        return;
    }

    console.log('=== SAVING API KEY ===');
    console.log('Input key length:', inputKey.length);
    console.log('STORAGE_KEYS.API_KEY:', STORAGE_KEYS.API_KEY);
    console.log('About to save to localStorage...');
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.API_KEY, inputKey);
    apiKey = inputKey;
    
    // Immediate verification
    const saved = localStorage.getItem(STORAGE_KEYS.API_KEY);
    console.log('Immediate verification:');
    console.log('- Saved successfully:', saved !== null);
    console.log('- Saved length:', saved ? saved.length : 0);
    console.log('- Keys match:', saved === inputKey);
    
    // Check if localStorage is working at all
    localStorage.setItem('test-key', 'test-value');
    const testValue = localStorage.getItem('test-key');
    console.log('localStorage test:', testValue === 'test-value' ? 'WORKING' : 'BROKEN');
    localStorage.removeItem('test-key');
    
    // Double check with a small delay
    setTimeout(() => {
        const delayedCheck = localStorage.getItem(STORAGE_KEYS.API_KEY);
        console.log('Delayed verification:', delayedCheck !== null ? 'STILL THERE' : 'DISAPPEARED');
    }, 100);

    if (initializeOpenAI(apiKey)) {
        updateApiStatus();
        addMessage('system', '✅ API key saved successfully!');
        alert('API key saved successfully!');
        console.log('API key saved and OpenAI initialized successfully');
    } else {
        alert('Error initializing OpenAI client');
        console.error('Failed to initialize OpenAI with new key');
    }
}

async function testApiKeyFromSettings() {
    const testKey = settingsApiKeyInput.value.trim() || apiKey;
    
    if (!testKey) {
        alert('Please enter an API key to test');
        return;
    }

    // Show loading state
    const originalText = testSettingsKeyButton.textContent;
    testSettingsKeyButton.textContent = 'Testing...';
    testSettingsKeyButton.disabled = true;

    try {
        // Create temporary OpenAI client for testing
        const testClient = new OpenAI({
            apiKey: testKey,
            dangerouslyAllowBrowser: true
        });

        // Make a simple API call to test the key
        await testClient.models.list();
        
        // If we get here, the key works
        alert('✅ API key test successful! The key is valid and working.');
        
        // If this was a new key, save it
        if (settingsApiKeyInput.value.trim() && testKey !== apiKey) {
            localStorage.setItem(STORAGE_KEYS.API_KEY, testKey);
            apiKey = testKey;
            initializeOpenAI(apiKey);
            updateApiStatus();
        }
        
    } catch (error) {
        console.error('API key test failed:', error);
        let errorMessage = '❌ API key test failed: ';
        
        if (error.status === 401) {
            errorMessage += 'Invalid API key';
        } else if (error.status === 429) {
            errorMessage += 'Rate limit exceeded';
        } else if (error.status === 403) {
            errorMessage += 'Access forbidden - check your API key permissions';
        } else {
            errorMessage += error.message || 'Unknown error';
        }
        
        alert(errorMessage);
    } finally {
        // Restore button state
        testSettingsKeyButton.textContent = originalText;
        testSettingsKeyButton.disabled = false;
    }
}

function saveSystemMessage() {
    const systemMessage = settingsSystemMessageInput.value.trim();
    
    if (!systemMessage) {
        alert('Please enter a system message');
        return;
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.SYSTEM_MESSAGE, systemMessage);
    alert('System message saved successfully!');
}

function saveGroundingText() {
    const groundingText = settingsGroundingTextInput.value.trim();
    
    if (!groundingText) {
        alert('Please enter grounding information');
        return;
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.GROUNDING_TEXT, groundingText);
    alert('Grounding information saved successfully!');
}

function getStoredSystemMessage() {
    const stored = localStorage.getItem(STORAGE_KEYS.SYSTEM_MESSAGE);
    return stored || settingsSystemMessageInput.value;
}

function getStoredGroundingText() {
    const stored = localStorage.getItem(STORAGE_KEYS.GROUNDING_TEXT);
    return stored || settingsGroundingTextInput.value;
}

function toggleMarkdownPreview() {
    const isPreviewMode = markdownToggle.checked;
    
    if (isPreviewMode) {
        // Show preview, hide textarea
        settingsGroundingTextInput.style.display = 'none';
        markdownPreview.style.display = 'block';
        updateMarkdownPreview();
    } else {
        // Show textarea, hide preview
        settingsGroundingTextInput.style.display = 'block';
        markdownPreview.style.display = 'none';
    }
}

function updateMarkdownPreview() {
    if (markdownToggle.checked) {
        const text = settingsGroundingTextInput.value;
        if (text.trim()) {
            markdownPreview.innerHTML = marked.parse(text);
        } else {
            markdownPreview.innerHTML = '<p style="color: #999; font-style: italic;">No content to preview</p>';
        }
    }
}

function handleModelChange() {
    const selectedModel = modelSelect.value;
    if (selectedModel === 'gpt-5') {
        gpt5Controls.style.display = 'flex';
    } else {
        gpt5Controls.style.display = 'none';
    }
}

function initializeOpenAI(key) {
    try {
        openai = new OpenAI({
            apiKey: key,
            dangerouslyAllowBrowser: true
        });

        // Enable chat interface
        messageInput.disabled = false;
        sendButton.disabled = false;
        
        console.log('OpenAI initialized successfully, input enabled:', !messageInput.disabled);
        return true;
    } catch (error) {
        console.error('Error initializing OpenAI:', error);
        return false;
    }
}


async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message || !openai) {
        return;
    }

    // Check if this is the start of a new conversation and add grounding if needed
    const groundingText = getStoredGroundingText();
    if (conversationHistory.length === 0 && groundingText) {
        // Add grounding message to conversation history (but not to UI)
        conversationHistory.push({ role: 'user', content: groundingText });
        
        // Check if grounding is saved or using default
        const storedGrounding = localStorage.getItem(STORAGE_KEYS.GROUNDING_TEXT);
        if (storedGrounding) {
            // Show confirmation for saved grounding
            addMessage('system', '✅ Grounding information added');
        } else {
            // Show message about using default grounding and prompt to save
            addMessage('system', '✅ Using default grounding information. Go to Settings and click "Save Grounding" to customize and persist your grounding context.');
        }
    }

    // Add user message to chat and history
    addMessage('user', message);
    conversationHistory.push({ role: 'user', content: message });

    // Clear input
    messageInput.value = '';

    // Disable input while processing
    messageInput.disabled = true;
    sendButton.disabled = true;

    // Always use streaming
    const selectedModel = modelSelect.value;

    try {
        await handleStreamingResponse(selectedModel);
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        addMessage('assistant', 'Sorry, there was an error processing your request. Please check your API key and try again.');
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}


async function handleStreamingResponse(selectedModel) {
    // Build conversation with system message and history
    const systemMessage = getStoredSystemMessage();
    const conversationInput = [
        { role: 'system', content: systemMessage },
        ...conversationHistory
    ];

    // Count tokens for the input
    const fullConversationText = conversationInput.map(msg => msg.content).join(' ');
    const tokenCount = countTokens(fullConversationText, selectedModel);
    
    // Create loading message with spinner and info
    const loadingHTML = `
        <div class="loading-message">
            <div class="spinner"></div>
            <div class="loading-info">
                <div class="loading-model">Streaming ${selectedModel.toUpperCase()}</div>
                <div class="loading-tokens">Input tokens: ${tokenCount.toLocaleString()}</div>
            </div>
        </div>
    `;
    
    const loadingId = addMessage('assistant', loadingHTML, true);

    // Build request parameters for streaming
    const streamRequestParams = {
        model: selectedModel,
        input: conversationInput,
        tools: [
            {
                type: "web_search_preview"
            }
        ],
        stream: true
    };

    // Add GPT-5 specific parameters
    if (selectedModel === 'gpt-5') {
        streamRequestParams.reasoning = {
            effort: reasoningSelect.value
        };
        streamRequestParams.text = {
            verbosity: verbositySelect.value
        };
    }

    // Create streaming response
    const stream = await openai.responses.create(streamRequestParams);

    // Create message element for streaming
    let assistantMessageId = null;
    let streamingText = '';
    let citations = [];

    // Process streaming events
    for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
            // Add text delta
            if (!assistantMessageId) {
                // Remove loading message and create streaming message
                removeMessage(loadingId);
                assistantMessageId = addMessage('assistant', '');
            }
            streamingText += event.delta;
            updateMessage(assistantMessageId, streamingText);
        }
        
        if (event.type === 'response.output_text.annotation.added') {
            // Collect citations
            if (event.annotation.type === 'url_citation') {
                citations.push(event.annotation.url);
            }
        }
        
        if (event.type === 'response.completed') {
            // Add assistant response to conversation history
            conversationHistory.push({ role: 'assistant', content: streamingText });
            
            // Render as markdown if it contains markdown content
            if (assistantMessageId) {
                renderMessageAsMarkdown(assistantMessageId, streamingText);
            }
            
            // Add citations if available
            if (citations.length > 0) {
                const citationText = `Sources: ${citations.slice(0, 3).join(', ')}`;
                addMessage('system', citationText);
            }
        }
        
        if (event.type === 'error') {
            console.error('Streaming error:', event);
            if (!assistantMessageId) {
                addMessage('assistant', 'Sorry, there was an error processing your request.');
            } else {
                updateMessage(assistantMessageId, streamingText + '\n\n[Error occurred during streaming]');
            }
        }
    }
}

function addMessage(role, content, isLoading = false) {
    const messageId = Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.id = `message-${messageId}`;
    
    if (isLoading) {
        // Create loading message with spinner
        messageDiv.innerHTML = content; // content is already HTML for loading
    } else {
        // Create message content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        // Create copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '📋';
        copyButton.title = 'Copy to clipboard';
        copyButton.onclick = () => copyToClipboard(content);
        
        // Assemble message
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(copyButton);
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageId;
}

function updateMessage(messageId, content, isStreaming = true) {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
        const contentDiv = messageElement.querySelector('.message-content');
        if (contentDiv) {
            if (isStreaming) {
                // During streaming, just update as plain text
                contentDiv.textContent = content;
            } else {
                // After streaming is complete, check for markdown and render if needed
                if (hasMarkdownContent(content)) {
                    contentDiv.innerHTML = marked.parse(content);
                } else {
                    contentDiv.textContent = content;
                }
            }
        }
        // Update copy button to copy the raw content (not HTML)
        const copyButton = messageElement.querySelector('.copy-button');
        if (copyButton) {
            copyButton.onclick = () => copyToClipboard(content);
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function renderMessageAsMarkdown(messageId, content) {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
        const contentDiv = messageElement.querySelector('.message-content');
        if (contentDiv && hasMarkdownContent(content)) {
            contentDiv.innerHTML = marked.parse(content);
        }
    }
}

function removeMessage(messageId) {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
        messageElement.remove();
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show brief feedback
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = 'Copied to clipboard!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

function clearMessages() {
    messagesContainer.innerHTML = '';
    conversationHistory = [];
    addMessage('system', 'Chat cleared. Start a new conversation!');
}
