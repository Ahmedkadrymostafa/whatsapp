import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import express from 'express';

const { Client, LocalAuth, MessageMedia } = pkg;

const app = express();
const port = 3000;

// Load contacts from JSON file
const contacts = JSON.parse(fs.readFileSync('./contacts.json', 'utf-8'));

// Load settings from JSON file
let settings = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));

// Create a Set of phone numbers for easy lookup
const contactNumbers = new Set(contacts.map(contact => `${contact.phone}@c.us`));

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true, // Ensure it's headless
    }
});

// Generate and display QR code for authentication
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Initialize arrays to store message statuses and replies
let messageStatuses = [];
let replies = [];

// Log message status to an array
function logMessageStatus(name, phone, status) {
    let entry = messageStatuses.find(item => item.phone === phone);

    if (!entry) {
        entry = {
            uniqueId: (messageStatuses.length + 1).toString(), // Assign a unique ID
            name,
            phone,
            sent: false,
            read: false,
            replied: false,
        };
        messageStatuses.push(entry);
    }

    if (status === 'Sent') {
        entry.sent = true;
    } else if (status === 'Read') {
        entry.read = true;
    } else if (status === 'Replied') {
        entry.replied = true;
    }
}

// Write the message statuses to the JSON file
function writeMessageStatusesToFile() {
    fs.writeFileSync('./message-status.json', JSON.stringify(messageStatuses, null, 2), 'utf-8');
}

// Start the WhatsApp client and listen for messages
client.on('ready', async () => {
    console.log('Client is ready!');

    // Ensure campaign is enabled
    if (!settings.campaignEnabled) {
        console.log('Campaign is disabled.');
        return;
    }

    let messagesSent = 0;
    const startTime = Date.now();

    for (const contact of contacts) {
        const { phone, name } = contact;
        const numberId = await client.getNumberId(phone);

        if (numberId) {
            const message = `Hello ${name}, check out our new marketing offers!`;

            // Optional: Send an image or video
            const mediaPath = settings.mediaPath; // Assuming mediaPath is defined in settings
            const media = MessageMedia.fromFilePath(mediaPath);

            // Check delay and message limit
            if (messagesSent >= settings.messagesPerHour || (Date.now() - startTime) >= 3600000) {
                console.log('Message limit reached for this hour. Waiting...');
                await new Promise(resolve => setTimeout(resolve, settings.delayBetweenHours * 60 * 1000)); // Wait for defined minutes
                messagesSent = 0;
            }

            // Send message with media
            await client.sendMessage(numberId._serialized, media, { caption: message })
                .then(message => {
                    console.log(`Message sent to ${name} (${phone})`);
                    logMessageStatus(name, phone, 'Sent');
                    writeMessageStatusesToFile(); // Write statuses to file after each message

                    // Listen for message status updates
                    client.on('message_ack', (msg, ack) => {
                        if (msg.id._serialized === message.id._serialized) {
                            if (ack === 1) {
                                console.log(`Message delivered to ${name} (${phone})`);
                                logMessageStatus(name, phone, 'Read');
                                writeMessageStatusesToFile(); // Update file after read
                            } else if (ack === 2) {
                                console.log(`Message read by ${name} (${phone})`);
                                logMessageStatus(name, phone, 'Read');
                                writeMessageStatusesToFile(); // Update file after read
                            }
                        }
                    });
                })
                .catch(err => {
                    console.error(`Failed to send message to ${name} (${phone}):`, err);
                    logMessageStatus(name, phone, 'Failed');
                });

            messagesSent++;

            // Delay between messages
            await new Promise(resolve => setTimeout(resolve, settings.delayBetweenMessages * 1000)); // Wait for the defined seconds
        } else {
            console.error(`Invalid WhatsApp number for ${name} (${phone}).`);
        }
    }
});

// Listen for incoming messages (replies)
client.on('message', msg => {
    if (contactNumbers.has(msg.from)) {
        const reply = msg.body;

        // Find the contact based on the sender's number
        const contact = contacts.find(c => `${c.phone}@c.us` === msg.from);

        // Find the existing reply entry for the sender
        let replyEntry = replies.find(item => item.from === msg.from);
        if (!replyEntry) {
            // Create a new entry including the contact's name
            replyEntry = { from: msg.from, name: contact ? contact.name : 'Unknown', replies: [] };
            replies.push(replyEntry);
        }

        // Add the reply to the replies array
        replyEntry.replies.push(reply);

        // Log the reply with the sender's name
        if (contact) {
            console.log(`Reply from ${contact.name} (${msg.from}): ${reply}`);
            logMessageStatus(contact.name, contact.phone, 'Replied');
            writeMessageStatusesToFile(); // Update status file
        }

        // Write replies to file after each reply
        writeRepliesToFile(); // This will only be called once
    }
});

// Write replies to JSON file
function writeRepliesToFile() {
    fs.writeFileSync('./replies.json', JSON.stringify(replies, null, 2), 'utf-8');
}

// Create an Express route to retrieve the replies
app.get('/replies', (req, res) => {
    res.json(replies);
});

// Create an Express route to retrieve message statuses
app.get('/message-status', (req, res) => {
    res.sendFile('./message-status.json', { root: '.' });
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
});

// Start the WhatsApp client
client.initialize();














// import pkg from 'whatsapp-web.js';
// import qrcode from 'qrcode-terminal';
// import fs from 'fs';
// import express from 'express';
// import moment from 'moment-timezone'; // Import moment-timezone for handling time zones

// const { Client, LocalAuth, MessageMedia } = pkg;

// const app = express();
// const port = 3000;

// // Load settings from JSON file
// const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));

// // Load contacts from JSON file
// const contacts = JSON.parse(fs.readFileSync('./contacts.json', 'utf-8'));

// // Create a Set of phone numbers for easy lookup
// const contactNumbers = new Set(contacts.map(contact => `${contact.phone}@c.us`));

// // Initialize the WhatsApp client
// const client = new Client({
//     authStrategy: new LocalAuth(),
// });

// // Generate and display QR code for authentication
// client.on('qr', (qr) => {
//     qrcode.generate(qr, { small: true });
// });

// // Function to check if the current time is within campaign hours (8 AM - 10 PM Iraq time)
// function isWithinCampaignHours() {
//     const now = moment.tz("Asia/Baghdad");  // Get current time in Iraq
//     const start = moment.tz("08:00", "HH:mm", "Asia/Baghdad");  // Campaign start time
//     const end = moment.tz("22:00", "HH:mm", "Asia/Baghdad");    // Campaign end time
//     return now.isBetween(start, end);  // Check if current time is within campaign hours
// }

// // Start campaign to send messages to contacts
// async function startCampaign() {
//     // Ensure messages are sent only between the specified hours
//     if (!isWithinCampaignHours()) {
//         console.log("Campaign is outside of allowed hours. Messages will not be sent.");
//         return;
//     }

//     console.log("Campaign is running within allowed hours.");

//     for (const contact of contacts) {
//         const { phone, name, mediaType, mediaPath } = contact;
//         const numberId = await client.getNumberId(phone);

//         if (numberId) {
//             const message = `Hello ${name}, check out our new marketing offers!`;

//             try {
//                 // Send message based on media type
//                 if (mediaType === "image" || mediaType === "video") {
//                     const media = MessageMedia.fromFilePath(mediaPath);
//                     await client.sendMessage(numberId._serialized, media, { caption: message });
//                     console.log(`Media message sent to ${name} (${phone})`);
//                 } else {
//                     await client.sendMessage(numberId._serialized, message);
//                     console.log(`Text message sent to ${name} (${phone})`);
//                 }

//                 // Update message status
//                 updateMessageStatus(contact, 'sent');
//             } catch (err) {
//                 console.error(`Failed to send message to ${name} (${phone}):`, err);
//                 updateMessageStatus(contact, 'failed');
//             }

//             // Wait between messages as per delay settings
//             await delay(settings.delayBetweenMessages * 1000);  // Delay in seconds
//         } else {
//             console.error(`Invalid WhatsApp number for ${name} (${phone}).`);
//         }
//     }
// }

// // Function to add a delay between messages
// function delay(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// // Function to update the message status in status.json file
// function updateMessageStatus(contact, status) {
//     const messageStatus = JSON.parse(fs.readFileSync('./status.json', 'utf-8'));

//     // Find the contact by uniqueId and update its status
//     const contactStatus = messageStatus.find(status => status.uniqueId === contact.uniqueId);
//     if (contactStatus) {
//         contactStatus.status = status;
//     } else {
//         messageStatus.push({
//             uniqueId: contact.uniqueId,
//             name: contact.name,
//             phone: contact.phone,
//             status: status
//         });
//     }

//     fs.writeFileSync('./status.json', JSON.stringify(messageStatus, null, 2), 'utf-8');
// }

// // Listen for incoming messages (replies)
// client.on('message', msg => {
//     if (contactNumbers.has(msg.from)) {
//         const reply = {
//             from: msg.from,
//             body: msg.body,
//             timestamp: msg.timestamp,
//         };

//         console.log(`Reply from ${msg.from}: ${msg.body}`);
        
//         // Add reply to the replies.json file
//         const replies = JSON.parse(fs.readFileSync('./replies.json', 'utf-8'));
//         const contactReplies = replies.find(r => r.uniqueId === msg.from);
        
//         if (contactReplies) {
//             contactReplies.messages.push(reply);
//         } else {
//             replies.push({ uniqueId: msg.from, messages: [reply] });
//         }

//         fs.writeFileSync('./replies.json', JSON.stringify(replies, null, 2), 'utf-8');
//     }
// });

// // Create an Express route to retrieve the message status
// app.get('/status', (req, res) => {
//     const messageStatus = JSON.parse(fs.readFileSync('./status.json', 'utf-8'));
//     res.json(messageStatus);
// });

// // Create an Express route to retrieve the replies
// app.get('/replies', (req, res) => {
//     const replies = JSON.parse(fs.readFileSync('./replies.json', 'utf-8'));
//     res.json(replies);
// });

// // Start the Express server
// app.listen(port, () => {
//     console.log(`Server is listening on http://localhost:${port}`);
// });

// // Start the WhatsApp client
// client.on('ready', () => {
//     console.log('Client is ready!');
//     startCampaign(); // Start the campaign automatically when the client is ready
// });

// client.initialize();









// import pkg from 'whatsapp-web.js';
// import qrcode from 'qrcode-terminal';
// import fs from 'fs';
// import express from 'express';

// const { Client, LocalAuth, MessageMedia } = pkg;

// const app = express();
// const port = 3000;

// // Load contacts from JSON file
// const contacts = JSON.parse(fs.readFileSync('./contacts.json', 'utf-8'));

// // Load settings from JSON file
// let settings = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));

// // Create a Set of phone numbers for easy lookup
// const contactNumbers = new Set(contacts.map(contact => `${contact.phone}@c.us`));

// // Initialize the WhatsApp client
// const client = new Client({
//     authStrategy: new LocalAuth(),
// });

// // Generate and display QR code for authentication
// client.on('qr', (qr) => {
//     qrcode.generate(qr, { small: true });
// });

// // Once authenticated, send messages
// client.on('ready', async () => {
//     console.log('Client is ready!');

//     // Ensure campaign is enabled
//     if (!settings.campaignEnabled) {
//         console.log('Campaign is disabled.');
//         return;
//     }

//     let messagesSent = 0;
//     const startTime = Date.now();

//     for (const contact of contacts) {
//         const { phone, name } = contact;
//         const numberId = await client.getNumberId(phone);

//         if (numberId) {
//             const message = `Hello ${name}, check out our new marketing offers!`;

//             // Optional: Send an image
//             const media = MessageMedia.fromFilePath('./egypt.jpg');  // Replace with your image path

//             // Check delay and message limit
//             if (messagesSent >= settings.messagesPerHour || (Date.now() - startTime) >= 3600000) {
//                 console.log('Message limit reached for this hour. Waiting...');
//                 await new Promise(resolve => setTimeout(resolve, 3600000)); // Wait for one hour
//                 messagesSent = 0;
//             }

//             // Send message with image
//             await client.sendMessage(numberId._serialized, media, { caption: message })
//                 .then(message => {
//                     console.log(`Message sent to ${name} (${phone})`);

//                     // Update message status
//                     logMessageStatus(name, phone, 'Sent');

//                     // Listen for message status updates
//                     client.on('message_ack', (msg, ack) => {
//                         if (msg.id._serialized === message.id._serialized) {
//                             if (ack === 1) {
//                                 console.log(`Message delivered to ${name} (${phone})`);
//                                 logMessageStatus(name, phone, 'Delivered');
//                             } else if (ack === 2) {
//                                 console.log(`Message read by ${name} (${phone})`);
//                                 logMessageStatus(name, phone, 'Read');
//                             }
//                         }
//                     });
//                 })
//                 .catch(err => {
//                     console.error(`Failed to send message to ${name} (${phone}):`, err);
//                     logMessageStatus(name, phone, 'Failed');
//                 });

//             messagesSent++;

//             // Delay between messages
//             await new Promise(resolve => setTimeout(resolve, settings.delayBetweenMessages * 1000));
//         } else {
//             console.error(`Invalid WhatsApp number for ${name} (${phone}).`);
//         }
//     }
// });

// // Initialize an empty array to store replies
// let replies = [];

// // Listen for incoming messages (replies)
// client.on('message', msg => {
//     if (contactNumbers.has(msg.from)) {
//         const reply = {
//             from: msg.from,
//             body: msg.body,
//             timestamp: msg.timestamp,
//         };

//         console.log(`Reply from ${msg.from}: ${msg.body}`);
//         replies.push(reply);

//         // Update message status
//         const contact = contacts.find(c => `${c.phone}@c.us` === msg.from);
//         if (contact) {
//             logMessageStatus(contact.name, contact.phone, 'Replied');
//         }
//     }
// });

// // Log message status to a file
// function logMessageStatus(name, phone, status) {
//     const logEntry = {
//         name,
//         phone,
//         status,
//         timestamp: new Date().toISOString(),
//     };
//     fs.appendFileSync('./message-status.json', JSON.stringify(logEntry) + '\n', 'utf-8');
// }

// // Create an Express route to retrieve the replies
// app.get('/replies', (req, res) => {
//     res.json(replies);
// });

// // Create an Express route to retrieve message statuses
// app.get('/message-status', (req, res) => {
//     const statusData = fs.readFileSync('./message-status.json', 'utf-8');
//     res.send(statusData);
// });

// // Start the Express server
// app.listen(port, () => {
//     console.log(`Server is listening on http://localhost:${port}`);
// });

// // Start the WhatsApp client
// client.initialize();
