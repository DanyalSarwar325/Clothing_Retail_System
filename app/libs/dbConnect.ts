
import mongoose from "mongoose";

type ConnectionObject = {
    isConnected?: boolean;
}

const connection: ConnectionObject = {}

async function DbConnect(): Promise<void> {
    console.log("Inside Mongo Connection");

    // Check if already connected
    if (connection.isConnected || mongoose.connection.readyState === 1) {
        console.log("DB already connected");
        return;
    }

    try {
        console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
        
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI environment variable is not set");
        }

        // Optimized for serverless with connection pooling
        const db = await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        });

        connection.isConnected = db.connections[0].readyState === 1;
        console.log("DB connected successfully");
    } catch (error: unknown) {
        console.log("Error occurred while connecting to MongoDB:", error);
        connection.isConnected = false;
        throw new Error(`Failed to connect to MongoDB: ${error}`);
    }
}

export default DbConnect;
