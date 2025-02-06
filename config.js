const CONFIG = {
    API_KEYS: [
        'sk-3548f1a88ea348f2b750118adf5cf311',  // 主要API密钥
        'sk-de056920b28a4c1ea0f299e3f79465ac',  // 第一备用API密钥
        'sk-437a284e256d4780be09c8736eb74f0d'   // 第二备用API密钥
    ],
    API_URL: 'https://api.deepseek.com/v1/chat/completions',
    currentKeyIndex: 0  // 当前使用的API密钥索引
}; 