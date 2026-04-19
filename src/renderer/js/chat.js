document.addEventListener("DOMContentLoaded", () => {
  const messagesContainer = document.getElementById("messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const sidebar = document.getElementById("sidebar");
  const sidebarClose = document.getElementById("sidebar-close");
  const sidebarOpen = document.getElementById("sidebar-open");
  const newChatBtn = document.getElementById("new-chat-btn");
  const sidebarConversations = document.getElementById("sidebar-conversations");
  const suggestionCards = document.querySelectorAll(".suggestion-card");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const modalClose = document.getElementById("modal-close");
  const cancelBtn = document.getElementById("cancel-btn");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const backendSelect = document.getElementById("backend-select");
  const endpointInput = document.getElementById("endpoint-input");
  const endpointHelpText = document.getElementById("endpoint-help-text");
  const modelSelect = document.getElementById("model-select");
  const usernameInput = document.getElementById("username-input");
  const systemPromptInput = document.getElementById("system-prompt-input");
  const mistralApiKeyGroup = document.getElementById("mistral-api-key-group");
  const mistralApiKeyInput = document.getElementById("mistral-api-key-input");
  const mistralKeyStatus = document.getElementById("mistral-key-status");
  const clearMistralKeyBtn = document.getElementById("clear-mistral-key-btn");
  const fileInput = document.getElementById("file-input");
  const attachFileBtn = document.getElementById("attach-file-btn");
  const fileAttachmentsContainer = document.getElementById("file-attachments");

  let isGenerating = false;
  let abortController = null;
  let currentChatId = null;
  let attachedFiles = [];

  // ===== Conversation Storage =====
  const STORAGE_KEY = "ollama_conversations";
  const SETTINGS_KEY = "ollama_settings";
  const MISTRAL_API_KEY_SECRET = "mistral_api_key";

  // ===== Electron Integration =====
  // Listen for menu shortcuts from Electron
  if (window.electronAPI) {
    window.electronAPI.onNewChat(() => {
      createNewChat();
    });

    window.electronAPI.onOpenSettings(() => {
      openSettingsModal();
    });
  }

  // ===== Settings =====
  // Backend configurations
  const BACKEND_DEFAULTS = {
    ollama: {
      endpoint: "http://127.0.0.1:11434",
      modelsPath: "/api/tags",
      chatPath: "/api/chat",
    },
    llamacpp: {
      endpoint: "http://127.0.0.1:8080",
      modelsPath: "/v1/models",
      chatPath: "/v1/chat/completions",
    },
    lmstudio: {
      endpoint: "http://127.0.0.1:1234",
      modelsPath: "/v1/models",
      chatPath: "/v1/chat/completions",
    },
    mistral: {
      endpoint: "https://api.mistral.ai",
      modelsPath: "/v1/models",
      chatPath: "/v1/chat/completions",
    },
  };

  function defaultUserSettings() {
    return {
      username: "",
      systemPrompt: "",
      model: "NeuralNexusLab/HacKing:latest",
      backend: "ollama",
      endpoint: BACKEND_DEFAULTS.ollama.endpoint,
    };
  }

  function loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      return settings || defaultUserSettings();
    } catch {
      return defaultUserSettings();
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  let userSettings = loadSettings();
  let availableModels = [];

  async function getSecureValue(key) {
    if (window.electronAPI?.secureStore?.get) {
      return window.electronAPI.secureStore.get(key);
    }
    return null;
  }

  async function setSecureValue(key, value) {
    if (window.electronAPI?.secureStore?.set) {
      return window.electronAPI.secureStore.set(key, value);
    }
    throw new Error("Secure storage is unavailable");
  }

  async function deleteSecureValue(key) {
    if (window.electronAPI?.secureStore?.delete) {
      return window.electronAPI.secureStore.delete(key);
    }
    return false;
  }

  async function getMistralApiKey() {
    const value = await getSecureValue(MISTRAL_API_KEY_SECRET);
    return typeof value === "string" ? value.trim() : "";
  }

  // Get API endpoint for current backend
  function getApiEndpoint(path) {
    const backend = userSettings.backend || "ollama";
    const backendConfig = BACKEND_DEFAULTS[backend] || BACKEND_DEFAULTS.ollama;
    const endpoint = userSettings.endpoint || backendConfig.endpoint;
    return `${endpoint}${path}`;
  }

  async function getBackendHeaders(backend, includeContentType = false) {
    const headers = {};

    if (includeContentType) {
      headers["Content-Type"] = "application/json";
    }

    if (backend === "mistral") {
      const apiKey = await getMistralApiKey();
      if (!apiKey) {
        throw new Error(
          "Mistral API key is missing. Open Settings and add your key.",
        );
      }
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return headers;
  }

  async function buildHttpError(response, fallbackMessage) {
    const status = `${response.status} ${response.statusText}`.trim();
    let detail = "";

    try {
      const data = await response.json();
      detail =
        data?.error?.message ||
        data?.message ||
        data?.detail ||
        (typeof data === "string" ? data : "");
    } catch {
      try {
        detail = (await response.text()).trim();
      } catch {
        detail = "";
      }
    }

    if (detail) {
      return new Error(`${fallbackMessage} (${status}): ${detail}`);
    }

    return new Error(`${fallbackMessage} (${status})`);
  }

  function extractContentFromChunkLine(line, backend) {
    const normalized = line.startsWith("data:") ? line.slice(5).trim() : line;

    if (!normalized || normalized === "[DONE]") {
      return "";
    }

    const data = JSON.parse(normalized);

    if (backend === "ollama") {
      // Ollama format: data.message.content
      return data.message?.content || "";
    }

    // OpenAI-compatible streaming format
    return (
      data.choices?.[0]?.delta?.content ||
      data.choices?.[0]?.message?.content ||
      ""
    );
  }

  // Fetch available models from backend
  async function fetchAvailableModels(backendOverride, endpointOverride) {
    try {
      const backend = backendOverride || userSettings.backend || "ollama";
      const backendConfig =
        BACKEND_DEFAULTS[backend] || BACKEND_DEFAULTS.ollama;
      const modelsPath = backendConfig.modelsPath;
      const endpointBase =
        endpointOverride || userSettings.endpoint || backendConfig.endpoint;
      const endpoint = `${endpointBase}${modelsPath}`;
      const headers = await getBackendHeaders(backend);

      const response = await fetch(endpoint, { headers });
      if (!response.ok) {
        throw await buildHttpError(response, "Failed to fetch models");
      }
      const data = await response.json();

      // Parse models based on backend type
      if (backend === "ollama") {
        availableModels = data.models || [];
      } else {
        // OpenAI-compatible model list (llama.cpp, LM Studio, Mistral)
        availableModels = (data.data || []).map((model) => ({
          name: model.id,
          model: model.id,
        }));
      }

      updateModelSelect();
    } catch (error) {
      console.error("Error fetching models:", error);
      modelSelect.innerHTML = `<option value="">${error.message}</option>`;
    }
  }

  function updateModelSelect() {
    modelSelect.innerHTML = "";
    if (availableModels.length === 0) {
      modelSelect.innerHTML = '<option value="">No models available</option>';
      return;
    }
    availableModels.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      if (model.name === userSettings.model) {
        option.selected = true;
      }
      modelSelect.appendChild(option);
    });
  }

  function loadConversations() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveConversations(convos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
  }

  function generateId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function getChatIdFromUrl() {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#/")) {
      return hash.slice(2);
    }
    return null;
  }

  function updateUrl(chatId) {
    if (chatId) {
      window.history.pushState(null, "", `#/${chatId}`);
    } else {
      window.history.pushState(null, "", window.location.pathname);
    }
  }

  function generateTitle(message) {
    // Use first 40 chars of the first user message as title
    const title =
      message.length > 40 ? message.substring(0, 40) + "..." : message;
    return title;
  }

  function ensureConversation(firstMessage) {
    if (!currentChatId) {
      currentChatId = generateId();
      const convos = loadConversations();
      convos[currentChatId] = {
        id: currentChatId,
        title: generateTitle(firstMessage),
        messages: [],
        createdAt: Date.now(),
      };
      saveConversations(convos);
      updateUrl(currentChatId);
      renderSidebar();
    }
  }

  function saveMessage(sender, content) {
    if (!currentChatId) return;
    const convos = loadConversations();
    if (convos[currentChatId]) {
      convos[currentChatId].messages.push({ sender, content });
      saveConversations(convos);
    }
  }

  function renderSidebar() {
    const convos = loadConversations();
    sidebarConversations.innerHTML = "";

    // Sort by createdAt descending (newest first)
    const sorted = Object.values(convos).sort(
      (a, b) => b.createdAt - a.createdAt,
    );

    sorted.forEach((convo) => {
      const item = document.createElement("div");
      item.className =
        "conversation-item" + (convo.id === currentChatId ? " active" : "");
      item.dataset.id = convo.id;

      const titleSpan = document.createElement("span");
      titleSpan.className = "conversation-title";
      titleSpan.textContent = convo.title;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "conversation-delete";
      deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
      deleteBtn.title = "Delete chat";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteConversation(convo.id);
      });

      item.appendChild(titleSpan);
      item.appendChild(deleteBtn);

      item.addEventListener("click", () => {
        loadChat(convo.id);
      });

      sidebarConversations.appendChild(item);
    });
  }

  function deleteConversation(id) {
    const convos = loadConversations();
    delete convos[id];
    saveConversations(convos);

    if (currentChatId === id) {
      currentChatId = null;
      updateUrl(null);
      showEmptyState();
    }
    renderSidebar();
  }

  function showEmptyState() {
    messagesContainer.innerHTML = "";
    messagesContainer.appendChild(createEmptyState());
  }

  function loadChat(chatId) {
    const convos = loadConversations();
    const convo = convos[chatId];
    if (!convo) return;

    currentChatId = chatId;
    updateUrl(chatId);
    messagesContainer.innerHTML = "";

    convo.messages.forEach((msg) => {
      addMessage(msg.content, msg.sender, false); // false = don't save again
    });

    renderSidebar();
    messageInput.focus();
  }

  // Configure marked for better markdown rendering
  marked.setOptions({
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true,
  });

  // ===== Sidebar Toggle =====
  sidebarClose.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

  sidebarOpen.addEventListener("click", () => {
    sidebar.classList.remove("collapsed");
  });

  // ===== Auto-resize textarea =====
  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + "px";
    sendButton.disabled = !messageInput.value.trim();
  });

  // ===== Enable/disable send button =====
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.value.trim() && !isGenerating) {
        sendMessage();
      }
    }
  });

  sendButton.addEventListener("click", sendMessage);

  // ===== Tools Dropdown =====
  const toolsBtn = document.getElementById("tools-btn");
  const toolsDropdown = document.getElementById("tools-dropdown");
  const dropdownPresentationBtn = document.getElementById(
    "dropdown-presentation-btn",
  );
  const dropdownAttachBtn = document.getElementById("dropdown-attach-btn");
  const dropdownVideoBtn = document.getElementById("dropdown-video-btn");

  if (toolsBtn && toolsDropdown) {
    toolsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = toolsDropdown.classList.contains("open");
      toolsDropdown.classList.toggle("open", !isOpen);
      toolsBtn.classList.toggle("active", !isOpen);
    });

    document.addEventListener("click", (e) => {
      if (!toolsBtn.contains(e.target) && !toolsDropdown.contains(e.target)) {
        toolsDropdown.classList.remove("open");
        toolsBtn.classList.remove("active");
      }
    });
  }

  if (dropdownAttachBtn) {
    dropdownAttachBtn.addEventListener("click", () => {
      if (toolsDropdown) toolsDropdown.classList.remove("open");
      if (toolsBtn) toolsBtn.classList.remove("active");
      fileInput.click();
    });
  }

  // ───── Generate Video dropdown button ─────
  if (dropdownVideoBtn) {
    dropdownVideoBtn.addEventListener("click", () => {
      // Close the dropdown
      if (toolsDropdown) toolsDropdown.classList.remove("open");
      if (toolsBtn) toolsBtn.classList.remove("active");

      videoMode = !videoMode;
      dropdownVideoBtn.classList.toggle("active", videoMode);

      // Deactivate canvas mode when switching to video mode
      if (videoMode && canvasMode) {
        canvasMode = false;
        if (dropdownPresentationBtn)
          dropdownPresentationBtn.classList.remove("active");
        if (canvasBtn) canvasBtn.classList.remove("active");
        currentPresentationPath = null;
      }

      if (videoMode) {
        messageInput.placeholder =
          "Describe your video idea (e.g., '5 morning productivity habits')";
        clearAttachedFiles();
      } else {
        messageInput.placeholder = "Message Blue J...";
      }

      messageInput.focus();
    });
  }

  // ===== New Chat =====
  newChatBtn.addEventListener("click", () => {
    currentChatId = null;
    updateUrl(null);
    showEmptyState();
    renderSidebar();
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendButton.disabled = true;
    clearAttachedFiles();
    messageInput.placeholder = "Message Blue J...";
  });

  // ===== Suggestion Cards =====
  suggestionCards.forEach((card) => {
    card.addEventListener("click", () => {
      const prompt = card.getAttribute("data-prompt");
      messageInput.value = prompt;
      messageInput.dispatchEvent(new Event("input"));
      sendMessage();
    });
  });

  // ===== Handle browser back/forward =====
  window.addEventListener("hashchange", () => {
    const chatId = getChatIdFromUrl();
    if (chatId && chatId !== currentChatId) {
      loadChat(chatId);
    } else if (!chatId) {
      currentChatId = null;
      showEmptyState();
      renderSidebar();
    }
  });

  function createEmptyState() {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.id = "empty-state";
    div.innerHTML = `
      <div class="empty-state-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <h2>How can I help you today?</h2>
      <div class="suggestion-grid">
        <button class="suggestion-card" data-prompt="Explain quantum computing in simple terms">
          <span class="suggestion-title">Explain quantum computing</span>
          <span class="suggestion-sub">in simple terms</span>
        </button>
        <button class="suggestion-card" data-prompt="Write a Python script to sort a list of dictionaries by a key">
          <span class="suggestion-title">Write a Python script</span>
          <span class="suggestion-sub">to sort a list of dictionaries</span>
        </button>
        <button class="suggestion-card" data-prompt="What are the best practices for REST API design?">
          <span class="suggestion-title">Best practices</span>
          <span class="suggestion-sub">for REST API design</span>
        </button>
        <button class="suggestion-card" data-prompt="Help me debug a JavaScript async/await issue">
          <span class="suggestion-title">Help me debug</span>
          <span class="suggestion-sub">a JavaScript async/await issue</span>
        </button>
      </div>
    `;
    // Re-bind suggestion cards
    div.querySelectorAll(".suggestion-card").forEach((card) => {
      card.addEventListener("click", () => {
        const prompt = card.getAttribute("data-prompt");
        messageInput.value = prompt;
        messageInput.dispatchEvent(new Event("input"));
        sendMessage();
      });
    });
    return div;
  }

  function clearEmptyState() {
    const es = messagesContainer.querySelector(".empty-state");
    if (es) es.remove();
  }

  function createMessageElement(sender) {
    clearEmptyState();

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);

    const innerDiv = document.createElement("div");
    innerDiv.classList.add("message-inner");

    const avatarDiv = document.createElement("div");
    avatarDiv.classList.add("message-avatar");
    avatarDiv.textContent = sender === "user" ? "Y" : "B";

    const bodyDiv = document.createElement("div");
    bodyDiv.classList.add("message-body");

    const senderDiv = document.createElement("div");
    senderDiv.classList.add("message-sender");
    const displayName =
      sender === "user" ? userSettings.username || "You" : "Blue J";
    senderDiv.textContent = displayName;

    const contentDiv = document.createElement("div");
    contentDiv.classList.add("message-content");

    bodyDiv.appendChild(senderDiv);
    bodyDiv.appendChild(contentDiv);
    innerDiv.appendChild(avatarDiv);
    innerDiv.appendChild(bodyDiv);
    messageDiv.appendChild(innerDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return contentDiv;
  }

  function addMessage(message, sender, persist = true) {
    const contentDiv = createMessageElement(sender);

    if (sender === "assistant") {
      contentDiv.innerHTML = marked.parse(message);
      addCopyButtons(contentDiv);
      addMessageActions(contentDiv, message);
    } else {
      contentDiv.textContent = message;
    }

    if (persist) {
      saveMessage(sender, message);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addCopyButtons(container) {
    container.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".code-header")) return;

      const code = pre.querySelector("code");
      const lang = code
        ? [...code.classList]
            .find((c) => c.startsWith("language-"))
            ?.replace("language-", "") || ""
        : "";

      const header = document.createElement("div");
      header.className = "code-header";
      header.innerHTML = `
        <span>${lang || "code"}</span>
        <button class="copy-btn" onclick="copyCode(this)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy code
        </button>
      `;
      pre.insertBefore(header, pre.firstChild);
    });
  }

  function addMessageActions(contentDiv, message) {
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "message-actions";

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "message-action-btn";
    copyBtn.title = "Copy";
    copyBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(message).then(() => {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
        }, 2000);
      });
    });

    // Regenerate button
    const regenerateBtn = document.createElement("button");
    regenerateBtn.className = "message-action-btn";
    regenerateBtn.title = "Regenerate";
    regenerateBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
    `;
    regenerateBtn.addEventListener("click", () => {
      if (isGenerating) return;
      regenerateResponse();
    });

    // Speak button
    const speakBtn = document.createElement("button");
    speakBtn.className = "message-action-btn";
    speakBtn.title = "Speak";
    speakBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    `;
    speakBtn.addEventListener("click", () => {
      speakMessage(message, speakBtn);
    });

    actionsDiv.appendChild(copyBtn);
    actionsDiv.appendChild(regenerateBtn);
    actionsDiv.appendChild(speakBtn);
    return actionsDiv;
  }

  function regenerateResponse() {
    if (!currentChatId || isGenerating) return;

    const convos = loadConversations();
    const convo = convos[currentChatId];
    if (!convo || convo.messages.length === 0) return;

    // Find the last user message
    let lastUserMessage = null;
    for (let i = convo.messages.length - 1; i >= 0; i--) {
      if (convo.messages[i].sender === "user") {
        lastUserMessage = convo.messages[i].content;
        break;
      }
    }

    if (!lastUserMessage) return;

    // Remove the last assistant message if it exists
    if (
      convo.messages.length > 0 &&
      convo.messages[convo.messages.length - 1].sender === "assistant"
    ) {
      convo.messages.pop();
      saveConversations(convos);

      // Remove the last assistant message from UI
      const messages = messagesContainer.querySelectorAll(".message.assistant");
      if (messages.length > 0) {
        messages[messages.length - 1].remove();
      }
    }

    // Regenerate by sending the last user message again
    generateResponse(lastUserMessage);
  }

  let currentSpeech = null;

  function speakMessage(message, button) {
    // Stop any ongoing speech
    if (currentSpeech) {
      window.speechSynthesis.cancel();
      currentSpeech = null;
      document
        .querySelectorAll(".message-action-btn.speaking")
        .forEach((btn) => {
          btn.classList.remove("speaking");
          btn.title = "Speak";
          btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        `;
        });
      return;
    }

    // Create and start new speech
    const utterance = new SpeechSynthesisUtterance(message);
    currentSpeech = utterance;

    button.classList.add("speaking");
    button.title = "Stop speaking";
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `;

    utterance.onend = () => {
      currentSpeech = null;
      button.classList.remove("speaking");
      button.title = "Speak";
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
      `;
    };

    utterance.onerror = () => {
      currentSpeech = null;
      button.classList.remove("speaking");
      button.title = "Speak";
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
      `;
    };

    window.speechSynthesis.speak(utterance);
  }

  function addTypingIndicator() {
    const contentDiv = createMessageElement("assistant");
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("typing-indicator");
    typingDiv.innerHTML = "<span></span><span></span><span></span>";
    contentDiv.appendChild(typingDiv);
    return contentDiv;
  }

  function showStopButton() {
    const existing = document.querySelector(".stop-btn");
    if (existing) existing.remove();

    const stopBtn = document.createElement("button");
    stopBtn.className = "stop-btn";
    stopBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2"></rect>
      </svg>
      Stop generating
    `;
    stopBtn.addEventListener("click", () => {
      if (abortController) {
        abortController.abort();
      }
    });

    const inputArea = document.querySelector(".input-area");
    inputArea.insertBefore(stopBtn, inputArea.firstChild);
  }

  function hideStopButton() {
    const stopBtn = document.querySelector(".stop-btn");
    if (stopBtn) stopBtn.remove();
  }

  // Helper function to estimate token count (roughly 4 chars per token)
  function estimateTokenCount(text) {
    // Simple approximation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  function addStatsDisplay(contentDiv, stats, actionsDiv) {
    const statsDiv = document.createElement("div");
    statsDiv.className = "message-stats";

    const statsLeft = document.createElement("div");
    statsLeft.className = "message-stats-left";

    const tokensSpan = document.createElement("span");
    tokensSpan.className = "stat-item";
    tokensSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> ${stats.tokens} tokens`;

    const speedSpan = document.createElement("span");
    speedSpan.className = "stat-item";
    speedSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${stats.tokensPerSecond} tokens/s`;

    const timeSpan = document.createElement("span");
    timeSpan.className = "stat-item";
    timeSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${stats.duration}s`;

    statsLeft.appendChild(tokensSpan);
    statsLeft.appendChild(speedSpan);
    statsLeft.appendChild(timeSpan);

    statsDiv.appendChild(statsLeft);
    if (actionsDiv) {
      actionsDiv.className = "message-stats-actions";
      statsDiv.appendChild(actionsDiv);
    }

    contentDiv.appendChild(statsDiv);
  }
  async function generateResponse(message) {
    const typingIndicator = addTypingIndicator();
    showStopButton();

    abortController = new AbortController();

    // Track start time for statistics
    const startTime = Date.now();

    try {
      // Build conversation history
      const messages = [];

      // Add system prompt if configured
      if (userSettings.systemPrompt) {
        messages.push({
          role: "system",
          content: userSettings.systemPrompt,
        });
      }

      // Get conversation history
      if (currentChatId) {
        const convos = loadConversations();
        const convo = convos[currentChatId];
        if (convo && convo.messages) {
          // Add all previous messages
          convo.messages.forEach((msg) => {
            messages.push({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.content,
            });
          });
        }
      }

      // Add the current user message
      messages.push({
        role: "user",
        content: message,
      });

      const backend = userSettings.backend || "ollama";
      const backendConfig =
        BACKEND_DEFAULTS[backend] || BACKEND_DEFAULTS.ollama;
      const chatPath = backendConfig.chatPath;
      const endpoint = getApiEndpoint(chatPath);
      const headers = await getBackendHeaders(backend, true);

      const requestBody = {
        model: userSettings.model || "NeuralNexusLab/HacKing:latest",
        messages: messages,
        stream: true,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw await buildHttpError(response, "Request failed");
      }

      // Remove typing indicator
      typingIndicator.parentElement.parentElement.remove();

      // Create new message for streaming content
      const contentDiv = createMessageElement("assistant");
      let fullResponse = "";

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pendingChunk = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        pendingChunk += decoder.decode(value, { stream: true });
        const lines = pendingChunk.split("\n");
        pendingChunk = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const backend = userSettings.backend || "ollama";
            const content = extractContentFromChunkLine(trimmed, backend);

            if (content) {
              fullResponse += content;
              contentDiv.innerHTML = marked.parse(fullResponse);
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          } catch (e) {
            console.warn("Failed to parse stream line:", trimmed);
          }
        }
      }

      // Flush any remaining partial line after stream completion
      const finalLine = pendingChunk.trim();
      if (finalLine) {
        try {
          const backend = userSettings.backend || "ollama";
          const content = extractContentFromChunkLine(finalLine, backend);
          if (content) {
            fullResponse += content;
            contentDiv.innerHTML = marked.parse(fullResponse);
          }
        } catch (e) {
          console.warn("Failed to parse final stream line:", finalLine);
        }
      }

      if (!fullResponse.trim()) {
        contentDiv.parentElement?.parentElement?.remove();
        throw new Error(
          "No response content received. Check your selected model and backend settings.",
        );
      }

      // Calculate statistics
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      const tokenCount = estimateTokenCount(fullResponse);
      const tokensPerSecond = (tokenCount / parseFloat(duration)).toFixed(2);

      // Add copy buttons after streaming is complete
      addCopyButtons(contentDiv);
      const actionsDiv = addMessageActions(contentDiv, fullResponse);

      // Add statistics display with action buttons
      addStatsDisplay(
        contentDiv,
        {
          tokens: tokenCount,
          tokensPerSecond: tokensPerSecond,
          duration: duration,
        },
        actionsDiv,
      );

      // Save the full assistant response
      saveMessage("assistant", fullResponse);
    } catch (error) {
      if (error.name === "AbortError") {
        typingIndicator.parentElement?.parentElement?.remove();
        addMessage("Generation stopped.", "assistant");
      } else {
        console.error("Error sending message:", error);
        typingIndicator.parentElement?.parentElement?.remove();
        addMessage(error.message || "Failed to send message.", "assistant");
      }
    } finally {
      isGenerating = false;
      sendButton.disabled = !messageInput.value.trim();
      abortController = null;
      hideStopButton();
    }
  }

  // ===== File Upload & Processing =====
  // Configure PDF.js worker
  if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  async function extractTextFromPDF(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += pageText + "\\n";
      }

      return fullText;
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  async function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Failed to read text file"));
      reader.readAsText(file);
    });
  }

  async function processFile(file) {
    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      content: "",
    };

    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      fileData.content = await extractTextFromPDF(file);
      fileData.displayType = "PDF";
    } else if (
      file.type === "text/plain" ||
      file.name.toLowerCase().match(/\\.(txt|text)$/)
    ) {
      fileData.content = await readTextFile(file);
      fileData.displayType = "Text";
    } else {
      throw new Error(
        "Unsupported file type. Only PDF and text files are allowed.",
      );
    }

    return fileData;
  }

  function renderFileAttachments() {
    fileAttachmentsContainer.innerHTML = "";

    if (attachedFiles.length === 0) {
      fileAttachmentsContainer.style.display = "none";
      return;
    }

    fileAttachmentsContainer.style.display = "flex";

    attachedFiles.forEach((file, index) => {
      const fileChip = document.createElement("div");
      fileChip.className = "file-chip";

      const fileIcon = document.createElement("span");
      fileIcon.className = "file-icon";
      fileIcon.innerHTML = file.displayType === "PDF" ? "📄" : "📝";

      const fileName = document.createElement("span");
      fileName.className = "file-name";
      fileName.textContent = file.name;
      fileName.title = file.name;

      const fileSize = document.createElement("span");
      fileSize.className = "file-size";
      fileSize.textContent = formatFileSize(file.size);

      const removeBtn = document.createElement("button");
      removeBtn.className = "file-remove";
      removeBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      removeBtn.addEventListener("click", () => removeFile(index));

      fileChip.appendChild(fileIcon);
      fileChip.appendChild(fileName);
      fileChip.appendChild(fileSize);
      fileChip.appendChild(removeBtn);

      fileAttachmentsContainer.appendChild(fileChip);
    });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function removeFile(index) {
    attachedFiles.splice(index, 1);
    renderFileAttachments();
  }

  function clearAttachedFiles() {
    attachedFiles = [];
    renderFileAttachments();
  }

  function buildContextFromFiles() {
    if (attachedFiles.length === 0) return "";

    let context = "\\n\\n--- Attached Files Context ---\\n";
    attachedFiles.forEach((file) => {
      context += `\\n[File: ${file.name} (${file.displayType})]\\n`;
      context += `${file.content}\\n`;
      context += `[End of ${file.name}]\\n`;
    });
    context += "--- End of Attached Files ---\\n\\n";

    return context;
  }

  // Event listeners for file upload
  // (attach is now triggered via the Tools dropdown)
  if (attachFileBtn) {
    attachFileBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }

  fileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);

    for (const file of files) {
      try {
        const fileData = await processFile(file);
        attachedFiles.push(fileData);
      } catch (error) {
        alert(`Error processing ${file.name}: ${error.message}`);
      }
    }

    renderFileAttachments();
    fileInput.value = ""; // Reset input
  });

  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isGenerating) return;

    isGenerating = true;
    sendButton.disabled = true;
    messageInput.value = "";
    messageInput.style.height = "auto";

    // Create conversation on first message
    ensureConversation(message);

    // Build message with file context if files are attached
    let messageWithContext = message;
    if (attachedFiles.length > 0) {
      messageWithContext = buildContextFromFiles() + message;

      // Show files in user message
      const userMessageContent =
        message +
        "\\n\\n" +
        attachedFiles.map((f) => `📎 ${f.name}`).join("\\n");
      addMessage(userMessageContent, "user");

      // Clear files after sending
      clearAttachedFiles();
    } else {
      addMessage(message, "user");
    }

    await generateResponse(messageWithContext);
  }

  // ── Robust JSON repair for common LLM formatting issues ──
  function repairJSON(raw) {
    let s = raw;

    // 1. Replace smart / curly quotes with straight equivalents
    s = s.replace(/[\u2018\u2019\u0060]/g, "'").replace(/[\u201C\u201D]/g, '"');

    // 2. Strip JS-style line comments and block comments
    s = s.replace(/\/\/[^\n\r]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

    // 3. Remove trailing commas before } or ]
    s = s.replace(/,(\s*[}\]])/g, "$1");

    // 4. Quote unquoted object keys  (word: → "word":)
    s = s.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g, '$1"$2"$3');

    // 5. Convert single-quoted strings → double-quoted (carefully)
    //    Only touches isolated 'value' tokens that are not inside already-quoted strings
    s = s.replace(
      /'((?:[^'\\]|\\.)*)'/g,
      (_, inner) => '"' + inner.replace(/"/g, '\\"') + '"',
    );

    return s;
  }

  function parseModelJSON(raw) {
    // Step 1: strip markdown code fences
    const fenceMatch =
      raw.match(/```json\s*([\s\S]*?)\s*```/) ||
      raw.match(/```\s*([\s\S]*?)\s*```/);
    let cleaned = (fenceMatch ? fenceMatch[1] : raw).trim();

    // Step 2: extract outermost { … }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error(
        "AI did not return a JSON object.\n\nRaw response:\n" +
          raw.slice(0, 400),
      );
    }
    cleaned = cleaned.slice(start, end + 1);

    // Step 3: try native parse first (fast path)
    try {
      return JSON.parse(cleaned);
    } catch (_) {
      // Fall through to repair
    }

    // Step 4: repair and retry
    const repaired = repairJSON(cleaned);
    try {
      return JSON.parse(repaired);
    } catch (err) {
      throw new Error(
        "Could not parse AI response as JSON.\n\n" +
          "Parse error: " +
          err.message +
          "\n\nRaw AI output (first 500 chars):\n" +
          raw.slice(0, 500),
      );
    }
  }

  // ===== Settings Modal =====
  function updateSettingsUiForBackend(backend) {
    const isMistral = backend === "mistral";

    mistralApiKeyGroup.style.display = isMistral ? "block" : "none";

    if (endpointHelpText) {
      endpointHelpText.textContent = isMistral
        ? "Default endpoint: https://api.mistral.ai"
        : "Default ports: Ollama (11434), llama.cpp (8080), LM Studio (1234)";
    }
  }

  async function refreshMistralKeyStatus() {
    const hasSavedKey = Boolean(await getMistralApiKey());
    mistralKeyStatus.textContent = hasSavedKey
      ? "API key saved securely"
      : "No key saved";
    clearMistralKeyBtn.disabled = !hasSavedKey;
  }

  async function openSettingsModal() {
    const backend = userSettings.backend || "ollama";

    backendSelect.value = backend;
    endpointInput.value =
      userSettings.endpoint ||
      (BACKEND_DEFAULTS[backend] || BACKEND_DEFAULTS.ollama).endpoint;
    modelSelect.value = userSettings.model;
    usernameInput.value = userSettings.username;
    systemPromptInput.value = userSettings.systemPrompt;
    mistralApiKeyInput.value = "";

    updateSettingsUiForBackend(backend);
    await refreshMistralKeyStatus();

    settingsModal.classList.add("active");
  }

  // Update endpoint when backend changes
  backendSelect.addEventListener("change", async () => {
    const backend = backendSelect.value;
    const defaultEndpoint = (
      BACKEND_DEFAULTS[backend] || BACKEND_DEFAULTS.ollama
    ).endpoint;
    endpointInput.value = defaultEndpoint;
    updateSettingsUiForBackend(backend);

    // Allow previewing model list per selected backend before saving settings
    await fetchAvailableModels(backend, defaultEndpoint);
  });

  settingsBtn.addEventListener("click", openSettingsModal);

  clearMistralKeyBtn.addEventListener("click", async () => {
    try {
      await deleteSecureValue(MISTRAL_API_KEY_SECRET);
      mistralApiKeyInput.value = "";
      await refreshMistralKeyStatus();
    } catch (error) {
      alert(error.message || "Failed to clear Mistral API key.");
    }
  });

  modalClose.addEventListener("click", () => {
    settingsModal.classList.remove("active");
  });

  cancelBtn.addEventListener("click", () => {
    settingsModal.classList.remove("active");
  });

  saveSettingsBtn.addEventListener("click", async () => {
    try {
      const selectedBackend = backendSelect.value;

      userSettings.backend = backendSelect.value;
      userSettings.endpoint = endpointInput.value.trim();
      userSettings.model = modelSelect.value;
      userSettings.username = usernameInput.value.trim();
      userSettings.systemPrompt = systemPromptInput.value.trim();

      const newMistralKey = mistralApiKeyInput.value.trim();
      if (newMistralKey) {
        await setSecureValue(MISTRAL_API_KEY_SECRET, newMistralKey);
        mistralApiKeyInput.value = "";
      }

      saveSettings(userSettings);
      settingsModal.classList.remove("active");

      if (selectedBackend === "mistral") {
        await refreshMistralKeyStatus();
      }

      // Refresh models after backend change
      await fetchAvailableModels();
    } catch (error) {
      alert(error.message || "Failed to save settings.");
    }
  });

  // Close modal when clicking outside
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove("active");
    }
  });

  // ===== Initialize on page load =====
  renderSidebar();
  fetchAvailableModels();
  const initialChatId = getChatIdFromUrl();
  if (initialChatId) {
    const convos = loadConversations();
    if (convos[initialChatId]) {
      loadChat(initialChatId);
    }
  }
});

// Global copy function for code blocks
window.copyCode = function (btn) {
  const pre = btn.closest("pre");
  const code = pre.querySelector("code");
  const text = code ? code.textContent : pre.textContent;

  navigator.clipboard.writeText(text).then(() => {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Copied!
    `;
    setTimeout(() => {
      btn.innerHTML = originalHTML;
    }, 2000);
  });
};
