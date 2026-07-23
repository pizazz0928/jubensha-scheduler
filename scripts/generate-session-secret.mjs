import { randomBytes } from "node:crypto";

process.stdout.write(`${randomBytes(48).toString("base64url")}\n`);
