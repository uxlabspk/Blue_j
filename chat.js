document.addEventListener("DOMContentLoaded", () => {
  const messagesContainer = document.getElementById("messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const sidebar = document.getElementById("sidebar");
  const sidebarClose = document.getElementById("sidebar-close");
  const sidebarOpen = document.getElementById("sidebar-open");
  const newChatBtn = document.getElementById("new-chat-btn");
  const emptyState = document.getElementById("empty-state");
  const suggestionCards = document.querySelectorAll(".suggestion-card");

  let isGenerating = false;
  let abortController = null;

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

  // ===== New Chat =====
  newChatBtn.addEventListener("click", () => {
    messagesContainer.innerHTML = "";
    if (emptyState) {
      messagesContainer.appendChild(createEmptyState());
    }
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendButton.disabled = true;
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
    avatarDiv.textContent = sender === "user" ? "Y" : "AI";

    const bodyDiv = document.createElement("div");
    bodyDiv.classList.add("message-body");

    const senderDiv = document.createElement("div");
    senderDiv.classList.add("message-sender");
    senderDiv.textContent = sender === "user" ? "You" : "Ollama";

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

  function addMessage(message, sender) {
    const contentDiv = createMessageElement(sender);

    if (sender === "assistant") {
      contentDiv.innerHTML = marked.parse(message);
      addCopyButtons(contentDiv);
    } else {
      contentDiv.textContent = message;
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

  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isGenerating) return;

    isGenerating = true;
    sendButton.disabled = true;
    messageInput.value = "";
    messageInput.style.height = "auto";

    addMessage(message, "user");

    const typingIndicator = addTypingIndicator();
    showStopButton();

    abortController = new AbortController();

    try {
      const response = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3:0.6b",
          prompt: message,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Remove typing indicator
      typingIndicator.parentElement.parentElement.remove();

      // Create new message for streaming content
      const contentDiv = createMessageElement("assistant");
      let fullResponse = "";

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              fullResponse += data.response;
              contentDiv.innerHTML = marked.parse(fullResponse);
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          } catch (e) {
            console.warn("Failed to parse line:", line);
          }
        }
      }

      // Add copy buttons after streaming is complete
      addCopyButtons(contentDiv);
    } catch (error) {
      if (error.name === "AbortError") {
        typingIndicator.parentElement?.parentElement?.remove();
        addMessage("Generation stopped.", "assistant");
      } else {
        console.error("Error sending message:", error);
        typingIndicator.parentElement?.parentElement?.remove();
        addMessage(
          "Failed to send message. Please check if Ollama is running.",
          "assistant",
        );
      }
    } finally {
      isGenerating = false;
      sendButton.disabled = !messageInput.value.trim();
      abortController = null;
      hideStopButton();
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
