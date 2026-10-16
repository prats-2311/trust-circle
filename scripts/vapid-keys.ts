import webpush from "web-push";

// Prints a new VAPID key pair. It never writes a file: paste the two lines into .env.local yourself.
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("\nPaste these two lines into .env.local yourself, then restart the server.");
