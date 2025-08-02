import mongoose from 'mongoose';

export async function connectMongo() {
    const mongo_url = process.env.MONGO_URI
    if (!mongo_url) {
        throw new Error('MONGO_URI is not defined in the environment variables');
    }

    try {
        await mongoose.connect(mongo_url)

        const collections = await mongoose.connection.db?.listCollections().toArray()
        console.log('Collections: ', collections?.map(c => c.name))

        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

export async function disconnectMongo() {
    try {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
        throw error;
    }
}