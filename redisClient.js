const redis = require('redis');
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

class RedisSingleton {
  constructor() {
    if (!RedisSingleton.instance) {
      RedisSingleton.instance = redis.createClient(REDIS_URI);
      RedisSingleton.instance.connect().catch((err) => {
        console.error('Redis connection error:', err);
      });
    }
  }

  getInstance() {
    return RedisSingleton.instance;
  }
}

const instance = new RedisSingleton();
const redisClient = instance.getInstance();

module.exports = redisClient;
