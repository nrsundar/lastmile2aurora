/**
 * Interactive SQL Migration Chatbot Assistant
 */

class SQLMigrationChatbot {
    constructor() {
        this.isOpen = false;
        this.conversationHistory = [];
        this.knowledgeBase = this.initializeKnowledgeBase();
        this.init();
    }

    init() {
        this.createChatbotHTML();
        this.setupEventListeners();
        this.addWelcomeMessage();
    }

    createChatbotHTML() {
        const chatbotHTML = `
            <div id="sql-chatbot" class="chatbot-container">
                <div class="chatbot-header">
                    <div class="chatbot-title">
                        <i class="fas fa-robot me-2"></i>
                        SQL Migration Assistant
                    </div>
                    <button class="chatbot-toggle" id="chatbot-minimize">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="chatbot-close" id="chatbot-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="chatbot-messages" id="chatbot-messages">
                    <!-- Messages will be added here -->
                </div>
                <div class="chatbot-input-container">
                    <div class="quick-actions">
                        <button class="quick-action-btn" data-action="oracle-migration">Oracle Migration</button>
                        <button class="quick-action-btn" data-action="sql-server-migration">SQL Server Migration</button>
                        <button class="quick-action-btn" data-action="performance-tips">Performance Tips</button>
                        <button class="quick-action-btn" data-action="aurora-features">Aurora Features</button>
                    </div>
                    <div class="input-group">
                        <input type="text" class="form-control" id="chatbot-input" 
                               placeholder="Ask me about SQL migration to Aurora PostgreSQL...">
                        <button class="btn btn-primary" id="chatbot-send">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="chatbot-launcher" id="chatbot-launcher">
                <i class="fas fa-comments"></i>
                <span class="notification-badge" id="chatbot-badge">1</span>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    }

    setupEventListeners() {
        const launcher = document.getElementById('chatbot-launcher');
        const chatbot = document.getElementById('sql-chatbot');
        const minimizeBtn = document.getElementById('chatbot-minimize');
        const closeBtn = document.getElementById('chatbot-close');
        const sendBtn = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');
        const quickActions = document.querySelectorAll('.quick-action-btn');

        launcher.addEventListener('click', () => this.toggleChatbot());
        minimizeBtn.addEventListener('click', () => this.minimizeChatbot());
        closeBtn.addEventListener('click', () => this.closeChatbot());
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        quickActions.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });
    }

    initializeKnowledgeBase() {
        return {
            'oracle-migration': {
                title: 'Oracle to Aurora PostgreSQL Migration',
                responses: [
                    "Here are the key steps for Oracle to Aurora PostgreSQL migration:",
                    "1. **Data Types**: Replace Oracle-specific types (VARCHAR2 → VARCHAR, NUMBER → NUMERIC)",
                    "2. **Functions**: Convert SYSDATE → CURRENT_TIMESTAMP, NVL → COALESCE, TO_DATE → TO_TIMESTAMP",
                    "3. **PL/SQL**: Rewrite packages and procedures using PL/pgSQL",
                    "4. **Sequences**: Convert Oracle sequences to PostgreSQL SERIAL or IDENTITY columns",
                    "5. **Optimizer Hints**: Remove Oracle hints and rely on PostgreSQL's query planner"
                ],
                followUp: "Would you like specific examples of any of these conversions?"
            },
            'sql-server-migration': {
                title: 'SQL Server to Aurora PostgreSQL Migration',
                responses: [
                    "SQL Server to Aurora PostgreSQL migration involves these key areas:",
                    "1. **T-SQL to PL/pgSQL**: Convert stored procedures and functions",
                    "2. **Data Types**: NVARCHAR → VARCHAR, DATETIME → TIMESTAMP, UNIQUEIDENTIFIER → UUID",
                    "3. **Control Flow**: IF/BEGIN/END → IF/THEN/END IF",
                    "4. **Variables**: @variable → variable declarations in DECLARE blocks",
                    "5. **Error Handling**: TRY/CATCH → EXCEPTION blocks"
                ],
                followUp: "Do you need help with specific T-SQL constructs?"
            },
            'performance-tips': {
                title: 'Aurora PostgreSQL Performance Optimization',
                responses: [
                    "Here are key performance optimization strategies:",
                    "1. **Indexing**: Create appropriate B-tree, GIN, and GiST indexes",
                    "2. **Query Optimization**: Use EXPLAIN ANALYZE to understand execution plans",
                    "3. **Connection Pooling**: Implement pgBouncer or Aurora's built-in pooling",
                    "4. **Parallel Queries**: Enable Aurora Parallel Query for analytical workloads",
                    "5. **Read Replicas**: Distribute read traffic across multiple Aurora replicas"
                ],
                followUp: "Would you like to run a performance test to see these optimizations in action?"
            },
            'aurora-features': {
                title: 'Aurora PostgreSQL Specific Features',
                responses: [
                    "Aurora PostgreSQL offers these unique advantages:",
                    "1. **Aurora Parallel Query**: 10x faster analytics on large datasets",
                    "2. **Fast Cloning**: Create database copies in minutes, not hours",
                    "3. **Backtrack**: Rewind database to any point in time without restore",
                    "4. **Global Database**: Multi-region setup with <1 second replication",
                    "5. **Serverless v2**: Auto-scaling from 0.5 to 128 ACUs based on demand"
                ],
                followUp: "Which Aurora feature interests you most for your use case?"
            },
            'common-issues': {
                title: 'Common Migration Issues',
                responses: [
                    "Watch out for these common migration pitfalls:",
                    "1. **Case Sensitivity**: PostgreSQL is case-sensitive for identifiers",
                    "2. **String Concatenation**: Use || instead of + for string operations",
                    "3. **Boolean Values**: Use true/false instead of 1/0",
                    "4. **Date Arithmetic**: Different syntax for date calculations",
                    "5. **Transaction Isolation**: PostgreSQL's MVCC behaves differently"
                ],
                followUp: "Are you experiencing any of these specific issues?"
            }
        };
    }

    addWelcomeMessage() {
        const welcomeMessage = {
            type: 'bot',
            content: `Welcome! I'm your SQL Migration Assistant. I can help you with:
            
• Oracle to Aurora PostgreSQL migration
• SQL Server to Aurora PostgreSQL migration  
• Performance optimization tips
• Aurora-specific features and best practices

Click the quick action buttons below or ask me anything about SQL migration!`,
            timestamp: new Date()
        };
        this.addMessage(welcomeMessage);
    }

    toggleChatbot() {
        const chatbot = document.getElementById('sql-chatbot');
        const badge = document.getElementById('chatbot-badge');
        
        if (this.isOpen) {
            this.closeChatbot();
        } else {
            chatbot.style.display = 'flex';
            this.isOpen = true;
            badge.style.display = 'none';
            this.scrollToBottom();
        }
    }

    minimizeChatbot() {
        const chatbot = document.getElementById('sql-chatbot');
        chatbot.style.display = 'none';
        this.isOpen = false;
    }

    closeChatbot() {
        const chatbot = document.getElementById('sql-chatbot');
        chatbot.style.display = 'none';
        this.isOpen = false;
    }

    sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();
        
        if (!message) return;

        // Add user message
        this.addMessage({
            type: 'user',
            content: message,
            timestamp: new Date()
        });

        input.value = '';
        
        // Generate bot response
        setTimeout(() => {
            const response = this.generateResponse(message);
            this.addMessage({
                type: 'bot',
                content: response,
                timestamp: new Date()
            });
        }, 500);
    }

    handleQuickAction(action) {
        const knowledge = this.knowledgeBase[action];
        if (knowledge) {
            this.addMessage({
                type: 'user',
                content: knowledge.title,
                timestamp: new Date()
            });

            setTimeout(() => {
                const response = knowledge.responses.join('\n\n') + '\n\n' + knowledge.followUp;
                this.addMessage({
                    type: 'bot',
                    content: response,
                    timestamp: new Date()
                });
            }, 300);
        }
    }

    generateResponse(userMessage) {
        const message = userMessage.toLowerCase();
        
        // Keyword-based responses
        if (message.includes('oracle')) {
            return this.knowledgeBase['oracle-migration'].responses.join('\n\n') + '\n\n' + 
                   this.knowledgeBase['oracle-migration'].followUp;
        }
        
        if (message.includes('sql server') || message.includes('t-sql')) {
            return this.knowledgeBase['sql-server-migration'].responses.join('\n\n') + '\n\n' + 
                   this.knowledgeBase['sql-server-migration'].followUp;
        }
        
        if (message.includes('performance') || message.includes('optimize') || message.includes('slow')) {
            return this.knowledgeBase['performance-tips'].responses.join('\n\n') + '\n\n' + 
                   this.knowledgeBase['performance-tips'].followUp;
        }
        
        if (message.includes('aurora') || message.includes('feature')) {
            return this.knowledgeBase['aurora-features'].responses.join('\n\n') + '\n\n' + 
                   this.knowledgeBase['aurora-features'].followUp;
        }

        // Specific function conversions
        if (message.includes('sysdate')) {
            return "To convert Oracle SYSDATE to PostgreSQL:\n\n" +
                   "**Oracle:** `SELECT SYSDATE FROM dual;`\n" +
                   "**PostgreSQL:** `SELECT CURRENT_TIMESTAMP;`\n\n" +
                   "Aurora PostgreSQL also supports NOW() as an alternative.";
        }

        if (message.includes('nvl')) {
            return "To convert Oracle NVL to PostgreSQL:\n\n" +
                   "**Oracle:** `NVL(column, 'default')`\n" +
                   "**PostgreSQL:** `COALESCE(column, 'default')`\n\n" +
                   "COALESCE is more powerful as it can handle multiple arguments.";
        }

        if (message.includes('to_date')) {
            return "To convert Oracle TO_DATE to PostgreSQL:\n\n" +
                   "**Oracle:** `TO_DATE('2024-01-01', 'YYYY-MM-DD')`\n" +
                   "**PostgreSQL:** `TO_TIMESTAMP('2024-01-01', 'YYYY-MM-DD')`\n\n" +
                   "Note: Format strings may need adjustment for PostgreSQL.";
        }

        if (message.includes('rownum')) {
            return "To convert Oracle ROWNUM to PostgreSQL:\n\n" +
                   "**Oracle:** `WHERE ROWNUM <= 10`\n" +
                   "**PostgreSQL:** `LIMIT 10`\n\n" +
                   "For pagination: `LIMIT 10 OFFSET 20` instead of ROWNUM BETWEEN 21 AND 30.";
        }

        // Error handling and troubleshooting
        if (message.includes('error') || message.includes('problem') || message.includes('issue')) {
            return this.knowledgeBase['common-issues'].responses.join('\n\n') + '\n\n' + 
                   this.knowledgeBase['common-issues'].followUp;
        }

        if (message.includes('help') || message.includes('how')) {
            return "I can help you with SQL migration to Aurora PostgreSQL! Here are some things I can assist with:\n\n" +
                   "• Converting Oracle PL/SQL to PL/pgSQL\n" +
                   "• Migrating from SQL Server T-SQL\n" +
                   "• Performance optimization strategies\n" +
                   "• Aurora-specific features and capabilities\n" +
                   "• Common migration issues and solutions\n\n" +
                   "Try asking about specific functions, syntax, or use the quick action buttons!";
        }

        // Default response
        return "I understand you're asking about SQL migration. Could you be more specific? For example:\n\n" +
               "• 'How do I convert Oracle NVL to PostgreSQL?'\n" +
               "• 'What are Aurora performance features?'\n" +
               "• 'Help with SQL Server stored procedures'\n\n" +
               "Or use the quick action buttons for common topics!";
    }

    addMessage(message) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}-message`;
        
        const timeString = message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageElement.innerHTML = `
            <div class="message-content">
                ${this.formatMessage(message.content)}
            </div>
            <div class="message-time">${timeString}</div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        // Add to conversation history
        this.conversationHistory.push(message);
    }

    formatMessage(content) {
        // Convert markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatbot-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new SQLMigrationChatbot();
});