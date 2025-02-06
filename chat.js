class ChatUI {
    constructor() {
        this.chatHistory = document.getElementById('chatHistory');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.conversationHistory = [];
        this.modelSelect = document.getElementById('modelSelect');
        
        // 初始化对话历史
        this.loadConversationHistory();
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        this.modelSelect.addEventListener('change', () => this.handleModelChange());
    }

    handleModelChange() {
        const modelName = this.modelSelect.options[this.modelSelect.selectedIndex].text;
        this.startNewChat(modelName);
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        // 显示加载状态
        this.sendButton.disabled = true;
        this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // 添加用户消息
        this.addMessage(message, 'user');
        this.conversationHistory.push({
            role: "user",
            content: message
        });
        this.userInput.value = '';

        try {
            // 显示思考提示
            const thinkingId = this.addThinkingMessage();
            
            const response = await this.callDeepseekAPI(message);
            
            // 移除思考提示
            this.removeMessage(thinkingId);
            
            this.addMessage(response, 'ai');
            this.conversationHistory.push({
                role: "assistant",
                content: response
            });
            
            this.saveConversationHistory();
        } catch (error) {
            console.error('错误:', error);
            this.addMessage('抱歉，发生了错误，请稍后重试。', 'ai');
        } finally {
            this.sendButton.disabled = false;
            this.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    async callDeepseekAPI(message) {
        const model = this.modelSelect.value;
        const thinkingProcess = {
            understanding: '问题理解：\n',
            context: '背景分析：\n',
            approach: '解决思路：\n',
            knowledge: '知识储备：\n',
            reasoning: '推理过程：\n',
            evaluation: '方案评估：\n',
            conclusion: '最终答案：\n'
        };

        let lastError = null;
        // 尝试使用所有可用的API密钥
        for (let attempt = 0; attempt < CONFIG.API_KEYS.length; attempt++) {
            try {
                const currentKey = CONFIG.API_KEYS[CONFIG.currentKeyIndex];
                
                // 添加超时控制
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 增加到15秒超时

                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            systemMessage,
                            ...this.conversationHistory,
                            {
                                role: "user",
                                content: `请按照以下格式详细分析并回答问题：

                                ${thinkingProcess.understanding}
                                ${thinkingProcess.context}
                                ${thinkingProcess.approach}
                                ${thinkingProcess.knowledge}
                                ${thinkingProcess.reasoning}
                                ${thinkingProcess.evaluation}
                                ${thinkingProcess.conclusion}

                                用户问题：${message}`
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 2000,
                        stream: false
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    // 记录错误状态码
                    const errorStatus = response.status;
                    
                    // 根据不同错误类型处理
                    if (errorStatus === 401 || errorStatus === 429) {
                        console.log(`API密钥 ${CONFIG.currentKeyIndex + 1} 无效或超限，切换到下一个密钥`);
                        this.showApiSwitchingMessage(`API密钥 ${CONFIG.currentKeyIndex + 1} 无效，正在切换...`);
                    } else if (errorStatus >= 500) {
                        console.log(`服务器错误 ${errorStatus}，尝试切换到备用服务器...`);
                        this.showApiSwitchingMessage('服务器响应异常，正在切换线路...');
                    }
                    
                    CONFIG.currentKeyIndex = (CONFIG.currentKeyIndex + 1) % CONFIG.API_KEYS.length;
                    lastError = new Error(`API请求失败: ${errorStatus}`);
                    continue;
                }

                const data = await response.json();
                return data.choices[0].message.content;

            } catch (error) {
                console.error(`API密钥 ${CONFIG.currentKeyIndex + 1} 调用错误:`, error);
                lastError = error;
                
                // 处理不同类型的错误
                if (error.name === 'AbortError') {
                    this.showApiSwitchingMessage('连接超时，正在切换到更快的线路...');
                } else if (error.message.includes('network')) {
                    this.showApiSwitchingMessage('网络不稳定，正在切换备用线路...');
                } else {
                    this.showApiSwitchingMessage('遇到错误，正在切换备用服务器...');
                }
                
                // 如果还有其他API密钥可用，继续尝试
                if (attempt < CONFIG.API_KEYS.length - 1) {
                    CONFIG.currentKeyIndex = (CONFIG.currentKeyIndex + 1) % CONFIG.API_KEYS.length;
                    continue;
                }
            }
        }
        
        // 如果所有API都失败了，抛出最后一个错误
        throw lastError || new Error('所有API密钥都无法使用，请稍后重试');
    }

    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = type === 'ai' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.textContent = type === 'ai' ? 
            this.modelSelect.options[this.modelSelect.selectedIndex].text : 
            '我';

        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        
        // 处理markdown格式
        if (type === 'ai') {
            // 使用正则表达式添加样式类
            const formattedContent = content
                .replace(/^问题理解[：:]\n*/m, '<div class="thinking-section understanding"><strong>问题理解：</strong>\n')
                .replace(/^背景分析[：:]\n*/m, '</div><div class="thinking-section context"><strong>🌍 背景分析：</strong>\n')
                .replace(/^解决思路[：:]\n*/m, '</div><div class="thinking-section approach"><strong>💡 解决思路：</strong>\n')
                .replace(/^知识储备[：:]\n*/m, '</div><div class="thinking-section knowledge"><strong>📚 知识储备：</strong>\n')
                .replace(/^推理过程[：:]\n*/m, '</div><div class="thinking-section reasoning"><strong>🔄 推理过程：</strong>\n')
                .replace(/^方案评估[：:]\n*/m, '</div><div class="thinking-section evaluation"><strong>⚖️ 方案评估：</strong>\n')
                .replace(/^最终答案[：:]\n*/m, '</div><div class="thinking-section conclusion"><strong>✨ 最终答案：</strong>\n')
                + '</div>';
            
            messageText.innerHTML = formattedContent;
        } else {
            messageText.textContent = content;
        }

        messageContent.appendChild(messageHeader);
        messageContent.appendChild(messageText);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);

        this.chatHistory.appendChild(messageDiv);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    startNewChat(modelName = 'Weston AI') {
        this.chatHistory.innerHTML = '';
        this.conversationHistory = [];
        const welcomeMessage = `你好！我是${modelName}，请告诉我你需要什么帮助。`;
        this.addMessage(welcomeMessage, 'ai');
        this.conversationHistory.push({
            role: "assistant",
            content: welcomeMessage
        });
        this.saveConversationHistory();
    }

    saveConversationHistory() {
        const historyData = {
            messages: this.conversationHistory,
            model: this.modelSelect.value,
            timestamp: new Date().toISOString()
        };
        
        // 保存当前会话
        localStorage.setItem('currentChat', JSON.stringify(historyData));
        
        // 更新历史记录列表
        let allChats = this.getSavedChats();
        allChats.unshift(historyData); // 添加到开头
        if (allChats.length > 10) allChats = allChats.slice(0, 10); // 只保留最近10条
        localStorage.setItem('allChats', JSON.stringify(allChats));
        
        this.updateHistoryList();
    }

    loadConversationHistory() {
        const savedChat = localStorage.getItem('currentChat');
        if (savedChat) {
            const historyData = JSON.parse(savedChat);
            this.conversationHistory = historyData.messages;
            this.modelSelect.value = historyData.model;
            
            // 重新显示所有消息
            this.chatHistory.innerHTML = '';
            this.conversationHistory.forEach(msg => {
                this.addMessage(msg.content, msg.role === 'assistant' ? 'ai' : 'user');
            });
        }
        this.updateHistoryList();
    }

    updateHistoryList() {
        const historyList = document.getElementById('chatHistoryList');
        historyList.innerHTML = '';
        
        const savedChats = this.getSavedChats();
        savedChats.forEach((chat, index) => {
            const chatItem = document.createElement('div');
            chatItem.className = 'history-item';
            
            // 获取对话的第一条消息作为标题
            const firstMessage = chat.messages[0]?.content || '新对话';
            const title = firstMessage.length > 20 ? firstMessage.substring(0, 20) + '...' : firstMessage;
            
            chatItem.innerHTML = `
                <div class="history-title">${title}</div>
                <div class="history-time">${new Date(chat.timestamp).toLocaleString('zh-CN')}</div>
            `;
            chatItem.addEventListener('click', () => this.loadChat(chat));
            historyList.appendChild(chatItem);
        });
    }

    getSavedChats() {
        const savedChats = localStorage.getItem('allChats');
        return savedChats ? JSON.parse(savedChats) : [];
    }

    loadChat(chat) {
        this.conversationHistory = chat.messages;
        this.modelSelect.value = chat.model;
        
        this.chatHistory.innerHTML = '';
        this.conversationHistory.forEach(msg => {
            this.addMessage(msg.content, msg.role === 'assistant' ? 'ai' : 'user');
        });
    }

    // 添加新方法来显示思考过程
    addThinkingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message thinking';
        const uniqueId = 'thinking-' + Date.now();
        messageDiv.id = uniqueId;
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.textContent = this.modelSelect.options[this.modelSelect.selectedIndex].text;

        const messageText = document.createElement('div');
        messageText.className = 'message-text thinking-text';
        
        // 添加思考过程的动画文本
        const thinkingSteps = [
            'Weston正在理解问题...',
            'Weston在分析相关信息...',
            'Weston在组织语言...',
            'Weston正在生成回答...'
        ];
        
        thinkingSteps.forEach((step, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'thinking-step';
            stepDiv.innerHTML = `
                <span class="step-dot">
                    <i class="fas fa-circle-notch fa-spin"></i>
                </span>
                <span class="step-text">${step}</span>
            `;
            stepDiv.style.animationDelay = `${index * 0.5}s`;
            messageText.appendChild(stepDiv);
        });

        messageContent.appendChild(messageHeader);
        messageContent.appendChild(messageText);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);

        this.chatHistory.appendChild(messageDiv);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
        
        return uniqueId;
    }

    // 添加移除消息的方法
    removeMessage(messageId) {
        const messageDiv = document.getElementById(messageId);
        if (messageDiv) {
            messageDiv.remove();
        }
    }

    // 更新API切换提示方法
    showApiSwitchingMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">
                    <i class="fas fa-sync-alt fa-spin"></i> ${message}
                </div>
            </div>
        `;
        this.chatHistory.appendChild(messageDiv);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
        
        // 3秒后移除提示消息
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// 初始化聊天界面
document.addEventListener('DOMContentLoaded', () => {
    new ChatUI();
}); 