import mongoose from 'mongoose';
import dns from 'dns';

// Fix DNS SRV query failures on Node.js / Windows / Serverless environments
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Graceful fallback if custom DNS servers cannot be set
}

// Pre-register all canonical Mongoose models to prevent MissingSchemaError on cold starts
import '../models/Organization.js';
import '../models/User.js';
import '../models/ApprovedTarget.js';
import '../models/AssessmentProfile.js';
import '../models/Assessment.js';
import '../models/TestRun.js';
import '../models/Evidence.js';
import '../models/ScenarioResult.js';
import '../models/Finding.js';
import '../models/LegalRequirement.js';
import '../models/AssessmentDocument.js';
import '../models/AssessmentEvent.js';
import '../models/AuditLog.js';
import '../models/BrowserAction.js';
import '../models/Report.js';
import '../models/StructuredObservation.js';

/**
 * Global cache for the Mongoose connection across Next.js HMR cycles.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Connect to MongoDB with connection caching.
 * @returns {Promise<typeof mongoose>}
 */
export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside .env.local'
    );
  }

  // If already connected and ready, return existing connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    }).catch((err) => {
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

/**
 * Check current database connection status without throwing.
 * @returns {Promise<{ isConnected: boolean, readyState: number, stateName: string, host?: string, name?: string, error?: string }>}
 */
export async function getDatabaseStatus() {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };

  try {
    if (!process.env.MONGODB_URI) {
      return {
        isConnected: false,
        readyState: 0,
        stateName: 'missing_configuration',
        error: 'MONGODB_URI is not set'
      };
    }

    const conn = await connectToDatabase();
    const readyState = mongoose.connection.readyState;

    return {
      isConnected: readyState === 1,
      readyState,
      stateName: stateMap[readyState] || 'unknown',
      host: conn.connection.host ? conn.connection.host.replace(/(:\/\/)([^@]+@)/, '$1***@') : undefined,
      databaseName: conn.connection.name || undefined
    };
  } catch (error) {
    const readyState = mongoose.connection ? mongoose.connection.readyState : 0;
    return {
      isConnected: false,
      readyState,
      stateName: stateMap[readyState] || 'disconnected',
      error: error.message
    };
  }
}

export default connectToDatabase;
