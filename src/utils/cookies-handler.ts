import fs from "fs";
import path from 'path';
import { config } from "../config.js";

export async function youtubeCookieHandler(): Promise<string | null> {
    try {
        const cookies = config.ytCookies;

        console.log(
            "[YouTube Cookie Handler] YOUTUBE_COOKIES:",
            cookies.trim().substring(0, 30) + "..."
        );

        if (!cookies) {
            console.warn("[YouTube Cookie Handler] No YOUTUBE_COOKIES found");
            return null;
        }

        const cookiePath = path.join(process.cwd(), "cookies.txt");

        fs.writeFileSync('/tmp/cookies.txt', cookies, "utf-8");

        console.info("[YouTube Cookie Handler] Cookies written successfully");
        return cookiePath;
    } catch (error) {
        console.error("[YouTube Cookie Handler] Error handling cookies:", error);
        return null;
    }
}