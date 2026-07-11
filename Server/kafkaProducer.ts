import { Kafka } from "kafkajs";
import { broadcastToAll } from "./Websockets";

const kafka = new Kafka({
    clientId: "my-app",
    brokers: ["localhost:9092"],
});

// 🔥 EXPORT PRODUCER DIRECTLY
export const producer = kafka.producer();

// 🔥 INIT FUNCTION (connect once)
export const initKafka = async () => {
    await producer.connect();
    console.log("Kafka Producer Connected");

    await consumer.connect();
    await consumer.subscribe({ topic: "user-events", fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (message.value) {
                const data = JSON.parse(message.value.toString());
                console.log("Received from Kafka:", data);

                broadcastToAll({
                    type: "kafka-event",
                    data,
                    timestamp: new Date().toISOString(),
                });
            }
        },
    });
};

const consumer = kafka.consumer({ groupId: "user-group" });