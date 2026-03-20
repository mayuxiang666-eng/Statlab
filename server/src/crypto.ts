import CryptoJS from "crypto-js";

const SECRET = process.env.ENCRYPTION_KEY || "statlab-manufacturing-2026-secret";

export function encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, SECRET).toString();
}

export function decrypt(cipherText: string): string {
    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
}
