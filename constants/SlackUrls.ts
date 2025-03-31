import dotenv from "dotenv";
dotenv.config();

export const SLACK_NOTIFICATIONS: Record<string, string[]> = {
  Billing: process.env.SLACK_URL_BILLING?.split(",") || [],
  Bug: process.env.SLACK_URL_ENGINEERING_SUPPORT?.split(",") || [],
  "Feature Request": process.env.SLACK_URL_FEATURE_REQUEST?.split(",") || [],
  General: process.env.SLACK_URL_GENERAL?.split(",") || [],
};
