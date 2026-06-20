import os
import time
import json
import logging
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CacheService")

class MemoryCache:
    """Thread-safe fallback memory cache mimicking Redis interface."""
    def __init__(self):
        self._store = {}
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            if key not in self._store:
                return None
            data = self._store[key]
            if data["expiry"] is not None and time.time() > data["expiry"]:
                del self._store[key]
                return None
            return data["value"]

    def set(self, key, value, timeout=None):
        expiry = time.time() + timeout if timeout else None
        with self._lock:
            self._store[key] = {
                "value": value,
                "expiry": expiry
            }
        return True

    def delete(self, key):
        with self._lock:
            if key in self._store:
                del self._store[key]
                return True
        return False

class CacheService:
    def __init__(self):
        self.redis_client = None
        self.fallback_cache = MemoryCache()
        
        # Try to import and connect to redis
        try:
            import redis
            host = os.environ.get("REDIS_HOST", "localhost")
            port = int(os.environ.get("REDIS_PORT", 6379))
            self.redis_client = redis.Redis(host=host, port=port, decode_responses=True, socket_timeout=2)
            # Ping connection to check if server is active
            self.redis_client.ping()
            logger.info("Successfully connected to Redis server.")
        except ImportError:
            logger.warning("Redis library not installed. Gracefully falling back to memory caching.")
            self.redis_client = None
        except Exception as e:
            logger.warning(f"Failed to connect to Redis server ({e}). Falling back to memory caching.")
            self.redis_client = None

    def get(self, key):
        """Gets value from cache. Returns deserialized JSON or raw string."""
        if self.redis_client:
            try:
                val = self.redis_client.get(key)
                if val is not None:
                    try:
                        return json.loads(val)
                    except json.JSONDecodeError:
                        return val
                return None
            except Exception as e:
                logger.error(f"Redis get error: {e}. Falling back to memory.")
                
        return self.fallback_cache.get(key)

    def set(self, key, value, timeout=None):
        """Sets key-value pair in cache. Automatically serializes dicts/lists to JSON."""
        serialized = json.dumps(value) if isinstance(value, (dict, list)) else value
        
        if self.redis_client:
            try:
                self.redis_client.set(key, serialized, ex=timeout)
                return True
            except Exception as e:
                logger.error(f"Redis set error: {e}. Falling back to memory.")
                
        return self.fallback_cache.set(key, value, timeout=timeout)

    def delete(self, key):
        """Deletes key from cache."""
        if self.redis_client:
            try:
                self.redis_client.delete(key)
                return True
            except Exception as e:
                logger.error(f"Redis delete error: {e}. Falling back to memory.")
                
        return self.fallback_cache.delete(key)

# Singleton instance
cache_service = CacheService()
