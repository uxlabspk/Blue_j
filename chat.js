document.addEventListener("DOMContentLoaded", () => {
  const messagesContainer = document.getElementById("messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");

  let isGenerating = false;

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

  function clearEmptyState() {
    const emptyState = messagesContainer.querySelector(".empty-state");
    if (emptyState) {
      emptyState.remove();
    }
  }

  function createMessageElement(sender) {
    clearEmptyState();

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);

    const headerDiv = document.createElement("div");
    headerDiv.classList.add("message-header");
    headerDiv.textContent = sender === "user" ? "You" : "Assistant";

    const contentDiv = document.createElement("div");
    contentDiv.classList.add("message-content");

    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return contentDiv;
  }

  function addMessage(message, sender) {
    const contentDiv = createMessageElement(sender);

    if (sender === "assistant") {
      // Render markdown with code highlighting
      contentDiv.innerHTML = marked.parse(message);
    } else {
      contentDiv.textContent = message;
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addTypingIndicator() {
    const contentDiv = createMessageElement("assistant");
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("typing-indicator");
    typingDiv.innerHTML = "<span></span><span></span><span></span>";
    contentDiv.appendChild(typingDiv);
    return contentDiv;
  }

  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isGenerating) return;

    isGenerating = true;
    sendButton.disabled = true;
    sendButton.textContent = "Sending...";

    addMessage(message, "user");
    messageInput.value = "";

    const typingIndicator = addTypingIndicator();

    try {
      const response = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3:0.6b", //"qwen2.5-coder:7b",
          prompt: message,
          stream: true, // Enable streaming
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Remove typing indicator
      typingIndicator.parentElement.remove();

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
              // Render markdown in real-time
              contentDiv.innerHTML = marked.parse(fullResponse);
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          } catch (e) {
            // Skip invalid JSON lines
            console.warn("Failed to parse line:", line);
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      typingIndicator.parentElement.remove();
      addMessage(
        "❌ Failed to send message. Please check if Ollama is running.",
        "assistant",
      );
    } finally {
      isGenerating = false;
      sendButton.disabled = false;
      sendButton.textContent = "Send";
    }
  }

  sendButton.addEventListener("click", sendMessage);

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});
