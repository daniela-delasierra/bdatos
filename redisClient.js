const redis = require('redis');
const REDIS_PORT = process.env.REDIS_PORT || 'redis://localhost:6379'; // Use 'redis://redis:6379' if Redis runs in Docker

class RedisSingleton {
  constructor() {
    if (!RedisSingleton.instance) {
      RedisSingleton.instance = redis.createClient(REDIS_PORT);
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
