import axios from 'axios';

async function healthCheck() {
  try {
    const port = process.env.PORT || 3000;
    const response = await axios.get(`http://localhost:${port}/health`, {
      timeout: 3000,
    });
    
    if (response.status === 200) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check failed:', error.message);
    process.exit(1);
  }
}

healthCheck();
