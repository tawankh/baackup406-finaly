const express = require('express');
const WebSocket = require('ws');
const { BlobServiceClient } = require('@azure/storage-blob');
const { MongoClient, ServerApiVersion } = require('mongodb');

console.log('Server started');
// MongoDB Atlas connection setup
const mongoURI = "mongodb+srv://backup406:65008277tawan@cluster01.xxbc5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster01";
const client = new MongoClient(mongoURI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

if (!client) {
    console.error('Error connecting to MongoDB Atlas');
} else {
    console.log('Connected to MongoDB Atlas');
}

const app = express();

// Use Static Middleware to serve files from the 'public' folder
app.use(express.static('public'));

// Set the port (use ENV variable or default to 8080)
const PORT = process.env.PORT || 8080;

// Create HTTP server for Express app
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connection
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    // Send temperature data periodically
    setInterval(async () => {
        const temperature = getRandomTemperature();
        const humidity = getRandomHumidity();
        console.log('Sending data:', 'Temp ', temperature, ' Hum ', humidity);    // Log the data sent to the client

        try {
            // Connect to MongoDB and save the temperature and humidity data
            await client.connect();
            const database = client.db('weatherData');  // Replace with your DB name
            const collection = database.collection('sensorData');  // Replace with your collection name

            const newWeatherData = { temperature, humidity, timestamp: new Date() };
            await collection.insertOne(newWeatherData);
            console.log('Data saved to MongoDB Atlas');
        } catch (error) {
            console.error('Error saving data to MongoDB:', error);
        } finally {
            await client.close();
        }
        ws.send(JSON.stringify({ temperature, humidity }));     // Send the temperature data to the client
    }, 2000); // Send data every 2 seconds

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
});

// Function to generate a random temperature
function getRandomTemperature() {
    return (Math.random() * 10 + 20).toFixed(2); // Random temperature between 20-30°C
}

// Function to generate a random Humidity
function getRandomHumidity() {
    return (Math.random() * 50 + 30).toFixed(2); // Random humidity between 30-80%
}


// Azure Blob Storage connection setup
const connection_string = "DefaultEndpointsProtocol=https;AccountName=backupdatatemp;AccountKey=y6jiVeA3X/Lqj2MPIVPAUnrYrg0P3OOcP5cSW8s4Okm27ZlrNPgrrFpBQO91VQw7xxIJ7gLIO6Af+AStGAVZzg==;EndpointSuffix=core.windows.net";
const blob_service_client = BlobServiceClient.fromConnectionString(connection_string);
const container_name = "sensor-backups";
const containerClient = blob_service_client.getContainerClient(container_name);

// Backup data every hour
setInterval(async () => {
    try {
        await client.connect();
        const database = client.db('weatherData');  // Replace with your DB name
        const collection = database.collection('sensorData');  // Replace with your collection name

        // Fetch the latest 100 records from MongoDB
        const weatherData = await collection.find().sort({ timestamp: -1 }).limit(100).toArray();
        const backupData = JSON.stringify(weatherData);

        // Create a unique file name for each backup
        const timestamp = new Date().toISOString();
        const blobName = `backup-${timestamp}.json`;

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const uploadBlobResponse = await blockBlobClient.upload(backupData, backupData.length);

        console.log('Backup successful:', uploadBlobResponse.requestId);
    } catch (error) {
        console.error('Error during backup:', error);
    } finally {
        await client.close();
    }
}, 3600000); // Run every hour (3600000ms = 1 hour)